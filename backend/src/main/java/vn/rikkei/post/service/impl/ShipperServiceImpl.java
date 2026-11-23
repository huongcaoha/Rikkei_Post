package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.OrderTrackingLog;
import vn.rikkei.post.entity.ShipperAssignment;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.OrderTrackingLogRepository;
import vn.rikkei.post.repository.ShipperAssignmentRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.ShipperService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShipperServiceImpl implements ShipperService {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm:ss 'ngày' dd/MM/yyyy");

    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final ShipperAssignmentRepository assignmentRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;

    @Override
    @Transactional(readOnly = true)
    public List<OrderResponse> getMyAssignedOrders(Long shipperId, String taskType) {
        List<Order> orders = orderRepository.findByAssignedShipperId(shipperId);

        if ("PICKUP".equalsIgnoreCase(taskType)) {
            // Đơn cần lấy tại shop: các đơn được gán cho shipper, có phương thức DOOR_PICKUP và status là CREATED hoặc PICKED_UP
            orders = orders.stream()
                    .filter(o -> "DOOR_PICKUP".equalsIgnoreCase(o.getPickupType()))
                    .collect(Collectors.toList());
        } else if ("DELIVERY".equalsIgnoreCase(taskType)) {
            // Đơn giao: các đơn đang phát hoặc đã phát
            orders = orders.stream()
                    .filter(o -> List.of("DELIVERING", "DELIVERED", "DELIVERY_FAILED").contains(o.getCurrentStatus()))
                    .collect(Collectors.toList());
        }

        return orders.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getShipperSummary(Long shipperId) {
        List<Order> orders = orderRepository.findByAssignedShipperId(shipperId);

        long pickupPending = orders.stream()
                .filter(o -> "DOOR_PICKUP".equalsIgnoreCase(o.getPickupType()) && "CREATED".equalsIgnoreCase(o.getCurrentStatus()))
                .count();

        long pickedUp = orders.stream()
                .filter(o -> "PICKED_UP".equalsIgnoreCase(o.getCurrentStatus()))
                .count();

        long delivering = orders.stream()
                .filter(o -> "DELIVERING".equalsIgnoreCase(o.getCurrentStatus()))
                .count();

        long delivered = orders.stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus()))
                .count();

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalAssigned", orders.size());
        summary.put("pickupPending", pickupPending);
        summary.put("pickedUp", pickedUp);
        summary.put("delivering", delivering);
        summary.put("delivered", delivered);

        return summary;
    }

    private boolean isWarehouseAuthorized(User user) {
        if (user == null || user.getRoles() == null) return false;
        return user.getRoles().stream().anyMatch(r ->
                "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(r.getRoleName()) ||
                "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName())
        );
    }

    private String formatPersonName(String rolePrefix, String fullName) {
        if (fullName == null || fullName.isBlank()) return rolePrefix;
        if (fullName.toLowerCase().startsWith(rolePrefix.toLowerCase())) return fullName;
        return rolePrefix + " " + fullName;
    }

    private String getRoleTitle(User user) {
        if (user == null || user.getRoles() == null) return "Nhân viên";
        if (user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()))) {
            return "Quản trị viên";
        }
        if (user.getRoles().stream().anyMatch(r -> "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()))) {
            return "Quản lý Chi nhánh";
        }
        if (user.getRoles().stream().anyMatch(r -> "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(r.getRoleName()))) {
            return "Quản lý Bưu cục";
        }
        if (user.getRoles().stream().anyMatch(r -> "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(r.getRoleName()))) {
            return "Nhân viên khai thác kho";
        }
        if (user.getRoles().stream().anyMatch(r -> "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()))) {
            return "Bưu tá";
        }
        return "Nhân viên bưu chính";
    }

    @Override
    @Transactional
    public OrderResponse scanPickupOrder(Long shipperId, String trackingCode) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu gửi với mã vận đơn: " + cleanCode));

        User shipper = userRepository.findById(shipperId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin bưu tá!"));

        // KIỂM TRA ĐẶC BIỆT: Nếu đơn đã được lấy trước đó -> Báo cảnh báo rõ ràng!
        if (!"CREATED".equalsIgnoreCase(order.getCurrentStatus())) {
            String statusText = switch (order.getCurrentStatus()) {
                case "PICKED_UP" -> "Đã lấy hàng từ Shop thành công";
                case "AT_SORTING_HUB" -> "Đã nhập kho bưu cục";
                case "IN_TRANSIT" -> "Đang vận chuyển liên kết";
                case "DELIVERING" -> "Đang trên đường đi phát cho khách";
                case "DELIVERED" -> "Đã phát hàng thành công";
                default -> order.getCurrentStatus();
            };
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] ĐÃ ĐƯỢC LẤY trước đó rồi (Trạng thái hiện tại: " + statusText + ")! Vui lòng không thao tác lại.");
        }

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);

        // Cập nhật trạng thái đơn hàng sang PICKED_UP
        order.setCurrentStatus("PICKED_UP");
        order.setPickupCompletedAt(now);
        order.setAssignedShipperId(shipperId);
        order.setAssignedShipperName(shipper.getFullName());
        order.setAssignedShipperPhone(shipper.getPhoneNumber());

        Order saved = orderRepository.save(order);

        // Cập nhật ShipperAssignment (nếu có)
        assignmentRepository.findByTrackingCode(cleanCode).ifPresent(a -> {
            a.setStatus("SUCCESS");
            assignmentRepository.save(a);
        });

        String senderAddr = (order.getSenderAddress() != null ? order.getSenderAddress() : "")
                + (order.getSenderWardName() != null ? ", " + order.getSenderWardName() : "");

        String shipperDisplayName = formatPersonName("Bưu tá", shipper.getFullName());
        String desc = String.format("%s (SĐT: %s) đã lấy hàng thành công từ Shop/Người gửi (%s) vào lúc %s. Kiện hàng đang trên đường vận chuyển về kho bưu cục để làm thủ tục nhập kho.",
                shipperDisplayName,
                shipper.getPhoneNumber() != null ? shipper.getPhoneNumber() : "N/A",
                order.getSenderName() != null ? order.getSenderName() : "Shop",
                timeStr);

        // Ghi nhật ký hành trình chi tiết
        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status("PICKED_UP")
                .locationType("CUSTOMER_ADDRESS")
                .locationId(order.getAssignedPostOfficeId() != null ? order.getAssignedPostOfficeId() : 1L)
                .locationName("Địa chỉ người gửi: " + senderAddr)
                .description(desc)
                .actorId(shipperId)
                .actorName(shipperDisplayName + " (Lấy hàng)")
                .deviceInfo("SHIPPER_MOBILE_SCANNER")
                .build();
        trackingLogRepository.save(logEntry);

        log.info("Shipper {} đã quét lấy hàng thành công đơn: {} vào lúc {}", shipper.getFullName(), cleanCode, timeStr);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public OrderResponse scanInboundToPostOffice(Long userId, String trackingCode, Long warehouseId) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu gửi: " + cleanCode));

        User actor = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản thao tác!"));

        // KIỂM TRA PHÂN QUYỀN: Chỉ nhân viên kho hoặc quản lý kho/bưu cục mới có quyền nhập kho
        if (!isWarehouseAuthorized(actor)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Chỉ nhân viên kho hoặc quản lý bưu cục/kho mới có quyền xác nhận đơn hàng nhập kho! Bưu tá không thể thực hiện thao tác này.");
        }

        // KIỂM TRA ĐẶC BIỆT: Nếu đơn hàng đã nhập kho rồi -> Thông báo rõ ràng không thao tác lại
        if ("AT_SORTING_HUB".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] ĐÃ ĐƯỢC NHẬP KHO trước đó rồi! Vui lòng không quét lại.");
        }
        if (List.of("DELIVERING", "DELIVERED", "DELIVERY_FAILED").contains(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] hiện đang ở trạng thái [" + order.getCurrentStatus() + "], không thể nhập lại kho.");
        }

        Long targetWhId = warehouseId;
        if (targetWhId == null) {
            targetWhId = actor.getAssignedPostOfficeId();
        }
        if (targetWhId == null) {
            targetWhId = order.getAssignedPostOfficeId();
        }
        if (targetWhId == null) {
            targetWhId = 1L;
        }

        Warehouse wh = warehouseRepository.findById(targetWhId).orElse(null);
        String whName = wh != null ? wh.getName() + " (" + wh.getCode() + ")" : "Bưu cục tiếp nhận khai thác";

        order.setCurrentStatus("AT_SORTING_HUB");
        if (wh != null) {
            order.setAssignedPostOfficeId(wh.getId());
        }
        Order saved = orderRepository.save(order);

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);
        String roleTitle = getRoleTitle(actor);

        String shipperHandover = order.getAssignedShipperName() != null
                ? ". Bưu tá bàn giao kiện hàng: " + order.getAssignedShipperName() + (order.getAssignedShipperPhone() != null ? " (SĐT: " + order.getAssignedShipperPhone() + ")" : "")
                : "";

        String desc = String.format("Đơn hàng đã được nhập kho thành công tại %s vào lúc %s. Người thực hiện nhập kho: %s (%s - SĐT: %s)%s. Kiện hàng đã lưu kho an toàn và sẵn sàng chia chọn, phân tuyến phát.",
                whName,
                timeStr,
                actor.getFullName(),
                roleTitle,
                actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                shipperHandover);

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status("AT_SORTING_HUB")
                .locationType("POST_OFFICE")
                .locationId(targetWhId)
                .locationName("Kho bưu cục: " + whName)
                .description(desc)
                .actorId(userId)
                .actorName(actor.getFullName() + " (" + roleTitle + ")")
                .deviceInfo("POST_OFFICE_INBOUND_SCANNER")
                .build();
        trackingLogRepository.save(logEntry);

        log.info("Nhân sự kho {} ({}) đã quét nhập kho đơn hàng: {} tại {} vào lúc {}",
                actor.getFullName(), roleTitle, cleanCode, whName, timeStr);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public OrderResponse updateDeliveryStatus(Long userId, String trackingCode, String status, String note) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu gửi: " + cleanCode));

        User actor = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản thao tác!"));

        // KIỂM TRA PHÂN QUYỀN ĐẶC BIỆT: Nếu muốn chuyển sang AT_SORTING_HUB (nhập kho),
        // bắt buộc phải là nhân viên kho hoặc quản lý kho/bưu cục!
        if ("AT_SORTING_HUB".equalsIgnoreCase(status) && !isWarehouseAuthorized(actor)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Chỉ nhân viên kho hoặc quản lý bưu cục/kho mới có quyền xác nhận đơn hàng nhập kho! Bưu tá không có quyền cập nhật trạng thái này.");
        }

        // KIỂM TRA ĐẶC BIỆT: Tránh quét lặp đơn đã nhập kho hoặc đã lấy
        if ("AT_SORTING_HUB".equalsIgnoreCase(status) && "AT_SORTING_HUB".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] ĐÃ ĐƯỢC NHẬP KHO trước đó rồi! Vui lòng không cập nhật lại.");
        }
        if ("PICKED_UP".equalsIgnoreCase(status) && !"CREATED".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] ĐÃ ĐƯỢC LẤY trước đó rồi (Trạng thái hiện tại: " + order.getCurrentStatus() + ")! Vui lòng không thao tác lại.");
        }

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);
        String roleTitle = getRoleTitle(actor);

        order.setCurrentStatus(status);
        if ("PICKED_UP".equalsIgnoreCase(status)) {
            order.setPickupCompletedAt(now);
            if (order.getAssignedShipperId() == null && actor.getRoles().stream().anyMatch(r -> "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()))) {
                order.setAssignedShipperId(actor.getId());
                order.setAssignedShipperName(actor.getFullName());
                order.setAssignedShipperPhone(actor.getPhoneNumber());
            }
        } else if ("DELIVERED".equalsIgnoreCase(status)) {
            order.setDeliveredAt(now);
        } else if ("DELIVERY_FAILED".equalsIgnoreCase(status)) {
            order.setDeliveryAttempts(order.getDeliveryAttempts() + 1);
        }

        Order saved = orderRepository.save(order);

        String locationType;
        String locationName;
        String desc;
        String actorDisplayName;
        String deviceInfo;

        String noteSuffix = (note != null && !note.isBlank()) ? ". Ghi chú tác nghiệp: " + note.trim() : "";

        switch (status) {
            case "PICKED_UP" -> {
                locationType = "CUSTOMER_ADDRESS";
                String senderAddr = (order.getSenderAddress() != null ? order.getSenderAddress() : "")
                        + (order.getSenderWardName() != null ? ", " + order.getSenderWardName() : "");
                locationName = "Địa chỉ người gửi: " + senderAddr;
                String shipperDisplayName = formatPersonName("Bưu tá", actor.getFullName());
                desc = String.format("%s (SĐT: %s) đã lấy hàng thành công từ Shop/Người gửi (%s) vào lúc %s%s. Kiện hàng đang trên đường vận chuyển về kho bưu cục để làm thủ tục nhập kho.",
                        shipperDisplayName,
                        actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                        order.getSenderName() != null ? order.getSenderName() : "Shop",
                        timeStr,
                        noteSuffix);
                actorDisplayName = shipperDisplayName + " (Lấy hàng)";
                deviceInfo = "SHIPPER_APP";
            }
            case "AT_SORTING_HUB" -> {
                Long targetWhId = actor.getAssignedPostOfficeId() != null ? actor.getAssignedPostOfficeId() : order.getAssignedPostOfficeId();
                if (targetWhId == null) targetWhId = 1L;
                Warehouse wh = warehouseRepository.findById(targetWhId).orElse(null);
                String whName = wh != null ? wh.getName() + " (" + wh.getCode() + ")" : "Bưu cục / Kho khai thác";

                locationType = "POST_OFFICE";
                locationName = "Kho bưu cục: " + whName;
                String shipperHandover = order.getAssignedShipperName() != null
                        ? ". Bưu tá bàn giao kiện hàng: " + formatPersonName("Bưu tá", order.getAssignedShipperName()) + (order.getAssignedShipperPhone() != null ? " (SĐT: " + order.getAssignedShipperPhone() + ")" : "")
                        : "";
                desc = String.format("Đơn hàng đã được nhập kho thành công tại %s vào lúc %s. Người thực hiện nhập kho: %s (%s - SĐT: %s)%s%s. Kiện hàng đã lưu kho an toàn và sẵn sàng phân tuyến phát.",
                        whName,
                        timeStr,
                        actor.getFullName(),
                        roleTitle,
                        actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                        shipperHandover,
                        noteSuffix);
                actorDisplayName = actor.getFullName() + " (" + roleTitle + ")";
                deviceInfo = "POST_OFFICE_PORTAL";
            }
            case "DELIVERING" -> {
                locationType = "DELIVERY_POINT";
                String receiverAddr = (order.getReceiverAddress() != null ? order.getReceiverAddress() : "")
                        + (order.getReceiverWardName() != null ? ", " + order.getReceiverWardName() : "");
                locationName = "Địa chỉ người nhận: " + receiverAddr;
                String shipperDisplayName = formatPersonName("Bưu tá", actor.getFullName());
                desc = String.format("%s (SĐT: %s) đang trên đường giao hàng đến người nhận (%s - %s) vào lúc %s%s.",
                        shipperDisplayName,
                        actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                        order.getReceiverName() != null ? order.getReceiverName() : "Khách hàng",
                        receiverAddr,
                        timeStr,
                        noteSuffix);
                actorDisplayName = shipperDisplayName + " (Phát hàng)";
                deviceInfo = "SHIPPER_APP";
            }
            case "DELIVERED" -> {
                locationType = "DELIVERY_POINT";
                locationName = "Địa chỉ người nhận: " + (order.getReceiverAddress() != null ? order.getReceiverAddress() : "");
                String shipperDisplayName = formatPersonName("Bưu tá", actor.getFullName());
                desc = String.format("Đơn hàng đã được giao thành công cho người nhận (%s) vào lúc %s. Bưu tá phát: %s (SĐT: %s)%s. Khách hàng đã kiểm tra và nhận hàng.",
                        order.getReceiverName() != null ? order.getReceiverName() : "Khách hàng",
                        timeStr,
                        shipperDisplayName,
                        actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                        noteSuffix);
                actorDisplayName = shipperDisplayName + " (Phát hàng)";
                deviceInfo = "SHIPPER_APP";
            }
            case "DELIVERY_FAILED" -> {
                locationType = "DELIVERY_POINT";
                locationName = "Địa chỉ người nhận: " + (order.getReceiverAddress() != null ? order.getReceiverAddress() : "");
                String shipperDisplayName = formatPersonName("Bưu tá", actor.getFullName());
                String reason = (note != null && !note.isBlank()) ? note.trim() : "Khách hẹn lại thời gian phát hoặc không liên lạc được";
                desc = String.format("Giao hàng không thành công vào lúc %s. Bưu tá phụ trách: %s (SĐT: %s). Lý do phát thất bại: %s.",
                        timeStr,
                        shipperDisplayName,
                        actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                        reason);
                actorDisplayName = shipperDisplayName + " (Phát hàng)";
                deviceInfo = "SHIPPER_APP";
            }
            case "RETURNING" -> {
                locationType = "POST_OFFICE";
                locationName = "Trung tâm khai thác / Bưu cục hoàn hàng";
                String reason = (note != null && !note.isBlank()) ? note.trim() : "Giao thất bại nhiều lần hoặc người nhận từ chối nhận hàng";
                desc = String.format("Đơn hàng đang trong quá trình chuyển hoàn về cho Shop/Người gửi (%s) vào lúc %s. Người xác nhận chuyển hoàn: %s (%s). Lý do: %s.",
                        order.getSenderName() != null ? order.getSenderName() : "Shop",
                        timeStr,
                        actor.getFullName(),
                        roleTitle,
                        reason);
                actorDisplayName = actor.getFullName() + " (" + roleTitle + ")";
                deviceInfo = "POST_OFFICE_PORTAL";
            }
            default -> {
                locationType = "DELIVERY_POINT";
                locationName = "Địa chỉ người nhận: " + (order.getReceiverAddress() != null ? order.getReceiverAddress() : "");
                desc = String.format("Trạng thái đơn hàng được cập nhật sang [%s] vào lúc %s bởi %s (%s)%s.",
                        status,
                        timeStr,
                        actor.getFullName(),
                        roleTitle,
                        noteSuffix);
                actorDisplayName = actor.getFullName() + " (" + roleTitle + ")";
                deviceInfo = "LOGISTICS_PORTAL";
            }
        }

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status(status)
                .locationType(locationType)
                .locationId(order.getAssignedPostOfficeId() != null ? order.getAssignedPostOfficeId() : 1L)
                .locationName(locationName)
                .description(desc)
                .actorId(userId)
                .actorName(actorDisplayName)
                .deviceInfo(deviceInfo)
                .build();
        trackingLogRepository.save(logEntry);

        log.info("User {} ({}) đã cập nhật trạng thái đơn {} sang {} vào lúc {}",
                actor.getFullName(), roleTitle, cleanCode, status, timeStr);
        return mapToResponse(saved);
    }

    private OrderResponse mapToResponse(Order order) {
        return OrderResponse.builder()
                .id(order.getId())
                .trackingCode(order.getTrackingCode())
                .merchantId(order.getMerchantId())
                .senderName(order.getSenderName())
                .senderPhone(order.getSenderPhone())
                .senderAddress(order.getSenderAddress())
                .senderProvinceId(order.getSenderProvinceId())
                .senderWardName(order.getSenderWardName())
                .receiverName(order.getReceiverName())
                .receiverPhone(order.getReceiverPhone())
                .receiverAddress(order.getReceiverAddress())
                .receiverProvinceId(order.getReceiverProvinceId())
                .receiverWardName(order.getReceiverWardName())
                .itemName(order.getItemName())
                .itemValue(order.getItemValue())
                .actualWeightGram(order.getActualWeightGram())
                .volumetricWeightGram(order.getVolumetricWeightGram())
                .billableWeightGram(order.getBillableWeightGram())
                .shippingFee(order.getShippingFee())
                .insuranceFee(order.getInsuranceFee())
                .pickupType(order.getPickupType())
                .pickupFee(order.getPickupFee())
                .totalFee(order.getTotalFee())
                .codAmount(order.getCodAmount())
                .paymentParty(order.getPaymentParty())
                .serviceType(order.getServiceType())
                .routingCode(order.getRoutingCode())
                .currentStatus(order.getCurrentStatus())
                .deliveryAttempts(order.getDeliveryAttempts())
                .notes(order.getNotes())
                .assignedShipperId(order.getAssignedShipperId())
                .assignedShipperName(order.getAssignedShipperName())
                .assignedShipperPhone(order.getAssignedShipperPhone())
                .assignedPostOfficeId(order.getAssignedPostOfficeId())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
