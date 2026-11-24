package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.ai.VrpOptimizeRequest;
import vn.rikkei.post.dto.ai.VrpOptimizeResponse;
import vn.rikkei.post.dto.ai.VrpStopDto;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.ShipperAssignment;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.ShipperAssignmentRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.VrpSolverService;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class VrpSolverServiceImpl implements VrpSolverService {

    private final OrderRepository orderRepository;
    private final ShipperAssignmentRepository assignmentRepository;
    private final WarehouseRepository warehouseRepository;

    private static final double EARTH_RADIUS_KM = 6371.0;
    private static final double AVERAGE_SPEED_KMH = 25.0; // Tốc độ di chuyển nội đô trung bình (xe máy)
    private static final int STOP_SERVICE_MINUTES = 6; // Thời gian dừng giao hàng trung bình mỗi điểm

    @Override
    @Transactional
    public VrpOptimizeResponse optimizeRoute(VrpOptimizeRequest request) {
        List<Order> orders;
        if (request.getTrackingCodes() != null && !request.getTrackingCodes().isEmpty()) {
            orders = orderRepository.findByTrackingCodeIn(request.getTrackingCodes());
        } else if (request.getShipperId() != null) {
            orders = orderRepository.findByAssignedShipperIdAndCurrentStatusIn(
                    request.getShipperId(),
                    List.of("DELIVERING", "PICKED_UP", "AT_SORTING_HUB")
            );
        } else {
            throw new IllegalArgumentException("Vui lòng cung cấp danh sách mã đơn hàng hoặc ID của Shipper để tối ưu tuyến đường!");
        }

        if (orders.isEmpty()) {
            return VrpOptimizeResponse.builder()
                    .totalStops(0)
                    .totalDistanceKm(0.0)
                    .totalEstimatedMinutes(0)
                    .originalDistanceKm(0.0)
                    .distanceSavedKm(0.0)
                    .savingsPercent(0.0)
                    .stops(Collections.emptyList())
                    .algorithmUsed("Nearest Neighbor + 2-Opt Heuristic")
                    .polylineSummary("")
                    .build();
        }

        // Tọa độ điểm xuất phát (Bưu cục hoặc GPS Shipper)
        double startLat = 21.0285;
        double startLng = 105.8542; // Hà Nội default
        if (request.getStartLat() != null && request.getStartLng() != null && request.getStartLat() != 0.0) {
            startLat = request.getStartLat();
            startLng = request.getStartLng();
        } else if (!orders.isEmpty() && orders.get(0).getAssignedPostOfficeId() != null) {
            Optional<Warehouse> whOpt = warehouseRepository.findById(orders.get(0).getAssignedPostOfficeId());
            if (whOpt.isPresent() && whOpt.get().getLatitude() != null) {
                startLat = whOpt.get().getLatitude();
                startLng = whOpt.get().getLongitude();
            }
        }

        // Tạo danh sách điểm giao hàng
        List<LocationPoint> points = new ArrayList<>();
        for (Order o : orders) {
            double lat = (o.getReceiverLat() != null && o.getReceiverLat() != 0.0) ? o.getReceiverLat() : (startLat + (new Random(o.getId()).nextDouble() - 0.5) * 0.04);
            double lng = (o.getReceiverLng() != null && o.getReceiverLng() != 0.0) ? o.getReceiverLng() : (startLng + (new Random(o.getId() + 7).nextDouble() - 0.5) * 0.04);
            points.add(new LocationPoint(o, lat, lng));
        }

        // Tính tổng quãng đường ban đầu
        double originalDist = calculateTotalPathDistance(startLat, startLng, points);

        // 1. Giai đoạn 1: Thuật toán Nearest Neighbor Heuristic
        List<LocationPoint> currentRoute = solveNearestNeighbor(startLat, startLng, points);

        // 2. Giai đoạn 2: Thuật toán Tối ưu hóa cục bộ 2-Opt (Local Search Improvement)
        currentRoute = optimize2Opt(startLat, startLng, currentRoute);

        // Tính tổng quãng đường sau tối ưu
        double optimizedDist = calculateTotalPathDistance(startLat, startLng, currentRoute);
        double distanceSaved = Math.max(0.0, originalDist - optimizedDist);
        double savingsPercent = originalDist > 0 ? (distanceSaved / originalDist) * 100.0 : 0.0;

        // Xây dựng danh sách VrpStopDto
        List<VrpStopDto> stops = new ArrayList<>();
        double runningDistance = 0.0;
        int runningMinutes = 0;
        double prevLat = startLat;
        double prevLng = startLng;

        for (int i = 0; i < currentRoute.size(); i++) {
            LocationPoint pt = currentRoute.get(i);
            Order o = pt.order;
            double stepDist = haversine(prevLat, prevLng, pt.lat, pt.lng);
            runningDistance += stepDist;
            int stepTravelMins = (int) Math.round((stepDist / AVERAGE_SPEED_KMH) * 60.0);
            runningMinutes += stepTravelMins + STOP_SERVICE_MINUTES;

            stops.add(VrpStopDto.builder()
                    .stopNumber(i + 1)
                    .trackingCode(o.getTrackingCode())
                    .receiverName(o.getReceiverName())
                    .receiverPhone(o.getReceiverPhone())
                    .receiverAddress(o.getReceiverAddress())
                    .lat(pt.lat)
                    .lng(pt.lng)
                    .distanceFromPrevKm(Math.round(stepDist * 100.0) / 100.0)
                    .estimatedTravelMinutes(runningMinutes)
                    .codAmount(o.getCodAmount())
                    .currentStatus(o.getCurrentStatus())
                    .build());

            prevLat = pt.lat;
            prevLng = pt.lng;

            // Nếu người dùng yêu cầu áp dụng, cập nhật sequenceOrder cho Shipper
            if (Boolean.TRUE.equals(request.getApplyToShipper()) && request.getShipperId() != null) {
                Optional<ShipperAssignment> assignOpt = assignmentRepository.findByTrackingCode(o.getTrackingCode());
                if (assignOpt.isPresent()) {
                    ShipperAssignment assign = assignOpt.get();
                    assign.setSequenceOrder(i + 1);
                    assignmentRepository.save(assign);
                }
            }
        }

        log.info("VRP Solver hoàn tất: {} điểm giao. Quãng đường ban đầu: {} km, sau tối ưu: {} km (Tiết kiệm: {}%)",
                stops.size(), Math.round(originalDist * 10.0) / 10.0, Math.round(optimizedDist * 10.0) / 10.0, Math.round(savingsPercent * 10.0) / 10.0);

        return VrpOptimizeResponse.builder()
                .totalStops(stops.size())
                .totalDistanceKm(Math.round(optimizedDist * 100.0) / 100.0)
                .totalEstimatedMinutes(runningMinutes)
                .originalDistanceKm(Math.round(originalDist * 100.0) / 100.0)
                .distanceSavedKm(Math.round(distanceSaved * 100.0) / 100.0)
                .savingsPercent(Math.round(savingsPercent * 10.0) / 10.0)
                .stops(stops)
                .algorithmUsed("Nearest Neighbor + 2-Opt Heuristic")
                .polylineSummary(stops.size() + " điểm giao hàng tối ưu liên hoàn")
                .build();
    }

    @Override
    @Transactional
    public VrpOptimizeResponse optimizeShipperActiveOrders(Long shipperId, Double currentLat, Double currentLng, boolean applySequence) {
        VrpOptimizeRequest req = VrpOptimizeRequest.builder()
                .shipperId(shipperId)
                .startLat(currentLat)
                .startLng(currentLng)
                .applyToShipper(applySequence)
                .build();
        return optimizeRoute(req);
    }

    private List<LocationPoint> solveNearestNeighbor(double startLat, double startLng, List<LocationPoint> unvisited) {
        List<LocationPoint> result = new ArrayList<>();
        List<LocationPoint> pool = new ArrayList<>(unvisited);

        double curLat = startLat;
        double curLng = startLng;

        while (!pool.isEmpty()) {
            LocationPoint nearest = null;
            double minDist = Double.MAX_VALUE;
            int nearestIdx = -1;

            for (int i = 0; i < pool.size(); i++) {
                LocationPoint p = pool.get(i);
                double d = haversine(curLat, curLng, p.lat, p.lng);
                if (d < minDist) {
                    minDist = d;
                    nearest = p;
                    nearestIdx = i;
                }
            }

            if (nearest != null) {
                result.add(nearest);
                curLat = nearest.lat;
                curLng = nearest.lng;
                pool.remove(nearestIdx);
            }
        }
        return result;
    }

    private List<LocationPoint> optimize2Opt(double startLat, double startLng, List<LocationPoint> route) {
        if (route.size() <= 2) return route;

        List<LocationPoint> bestRoute = new ArrayList<>(route);
        boolean improved = true;
        int iterations = 0;
        int maxIterations = 50;

        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;

            for (int i = 0; i < bestRoute.size() - 1; i++) {
                for (int k = i + 1; k < bestRoute.size(); k++) {
                    double currentDist = calculateSegmentDistance(startLat, startLng, bestRoute, i, k);
                    List<LocationPoint> newRoute = twoOptSwap(bestRoute, i, k);
                    double newDist = calculateSegmentDistance(startLat, startLng, newRoute, i, k);

                    if (newDist < currentDist - 0.001) {
                        bestRoute = newRoute;
                        improved = true;
                        break;
                    }
                }
                if (improved) break;
            }
        }
        return bestRoute;
    }

    private List<LocationPoint> twoOptSwap(List<LocationPoint> route, int i, int k) {
        List<LocationPoint> newRoute = new ArrayList<>();
        // 1. Lấy từ 0 đến i-1
        for (int c = 0; c < i; c++) {
            newRoute.add(route.get(c));
        }
        // 2. Đảo ngược thứ tự từ i đến k
        for (int c = k; c >= i; c--) {
            newRoute.add(route.get(c));
        }
        // 3. Lấy từ k+1 đến hết
        for (int c = k + 1; c < route.size(); c++) {
            newRoute.add(route.get(c));
        }
        return newRoute;
    }

    private double calculateTotalPathDistance(double startLat, double startLng, List<LocationPoint> route) {
        if (route.isEmpty()) return 0.0;
        double dist = haversine(startLat, startLng, route.get(0).lat, route.get(0).lng);
        for (int i = 0; i < route.size() - 1; i++) {
            dist += haversine(route.get(i).lat, route.get(i).lng, route.get(i + 1).lat, route.get(i + 1).lng);
        }
        return dist;
    }

    private double calculateSegmentDistance(double startLat, double startLng, List<LocationPoint> route, int i, int k) {
        double dist = 0.0;
        double pLat = (i == 0) ? startLat : route.get(i - 1).lat;
        double pLng = (i == 0) ? startLng : route.get(i - 1).lng;

        for (int idx = i; idx <= Math.min(k + 1, route.size() - 1); idx++) {
            dist += haversine(pLat, pLng, route.get(idx).lat, route.get(idx).lng);
            pLat = route.get(idx).lat;
            pLng = route.get(idx).lng;
        }
        return dist;
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    private static class LocationPoint {
        final Order order;
        final double lat;
        final double lng;

        LocationPoint(Order order, double lat, double lng) {
            this.order = order;
            this.lat = lat;
            this.lng = lng;
        }
    }
}
