package vn.rikkei.post.service;

import vn.rikkei.post.dto.order.OrderResponse;

import java.util.List;
import java.util.Map;

public interface ShipperService {
    List<OrderResponse> getMyAssignedOrders(Long shipperId, String taskType);
    Map<String, Object> getShipperSummary(Long shipperId);
    OrderResponse scanPickupOrder(Long shipperId, String trackingCode);
    OrderResponse scanInboundToPostOffice(Long shipperId, String trackingCode, Long warehouseId);
    OrderResponse updateDeliveryStatus(Long shipperId, String trackingCode, String status, String note);
}
