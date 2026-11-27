package vn.rikkei.post.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.kafka.MasterBagTransitKafkaEvent;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.OrderTrackingLog;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.OrderTrackingLogRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class MasterBagTransitProcessor {

    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final WarehouseRepository warehouseRepository;
    private final WebSocketNotificationService webSocketNotificationService;
    private final vn.rikkei.post.repository.DispatchOrderItemRepository dispatchOrderItemRepository;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss dd/MM/yyyy");

    @Transactional
    public void processTransitEvent(MasterBagTransitKafkaEvent event) {
        if (event == null || event.getEventType() == null) return;

        String timeStr = (event.getTimestamp() != null ? event.getTimestamp() : LocalDateTime.now()).format(TIME_FORMATTER);

        if ("DEPARTURE_TO_HUB".equalsIgnoreCase(event.getEventType())) {
            handleDepartureToHub(event, timeStr);
        } else if ("ARRIVED_AT_HUB".equalsIgnoreCase(event.getEventType())) {
            handleArrivedAtHub(event, timeStr);
        } else {
            log.warn("MasterBagTransitProcessor: Loại sự kiện không xác định: {}", event.getEventType());
        }
    }

    private void handleDepartureToHub(MasterBagTransitKafkaEvent event, String timeStr) {
        log.info("MasterBagTransitProcessor: Xử lý DEPARTURE_TO_HUB cho bao tải [{}] với {} đơn hàng",
                event.getBagCode(), event.getTrackingCodes() != null ? event.getTrackingCodes().size() : 0);

        List<String> codes = event.getTrackingCodes();
        if (codes == null || codes.isEmpty()) return;

        String truckInfo = (event.getTruckPlate() != null && !event.getTruckPlate().isBlank())
                ? " (Biển số: " + event.getTruckPlate() + ")"
                : "";

        String driverName = event.getDriverName() != null ? event.getDriverName() : "Tài xế trung chuyển";
        String driverPhone = event.getDriverPhone() != null ? " - SĐT: " + event.getDriverPhone() : "";

        for (String code : codes) {
            if (code == null || code.isBlank()) continue;
            String cleanCode = code.trim().toUpperCase();

            orderRepository.findByTrackingCode(cleanCode).ifPresent(order -> {
                order.setCurrentStatus("IN_TRANSIT");
                orderRepository.save(order);

                String desc = String.format("Tài xế %s%s%s đã quét nhận bao tải [%s] (Kẹp chì: %s) tại [%s] và đang vận chuyển trung chuyển về kho Hub đích [%s] vào lúc %s.",
                        driverName,
                        driverPhone,
                        truckInfo,
                        event.getBagCode(),
                        event.getSealNumber() != null ? event.getSealNumber() : "N/A",
                        event.getOriginWarehouseName() != null ? event.getOriginWarehouseName() : "Bưu cục gửi",
                        event.getDestWarehouseName() != null ? event.getDestWarehouseName() : "Kho Hub đích",
                        timeStr);

                OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                        .trackingCode(cleanCode)
                        .status("IN_TRANSIT")
                        .locationType("ON_ROAD")
                        .locationId(event.getOriginWarehouseId() != null ? event.getOriginWarehouseId() : 1L)
                        .locationName("Xe tải trung chuyển: " + (event.getTruckPlate() != null ? event.getTruckPlate() : driverName))
                        .description(desc)
                        .actorId(event.getDriverId() != null ? event.getDriverId() : 1L)
                        .actorName(driverName + " (Tài xế xe tải)")
                        .deviceInfo("TRUCK_DRIVER_APP")
                        .build();

                trackingLogRepository.save(trackingLog);

                try {
                    webSocketNotificationService.notifyOrderTracking(cleanCode, "IN_TRANSIT",
                            String.format("Đang trên xe tải trung chuyển về %s", event.getDestWarehouseName()));
                } catch (Exception ex) {
                    log.warn("Lỗi gửi thông báo realtime cho đơn {}: {}", cleanCode, ex.getMessage());
                }
            });
        }

        // Thông báo WebSocket toàn hệ thống
        try {
            Map<String, Object> msg = new HashMap<>();
            msg.put("type", "MASTER_BAG_IN_TRANSIT");
            msg.put("bagCode", event.getBagCode());
            msg.put("driverName", driverName);
            msg.put("truckPlate", event.getTruckPlate());
            msg.put("originWarehouseName", event.getOriginWarehouseName());
            msg.put("destWarehouseName", event.getDestWarehouseName());
            msg.put("status", "IN_TRANSIT");
            webSocketNotificationService.notifyGeneric("/topic/master-bags", msg);
            if (event.getDestWarehouseId() != null) {
                webSocketNotificationService.notifyGeneric("/topic/warehouse/" + event.getDestWarehouseId(), msg);
            }
        } catch (Exception ex) {
            log.warn("Lỗi gửi websocket generic: {}", ex.getMessage());
        }
    }

    private void handleArrivedAtHub(MasterBagTransitKafkaEvent event, String timeStr) {
        log.info("MasterBagTransitProcessor: Xử lý ARRIVED_AT_HUB cho bao tải [{}] với {} đơn hàng",
                event.getBagCode(), event.getTrackingCodes() != null ? event.getTrackingCodes().size() : 0);

        List<String> codes = event.getTrackingCodes();
        if (codes == null || codes.isEmpty()) return;

        Warehouse hub = event.getDestWarehouseId() != null
                ? warehouseRepository.findById(event.getDestWarehouseId()).orElse(null)
                : null;
        String hubName = hub != null ? hub.getName() : (event.getDestWarehouseName() != null ? event.getDestWarehouseName() : "Kho Hub trung chuyển");

        String opName = event.getOperatorName() != null ? event.getOperatorName() : "Nhân viên tiếp nhận kho Hub";

        for (String code : codes) {
            if (code == null || code.isBlank()) continue;
            String cleanCode = code.trim().toUpperCase();

            orderRepository.findByTrackingCode(cleanCode).ifPresent(order -> {
                order.setCurrentStatus("AT_SORTING_HUB");
                if (hub != null) {
                    order.setAssignedPostOfficeId(hub.getId());
                }
                order.setAssignedShipperId(null);
                order.setAssignedShipperName(null);
                order.setAssignedShipperPhone(null);
                orderRepository.save(order);

                String desc = String.format("Kho Hub trung chuyển [%s] đã quét tiếp nhận bao tải [%s] (Kẹp chì: %s) từ tài xế %s vào lúc %s. Người tiếp nhận: %s. Kiện hàng đã cập bến Hub an toàn và sẵn sàng chia chọn.",
                        hubName,
                        event.getBagCode(),
                        event.getSealNumber() != null ? event.getSealNumber() : "N/A",
                        event.getDriverName() != null ? event.getDriverName() : "xe tải",
                        timeStr,
                        opName);

                OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                        .trackingCode(cleanCode)
                        .status("AT_SORTING_HUB")
                        .locationType("HUB")
                        .locationId(hub != null ? hub.getId() : 1L)
                        .locationName("Kho Hub: " + hubName)
                        .description(desc)
                        .actorId(event.getOperatorId() != null ? event.getOperatorId() : 1L)
                        .actorName(opName + " (Nhân viên Hub)")
                        .deviceInfo("HUB_INBOUND_SCANNER")
                        .build();

                trackingLogRepository.save(trackingLog);

                try {
                    webSocketNotificationService.notifyOrderTracking(cleanCode, "AT_SORTING_HUB",
                            String.format("Đã đến kho Hub %s", hubName));
                } catch (Exception ex) {
                    log.warn("Lỗi gửi thông báo realtime cho đơn {}: {}", cleanCode, ex.getMessage());
                }
            });
        }

        // Đồng bộ trạng thái DispatchOrderItem nếu bao tải nằm trong chuyến xe điều vận
        try {
            dispatchOrderItemRepository.findFirstByBagCodeOrderByScannedAtDesc(event.getBagCode()).ifPresent(item -> {
                item.setIsReceivedAtDest(true);
                item.setReceivedAt(LocalDateTime.now());
                if (event.getOperatorId() != null) {
                    item.setReceiverUserId(event.getOperatorId());
                }
                if (event.getOperatorName() != null) {
                    item.setReceiverUserName(event.getOperatorName());
                }
                dispatchOrderItemRepository.save(item);

                vn.rikkei.post.entity.DispatchOrder dispatch = item.getDispatchOrder();
                if (dispatch != null) {
                    boolean allReceived = dispatch.getItems().stream()
                            .allMatch(it -> Boolean.TRUE.equals(it.getIsReceivedAtDest()) || it.getId().equals(item.getId()));

                    Map<String, Object> dispatchMsg = new HashMap<>();
                    dispatchMsg.put("type", "DISPATCH_BAG_RECEIVED");
                    dispatchMsg.put("bagCode", event.getBagCode());
                    dispatchMsg.put("sealNumber", event.getSealNumber());
                    dispatchMsg.put("dispatchId", dispatch.getId());
                    dispatchMsg.put("dispatchCode", dispatch.getDispatchCode());
                    dispatchMsg.put("status", dispatch.getStatus());
                    dispatchMsg.put("isReceivedAtDest", true);
                    dispatchMsg.put("allReceived", allReceived);
                    dispatchMsg.put("receiverUserName", event.getOperatorName());
                    dispatchMsg.put("receivedAt", LocalDateTime.now().toString());
                    dispatchMsg.put("message", String.format("Kho đích [%s] đã quét tiếp nhận bao tải [%s] của chuyến xe [%s]!",
                            hubName, event.getBagCode(), dispatch.getDispatchCode()));

                    webSocketNotificationService.notifyGeneric("/topic/dispatch-orders", dispatchMsg);
                    webSocketNotificationService.notifyGeneric("/topic/master-bags", dispatchMsg);
                    if (dispatch.getDriver() != null) {
                        webSocketNotificationService.notifyGeneric("/topic/driver/" + dispatch.getDriver().getId(), dispatchMsg);
                    }
                }
            });
        } catch (Exception ex) {
            log.warn("Lỗi đồng bộ DispatchOrderItem trong handleArrivedAtHub: {}", ex.getMessage());
        }

        // Thông báo WebSocket
        try {
            Map<String, Object> msg = new HashMap<>();
            msg.put("type", "MASTER_BAG_ARRIVED_AT_HUB");
            msg.put("bagCode", event.getBagCode());
            msg.put("sealNumber", event.getSealNumber());
            msg.put("hubName", hubName);
            msg.put("status", "ARRIVED_AT_HUB");
            msg.put("message", String.format("Bao tải [%s]%s đã cập bến và quét tiếp nhận vào kho Hub [%s] thành công!",
                    event.getBagCode(),
                    event.getSealNumber() != null ? " (Seal: " + event.getSealNumber() + ")" : "",
                    hubName));
            webSocketNotificationService.notifyGeneric("/topic/master-bags", msg);
            if (event.getDestWarehouseId() != null) {
                webSocketNotificationService.notifyGeneric("/topic/warehouse/" + event.getDestWarehouseId(), msg);
            }
        } catch (Exception ex) {
            log.warn("Lỗi gửi websocket generic: {}", ex.getMessage());
        }
    }
}
