package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.entity.DeliveryRoute;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.DeliveryRouteRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.DeliveryRouteService;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeliveryRouteServiceImpl implements DeliveryRouteService {

    private final DeliveryRouteRepository routeRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;

    @Override
    @Transactional(readOnly = true)
    public List<DeliveryRoute> getRoutes(Integer provinceId, Long postOfficeId, Long shipperId) {
        return getRoutes(provinceId, postOfficeId, shipperId, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DeliveryRoute> getRoutes(Integer provinceId, Long postOfficeId, Long shipperId, String routeType) {
        List<DeliveryRoute> list = routeRepository.findAll();

        return list.stream()
                .filter(r -> postOfficeId == null || postOfficeId.equals(r.getPostOfficeId()))
                .filter(r -> provinceId == null || provinceId.equals(r.getProvinceId()))
                .filter(r -> shipperId == null || shipperId.equals(r.getAssignedShipperId()))
                .filter(r -> {
                    if (routeType == null || routeType.isBlank() || "ALL".equalsIgnoreCase(routeType)) {
                        return true;
                    }
                    String currentType = r.getRouteType() != null ? r.getRouteType() : "MOTORBIKE_DELIVERY";
                    return currentType.equalsIgnoreCase(routeType.trim());
                })
                .sorted((a, b) -> Long.compare(b.getId() != null ? b.getId() : 0L, a.getId() != null ? a.getId() : 0L))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public DeliveryRoute getRouteById(Long id) {
        return routeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tuyến đường với ID: " + id));
    }

    @Override
    @Transactional
    public DeliveryRoute createRoute(DeliveryRoute route) {
        if (route.getRouteCode() == null || route.getRouteCode().isBlank()) {
            route.setRouteCode("ROUTE_" + System.currentTimeMillis());
        }
        enrichPostOfficeAndShipper(route);
        return routeRepository.save(route);
    }

    @Override
    @Transactional
    public DeliveryRoute updateRoute(Long id, DeliveryRoute updated) {
        DeliveryRoute existing = getRouteById(id);
        existing.setRouteName(updated.getRouteName());
        existing.setProvinceId(updated.getProvinceId());
        existing.setProvinceName(updated.getProvinceName());
        existing.setDistrictName(updated.getDistrictName());
        existing.setWardName(updated.getWardName());
        existing.setPostOfficeId(updated.getPostOfficeId());
        existing.setAssignedShipperId(updated.getAssignedShipperId());
        existing.setStreetKeywords(updated.getStreetKeywords());
        existing.setDescription(updated.getDescription());
        if (updated.getRouteType() != null && !updated.getRouteType().isBlank()) {
            existing.setRouteType(updated.getRouteType().trim().toUpperCase());
        }
        if (updated.getIsActive() != null) {
            existing.setIsActive(updated.getIsActive());
        }
        enrichPostOfficeAndShipper(existing);
        return routeRepository.save(existing);
    }

    @Override
    @Transactional
    public void deleteRoute(Long id) {
        routeRepository.deleteById(id);
    }

    @Override
    @Transactional
    public DeliveryRoute assignShipper(Long routeId, Long shipperId) {
        DeliveryRoute route = getRouteById(routeId);
        route.setAssignedShipperId(shipperId);
        enrichPostOfficeAndShipper(route);
        return routeRepository.save(route);
    }

    @Override
    @Transactional(readOnly = true)
    public DeliveryRoute findBestMatchingRoute(Integer provinceId, String wardName, String detailedAddress) {
        if (provinceId == null) {
            return null;
        }

        // 1. Tìm tuyến đường khớp với Xã/Phường
        List<DeliveryRoute> candidateRoutes;
        if (wardName != null && !wardName.isBlank()) {
            candidateRoutes = routeRepository.findMatchingRoutes(provinceId, wardName.trim());
            if (!candidateRoutes.isEmpty()) {
                return candidateRoutes.get(0);
            }
        }

        // 2. Nếu không khớp theo xã/phường, tìm theo từ khóa đường phố trong địa chỉ chi tiết
        if (detailedAddress != null && !detailedAddress.isBlank()) {
            List<DeliveryRoute> allProvRoutes = routeRepository.findByProvinceIdAndIsActiveTrue(provinceId);
            String lowerAddr = detailedAddress.toLowerCase();
            for (DeliveryRoute route : allProvRoutes) {
                if (route.getStreetKeywords() != null && !route.getStreetKeywords().isBlank()) {
                    String[] keywords = route.getStreetKeywords().split("[,;]");
                    for (String kw : keywords) {
                        String cleanKw = kw.trim().toLowerCase();
                        if (!cleanKw.isEmpty() && lowerAddr.contains(cleanKw)) {
                            log.info("Khớp tuyến đường thành công theo từ khóa phố: {} (Từ khóa: {}) cho địa chỉ: {}",
                                    route.getRouteName(), cleanKw, detailedAddress);
                            return route;
                        }
                    }
                }
            }
        }

        // 3. Nếu không khớp tuyến cụ thể nào, trả về null để bưu cục tự điều phối (tránh gán nhầm sang bưu cục/tuyến khác)
        return null;
    }

    private void enrichPostOfficeAndShipper(DeliveryRoute route) {
        if (route.getRouteType() == null || route.getRouteType().isBlank()) {
            route.setRouteType("MOTORBIKE_DELIVERY");
        }
        if (route.getPostOfficeId() != null) {
            warehouseRepository.findById(route.getPostOfficeId()).ifPresent(wh -> {
                route.setPostOfficeName(wh.getName());
            });
        }
        if (route.getAssignedShipperId() != null) {
            userRepository.findById(route.getAssignedShipperId()).ifPresent(shipper -> {
                route.setAssignedShipperName(shipper.getFullName());
                route.setAssignedShipperPhone(shipper.getPhoneNumber());
            });
        } else {
            route.setAssignedShipperName(null);
            route.setAssignedShipperPhone(null);
        }
    }
}
