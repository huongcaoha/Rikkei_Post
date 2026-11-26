package vn.rikkei.post.service;

import vn.rikkei.post.entity.DeliveryRoute;

import java.util.List;

public interface DeliveryRouteService {
    List<DeliveryRoute> getRoutes(Integer provinceId, Long postOfficeId, Long shipperId);
    List<DeliveryRoute> getRoutes(Integer provinceId, Long postOfficeId, Long shipperId, String routeType);
    DeliveryRoute getRouteById(Long id);
    DeliveryRoute createRoute(DeliveryRoute route);
    DeliveryRoute updateRoute(Long id, DeliveryRoute route);
    void deleteRoute(Long id);
    DeliveryRoute assignShipper(Long routeId, Long shipperId);
    DeliveryRoute findBestMatchingRoute(Integer provinceId, String wardName, String detailedAddress);
}
