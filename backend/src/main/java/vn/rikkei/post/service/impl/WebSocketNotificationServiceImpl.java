package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebSocketNotificationServiceImpl implements WebSocketNotificationService {

    private final SimpMessagingTemplate messagingTemplate;

    @Override
    public void notifyOrderCreated(OrderResponse order) {
        Map<String, Object> payload = createPayload("ORDER_CREATED", order,
                "Đơn hàng mới #" + order.getTrackingCode() + " đã được tạo thành công!");

        broadcastOrderEvent(order, payload);
    }

    @Override
    public void notifyOrderStatusUpdated(OrderResponse order, String previousStatus, String actorName, String note) {
        String msg = String.format("Đơn hàng #%s đã chuyển trạng thái sang [%s]%s",
                order.getTrackingCode(), order.getCurrentStatus(),
                note != null && !note.isBlank() ? " (" + note + ")" : "");
        Map<String, Object> payload = createPayload("ORDER_STATUS_UPDATED", order, msg);
        payload.put("previousStatus", previousStatus);
        payload.put("actorName", actorName);

        broadcastOrderEvent(order, payload);
    }

    @Override
    public void notifyShipperAssigned(OrderResponse order, Long shipperId, String taskType) {
        String taskDesc = "PICKUP".equalsIgnoreCase(taskType) ? "lấy hàng tại Shop" : "giao hàng cho khách";
        Map<String, Object> payload = createPayload("SHIPPER_ASSIGNED", order,
                String.format("Đơn hàng #%s đã được gán nhiệm vụ %s cho bưu tá!",
                        order.getTrackingCode(), taskDesc));
        payload.put("taskType", taskType);
        payload.put("shipperId", shipperId);

        broadcastOrderEvent(order, payload);
    }

    @Override
    public void notifyGeneric(String destination, Object payload) {
        try {
            messagingTemplate.convertAndSend(destination, payload);
        } catch (Exception e) {
            log.error("Lỗi gửi thông báo WebSocket tới {}: {}", destination, e.getMessage());
        }
    }

    private void broadcastOrderEvent(OrderResponse order, Map<String, Object> payload) {
        try {
            // 1. Kênh công khai chung cho tất cả các trang quản trị
            messagingTemplate.convertAndSend("/topic/orders", payload);

            // 2. Kênh chi tiết theo mã vận đơn (dành cho tra cứu thời gian thực của khách)
            if (order.getTrackingCode() != null) {
                messagingTemplate.convertAndSend("/topic/orders/" + order.getTrackingCode(), payload);
            }

            // 3. Kênh của bưu cục phụ trách (dành cho quản lý kho bưu cục)
            if (order.getAssignedPostOfficeId() != null) {
                messagingTemplate.convertAndSend("/topic/post-office/" + order.getAssignedPostOfficeId(), payload);
            }

            // 4. Kênh của bưu tá phụ trách (dành cho shipper)
            if (order.getAssignedShipperId() != null) {
                messagingTemplate.convertAndSend("/topic/shipper/" + order.getAssignedShipperId(), payload);
            }

            // 5. Kênh của shop / chủ đơn (dành cho merchant)
            if (order.getMerchantId() != null) {
                messagingTemplate.convertAndSend("/topic/merchant/" + order.getMerchantId(), payload);
            }

            log.info("Broadcast WebSocket thành công event [{}] cho mã #{}", payload.get("type"), order.getTrackingCode());
        } catch (Exception e) {
            log.error("Lỗi khi gửi WebSocket broadcast cho đơn #{}: {}", order.getTrackingCode(), e.getMessage());
        }
    }

    private Map<String, Object> createPayload(String type, OrderResponse order, String message) {
        Map<String, Object> map = new HashMap<>();
        map.put("type", type);
        map.put("trackingCode", order.getTrackingCode());
        map.put("status", order.getCurrentStatus());
        map.put("assignedPostOfficeId", order.getAssignedPostOfficeId());
        map.put("assignedShipperId", order.getAssignedShipperId());
        map.put("assignedShipperName", order.getAssignedShipperName());
        map.put("merchantId", order.getMerchantId());
        map.put("message", message);
        map.put("order", order);
        map.put("timestamp", LocalDateTime.now().toString());
        return map;
    }
}
