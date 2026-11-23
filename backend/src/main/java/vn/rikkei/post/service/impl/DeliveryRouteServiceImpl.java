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
        if (shipperId != null) {
            return routeRepository.findByAssignedShipperId(shipperId);
        }
        if (postOfficeId != null) {
            return routeRepository.findByPostOfficeId(postOfficeId);
        }
        if (provinceId != null) {
            return routeRepository.findByProvinceId(provinceId);
        }
        return routeRepository.findAll();
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

        List<DeliveryRoute> candidateRoutes;
        if (wardName != null && !wardName.isBlank()) {
            candidateRoutes = routeRepository.findMatchingRoutes(provinceId, wardName.trim());
        } else {
            candidateRoutes = routeRepository.findByProvinceIdAndIsActiveTrue(provinceId);
        }

        if (candidateRoutes.isEmpty()) {
            // Thử lấy bất kỳ tuyến nào thuộc tỉnh
            candidateRoutes = routeRepository.findByProvinceIdAndIsActiveTrue(provinceId);
        }

        if (candidateRoutes.isEmpty()) {
            return null;
        }

        // Nếu có địa chỉ chi tiết, quét tìm tuyến có từ khóa đường phố khớp nhất
        if (detailedAddress != null && !detailedAddress.isBlank()) {
            String lowerAddr = detailedAddress.toLowerCase();
            for (DeliveryRoute route : candidateRoutes) {
                if (route.getStreetKeywords() != null && !route.getStreetKeywords().isBlank()) {
                    String[] keywords = route.getStreetKeywords().split("[,;]");
                    for (String kw : keywords) {
                        String cleanKw = kw.trim().toLowerCase();
                        if (!cleanKw.isEmpty() && lowerAddr.contains(cleanKw)) {
                            log.info("Khớp tuyến đường thành công: {} (Từ khóa: {}) cho địa chỉ: {}",
                                    route.getRouteName(), cleanKw, detailedAddress);
                            return route;
                        }
                    }
                }
            }
        }

        // Nếu không khớp từ khóa cụ thể, trả về tuyến đầu tiên của xã/phường đó
        return candidateRoutes.get(0);
    }

    private void enrichPostOfficeAndShipper(DeliveryRoute route) {
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
