package vn.rikkei.post.service;

import vn.rikkei.post.dto.order.OrderResponse;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface ShipperService {
    List<OrderResponse> getMyAssignedOrders(Long shipperId, String category, LocalDate startDate, LocalDate endDate);
    Map<String, Object> getShipperSummary(Long shipperId, LocalDate startDate, LocalDate endDate);
    OrderResponse scanPickupOrder(Long shipperId, String trackingCode);
    OrderResponse scanInboundToPostOffice(Long shipperId, String trackingCode, Long warehouseId);
    OrderResponse updateDeliveryStatus(Long shipperId, String trackingCode, String status, String note);
}
