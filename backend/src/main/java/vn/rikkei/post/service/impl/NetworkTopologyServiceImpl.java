package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.network.*;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.NetworkTopologyService;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class NetworkTopologyServiceImpl implements NetworkTopologyService {

    private final WarehouseRepository warehouseRepository;
    private final ProvinceRepository provinceRepository;
    private final TruckRepository truckRepository;
    private final MasterBagRepository masterBagRepository;
    private final DispatchOrderRepository dispatchOrderRepository;

    @Override
    @Cacheable(value = "network:topology", key = "'all'")
    public NetworkTopologyResponse getNetworkTopology() {
        List<Warehouse> allWarehouses = warehouseRepository.findAll();
        Map<Integer, String> provinceNameMap = provinceRepository.findAll().stream()
                .collect(Collectors.toMap(Province::getId, Province::getName, (p1, p2) -> p1));

        List<Truck> allTrucks = truckRepository.findAll();
        List<MasterBag> allBags = masterBagRepository.findAllByOrderByCreatedAtDesc();
        List<DispatchOrder> allDispatches = dispatchOrderRepository.findAllByOrderByCreatedAtDesc();

        // 1. Phân loại các kho
        List<Warehouse> regionalHubs = allWarehouses.stream()
                .filter(w -> "REGIONAL_HUB".equalsIgnoreCase(w.getType()))
                .toList();

        List<Warehouse> provincialHubs = allWarehouses.stream()
                .filter(w -> "HUB".equalsIgnoreCase(w.getType()))
                .toList();

        List<Warehouse> spokeOffices = allWarehouses.stream()
                .filter(w -> !"REGIONAL_HUB".equalsIgnoreCase(w.getType()) && !"HUB".equalsIgnoreCase(w.getType()))
                .toList();

        // 2. Xây dựng danh sách Nodes (Kho bưu cục)
        List<NetworkTopologyNodeResponse> nodes = allWarehouses.stream().map(wh -> {
            String typeDesc = switch (wh.getType()) {
                case "REGIONAL_HUB" -> "Tổng kho Trung chuyển Khu vực / Miền";
                case "HUB" -> "Trung tâm Chia chọn Hub Tỉnh";
                default -> "Bưu cục Giao dịch & Phát chặng cuối (Spoke)";
            };

            long availableTrucks = allTrucks.stream()
                    .filter(t -> t.getCurrentWarehouse() != null && t.getCurrentWarehouse().getId().equals(wh.getId()))
                    .filter(t -> "AT_WAREHOUSE".equalsIgnoreCase(t.getStatus()))
                    .count();

            long pendingBags = allBags.stream()
                    .filter(b -> b.getOriginWarehouse() != null && b.getOriginWarehouse().getId().equals(wh.getId()))
                    .filter(b -> "OPEN".equalsIgnoreCase(b.getStatus()) || "SEALED".equalsIgnoreCase(b.getStatus()) || "ASSIGNED_TO_DRIVER".equalsIgnoreCase(b.getStatus()))
                    .count();

            long incomingDispatches = allDispatches.stream()
                    .filter(d -> d.getDestWarehouse() != null && d.getDestWarehouse().getId().equals(wh.getId()))
                    .filter(d -> "IN_TRANSIT".equalsIgnoreCase(d.getStatus()))
                    .count();

            return NetworkTopologyNodeResponse.builder()
                    .id(wh.getId())
                    .code(wh.getCode())
                    .name(wh.getName())
                    .type(wh.getType())
                    .typeDescription(typeDesc)
                    .provinceId(wh.getProvinceId())
                    .provinceName(provinceNameMap.getOrDefault(wh.getProvinceId(), "Toàn quốc"))
                    .districtId(wh.getDistrictId())
                    .address(wh.getAddress())
                    .latitude(wh.getLatitude())
                    .longitude(wh.getLongitude())
                    .capacityPackages(wh.getCapacityPackages() != null ? wh.getCapacityPackages() : 50000)
                    .availableTrucksCount(availableTrucks)
                    .pendingBagsCount(pendingBags)
                    .incomingDispatchesCount(incomingDispatches)
                    .isActive(wh.getIsActive())
                    .build();
        }).toList();

        // 3. Xây dựng mạng lưới liên kết Topology Links
        List<NetworkTopologyLinkResponse> links = new ArrayList<>();

        // 3.1 Đường trục liên kết giữa các Kho vùng miền (REGIONAL_BACKBONE)
        for (int i = 0; i < regionalHubs.size(); i++) {
            for (int j = i + 1; j < regionalHubs.size(); j++) {
                Warehouse r1 = regionalHubs.get(i);
                Warehouse r2 = regionalHubs.get(j);

                double dist = haversine(r1.getLatitude(), r1.getLongitude(), r2.getLatitude(), r2.getLongitude());
                int activeTransits = countActiveTransitsBetween(allDispatches, r1.getId(), r2.getId());

                links.add(NetworkTopologyLinkResponse.builder()
                        .id("LINK_REG_" + r1.getId() + "_" + r2.getId())
                        .fromWarehouseId(r1.getId())
                        .fromWarehouseName(r1.getName())
                        .fromWarehouseCode(r1.getCode())
                        .fromLat(r1.getLatitude())
                        .fromLng(r1.getLongitude())
                        .toWarehouseId(r2.getId())
                        .toWarehouseName(r2.getName())
                        .toWarehouseCode(r2.getCode())
                        .toLat(r2.getLatitude())
                        .toLng(r2.getLongitude())
                        .linkType("REGIONAL_BACKBONE")
                        .linkDescription("Tuyến vận tải đường trục liên miền: " + r1.getName() + " ↔ " + r2.getName())
                        .distanceKm(Math.round(dist * 10.0) / 10.0)
                        .activeTransitsCount(activeTransits)
                        .build());
            }
        }

        // 3.2 Đường nối từ Kho vùng miền đến các Hub trung chuyển tỉnh (FEEDER_HUB)
        for (Warehouse hub : provincialHubs) {
            Warehouse closestRegional = findClosestWarehouse(hub, regionalHubs);
            if (closestRegional != null) {
                double dist = haversine(closestRegional.getLatitude(), closestRegional.getLongitude(), hub.getLatitude(), hub.getLongitude());
                int activeTransits = countActiveTransitsBetween(allDispatches, closestRegional.getId(), hub.getId());

                links.add(NetworkTopologyLinkResponse.builder()
                        .id("LINK_FEEDER_" + closestRegional.getId() + "_" + hub.getId())
                        .fromWarehouseId(closestRegional.getId())
                        .fromWarehouseName(closestRegional.getName())
                        .fromWarehouseCode(closestRegional.getCode())
                        .fromLat(closestRegional.getLatitude())
                        .fromLng(closestRegional.getLongitude())
                        .toWarehouseId(hub.getId())
                        .toWarehouseName(hub.getName())
                        .toWarehouseCode(hub.getCode())
                        .toLat(hub.getLatitude())
                        .toLng(hub.getLongitude())
                        .linkType("FEEDER_HUB")
                        .linkDescription("Tuyến trung chuyển phân vùng: " + closestRegional.getName() + " ↔ " + hub.getName())
                        .distanceKm(Math.round(dist * 10.0) / 10.0)
                        .activeTransitsCount(activeTransits)
                        .build());
            }
        }

        // 3.3 Đường nối từ Hub trung chuyển tỉnh đến các Bưu cục phát chặng cuối (LAST_MILE_SPOKE)
        List<Warehouse> hubCandidates = new ArrayList<>();
        hubCandidates.addAll(provincialHubs);
        if (hubCandidates.isEmpty()) {
            hubCandidates.addAll(regionalHubs);
        }

        for (Warehouse spoke : spokeOffices) {
            // Ưu tiên Hub cùng tỉnh nếu có, nếu không lấy Hub gần nhất
            Warehouse assignedHub = hubCandidates.stream()
                    .filter(h -> h.getProvinceId() != null && h.getProvinceId().equals(spoke.getProvinceId()))
                    .findFirst()
                    .orElseGet(() -> findClosestWarehouse(spoke, hubCandidates));

            if (assignedHub != null) {
                double dist = haversine(assignedHub.getLatitude(), assignedHub.getLongitude(), spoke.getLatitude(), spoke.getLongitude());
                int activeTransits = countActiveTransitsBetween(allDispatches, assignedHub.getId(), spoke.getId());

                links.add(NetworkTopologyLinkResponse.builder()
                        .id("LINK_SPOKE_" + assignedHub.getId() + "_" + spoke.getId())
                        .fromWarehouseId(assignedHub.getId())
                        .fromWarehouseName(assignedHub.getName())
                        .fromWarehouseCode(assignedHub.getCode())
                        .fromLat(assignedHub.getLatitude())
                        .fromLng(assignedHub.getLongitude())
                        .toWarehouseId(spoke.getId())
                        .toWarehouseName(spoke.getName())
                        .toWarehouseCode(spoke.getCode())
                        .toLat(spoke.getLatitude())
                        .toLng(spoke.getLongitude())
                        .linkType("LAST_MILE_SPOKE")
                        .linkDescription("Tuyến gom & phát chặng cuối: " + assignedHub.getName() + " ↔ " + spoke.getName())
                        .distanceKm(Math.round(dist * 10.0) / 10.0)
                        .activeTransitsCount(activeTransits)
                        .build());
            }
        }

        // 4. Danh sách xe tải đang hoạt động
        List<NetworkActiveTruckResponse> activeTrucks = allTrucks.stream().map(t -> {
            Double lat = 21.0285;
            Double lng = 105.8542;
            String whName = "Đang di chuyển trên đường";

            if (t.getCurrentWarehouse() != null) {
                lat = t.getCurrentWarehouse().getLatitude();
                lng = t.getCurrentWarehouse().getLongitude();
                whName = t.getCurrentWarehouse().getName();
            }

            return NetworkActiveTruckResponse.builder()
                    .id(t.getId())
                    .licensePlate(t.getLicensePlate())
                    .truckType(t.getTruckType())
                    .payloadKg(t.getPayloadKg())
                    .status(t.getStatus())
                    .driverName(t.getCurrentDriverName() != null ? t.getCurrentDriverName() : "Chưa có tài xế")
                    .driverPhone(t.getCurrentDriverPhone())
                    .currentWarehouseId(t.getCurrentWarehouse() != null ? t.getCurrentWarehouse().getId() : null)
                    .currentWarehouseName(whName)
                    .latitude(lat)
                    .longitude(lng)
                    .build();
        }).toList();

        int bagsInTransit = (int) allBags.stream().filter(b -> "IN_TRANSIT".equalsIgnoreCase(b.getStatus())).count();

        return NetworkTopologyResponse.builder()
                .nodes(nodes)
                .links(links)
                .activeTrucks(activeTrucks)
                .totalRegionalHubs(regionalHubs.size())
                .totalHubs(provincialHubs.size())
                .totalSpokes(spokeOffices.size())
                .totalLinks(links.size())
                .totalActiveTrucks((int) allTrucks.stream().filter(t -> !"MAINTENANCE".equalsIgnoreCase(t.getStatus())).count())
                .totalBagsInTransit(bagsInTransit)
                .build();
    }

    private Warehouse findClosestWarehouse(Warehouse source, List<Warehouse> candidates) {
        if (candidates == null || candidates.isEmpty()) return null;

        Warehouse closest = null;
        double minDist = Double.MAX_VALUE;

        for (Warehouse candidate : candidates) {
            if (candidate.getId().equals(source.getId())) continue;
            double dist = haversine(source.getLatitude(), source.getLongitude(), candidate.getLatitude(), candidate.getLongitude());
            if (dist < minDist) {
                minDist = dist;
                closest = candidate;
            }
        }
        return closest;
    }

    private int countActiveTransitsBetween(List<DispatchOrder> dispatches, Long wh1, Long wh2) {
        if (dispatches == null || wh1 == null || wh2 == null) return 0;
        return (int) dispatches.stream()
                .filter(d -> "IN_TRANSIT".equalsIgnoreCase(d.getStatus()))
                .filter(d -> d.getOriginWarehouse() != null && d.getDestWarehouse() != null)
                .filter(d -> (d.getOriginWarehouse().getId().equals(wh1) && d.getDestWarehouse().getId().equals(wh2))
                        || (d.getOriginWarehouse().getId().equals(wh2) && d.getDestWarehouse().getId().equals(wh1)))
                .count();
    }

    private double haversine(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Bán kính Trái Đất (km)
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
