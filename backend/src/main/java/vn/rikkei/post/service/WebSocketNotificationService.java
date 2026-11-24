package vn.rikkei.post.service;

import vn.rikkei.post.dto.order.OrderResponse;

public interface WebSocketNotificationService {
    void notifyOrderCreated(OrderResponse order);
    void notifyOrderStatusUpdated(OrderResponse order, String previousStatus, String actorName, String note);
    void notifyShipperAssigned(OrderResponse order, Long shipperId, String taskType);
    void notifyOrderTracking(String trackingCode, String status, String message);
    void notifyGeneric(String destination, Object payload);
}
