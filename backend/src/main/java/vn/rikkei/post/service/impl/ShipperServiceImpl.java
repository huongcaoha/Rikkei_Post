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

import java.math.BigDecimal;
import java.time.LocalDate;
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
    public List<OrderResponse> getMyAssignedOrders(Long shipperId, String category, LocalDate startDate, LocalDate endDate) {
        List<Order> orders = orderRepository.findByAssignedShipperId(shipperId);

        // 1. Phân loại theo category yêu cầu của shipper
        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            String cat = category.toUpperCase().trim();
            switch (cat) {
                case "PICKUP_PENDING":
                case "PICKUP":
                    // 1. Đơn hàng cần lấy tại shop: status CREATED
                    orders = orders.stream()
                            .filter(o -> "CREATED".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "PICKED_UP":
                    // 2. Đơn hàng đã lấy của shop: status PICKED_UP
                    orders = orders.stream()
                            .filter(o -> "PICKED_UP".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "IN_WAREHOUSE":
                case "AT_SORTING_HUB":
                    // 3. Đơn hàng đã giao cho kho: status AT_SORTING_HUB hoặc IN_TRANSIT
                    orders = orders.stream()
                            .filter(o -> "AT_SORTING_HUB".equalsIgnoreCase(o.getCurrentStatus()) || "IN_TRANSIT".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "DELIVERING":
                case "DELIVERY":
                    // 4. Đơn hàng đã lấy ở kho mang đi giao: status DELIVERING
                    orders = orders.stream()
                            .filter(o -> "DELIVERING".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "DELIVERED":
                    // 5. Đơn hàng đã giao cho khách: status DELIVERED
                    orders = orders.stream()
                            .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "DELIVERY_FAILED":
                    // 6. Đơn hàng không giao được: status DELIVERY_FAILED
                    orders = orders.stream()
                            .filter(o -> "DELIVERY_FAILED".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "COD_COLLECTED":
                    // 7. Số tiền đã thu được: các đơn đã giao thành công (status DELIVERED)
                    orders = orders.stream()
                            .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                default:
                    break;
            }
        }

        // 2. Lọc theo khoảng ngày (startDate, endDate)
        if (startDate != null || endDate != null) {
            orders = orders.stream()
                    .filter(o -> isMatchDate(o, category, startDate, endDate))
                    .collect(Collectors.toList());
        }

        return orders.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getShipperSummary(Long shipperId, LocalDate startDate, LocalDate endDate) {
        List<Order> orders = orderRepository.findByAssignedShipperId(shipperId);

        // Đếm theo từng phân loại chuẩn xác
        long pickupPending = orders.stream()
                .filter(o -> "CREATED".equalsIgnoreCase(o.getCurrentStatus()) && isMatchDate(o, "PICKUP_PENDING", startDate, endDate))
                .count();

        long pickedUp = orders.stream()
                .filter(o -> "PICKED_UP".equalsIgnoreCase(o.getCurrentStatus()) && isMatchDate(o, "PICKED_UP", startDate, endDate))
                .count();

        long inWarehouse = orders.stream()
                .filter(o -> ("AT_SORTING_HUB".equalsIgnoreCase(o.getCurrentStatus()) || "IN_TRANSIT".equalsIgnoreCase(o.getCurrentStatus()))
                        && isMatchDate(o, "IN_WAREHOUSE", startDate, endDate))
                .count();

        long delivering = orders.stream()
                .filter(o -> "DELIVERING".equalsIgnoreCase(o.getCurrentStatus()) && isMatchDate(o, "DELIVERING", startDate, endDate))
                .count();

        long delivered = orders.stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus()) && isMatchDate(o, "DELIVERED", startDate, endDate))
                .count();

        long deliveryFailed = orders.stream()
                .filter(o -> "DELIVERY_FAILED".equalsIgnoreCase(o.getCurrentStatus()) && isMatchDate(o, "DELIVERY_FAILED", startDate, endDate))
                .count();

        // Tính tiền COD & cước đã thu được từ các đơn giao thành công (DELIVERED)
        List<Order> deliveredOrders = orders.stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus()) && isMatchDate(o, "COD_COLLECTED", startDate, endDate))
                .collect(Collectors.toList());

        BigDecimal totalCodCollected = deliveredOrders.stream()
                .map(o -> o.getCodAmount() != null ? o.getCodAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalFeeCollected = deliveredOrders.stream()
                .filter(o -> "RECEIVER".equalsIgnoreCase(o.getPaymentParty()))
                .map(o -> o.getTotalFee() != null ? o.getTotalFee() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCollected = totalCodCollected.add(totalFeeCollected);

        long codOrdersCount = deliveredOrders.stream()
                .filter(o -> (o.getCodAmount() != null && o.getCodAmount().compareTo(BigDecimal.ZERO) > 0)
                        || ("RECEIVER".equalsIgnoreCase(o.getPaymentParty()) && o.getTotalFee() != null && o.getTotalFee().compareTo(BigDecimal.ZERO) > 0))
                .count();

        long totalAssigned = orders.stream()
                .filter(o -> isMatchDate(o, null, startDate, endDate))
                .count();

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalAssigned", totalAssigned);
        summary.put("pickupPending", pickupPending);
        summary.put("pickedUp", pickedUp);
        summary.put("inWarehouse", inWarehouse);
        summary.put("delivering", delivering);
        summary.put("delivered", delivered);
        summary.put("deliveryFailed", deliveryFailed);
        summary.put("totalCodCollected", totalCodCollected);
        summary.put("totalFeeCollected", totalFeeCollected);
        summary.put("totalCollected", totalCollected);
        summary.put("codOrdersCount", codOrdersCount);

        return summary;
    }

    private boolean isMatchDate(Order o, String category, LocalDate startDate, LocalDate endDate) {
        if (startDate == null && endDate == null) {
            return true;
        }

        LocalDateTime targetTime;
        if (category == null) {
            targetTime = o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt();
        } else {
            targetTime = switch (category.toUpperCase()) {
                case "PICKUP_PENDING", "PICKUP" -> o.getCreatedAt();
                case "PICKED_UP" -> o.getPickupCompletedAt() != null ? o.getPickupCompletedAt() : (o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt());
                case "DELIVERED", "COD_COLLECTED" -> o.getDeliveredAt() != null ? o.getDeliveredAt() : (o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt());
                default -> o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt();
            };
        }

        if (targetTime == null) {
            targetTime = o.getCreatedAt();
        }
        if (targetTime == null) {
            return true;
        }

        LocalDate orderDate = targetTime.toLocalDate();
        if (startDate != null && orderDate.isBefore(startDate)) {
            return false;
        }
        if (endDate != null && orderDate.isAfter(endDate)) {
            return false;
        }
        return true;
    }

    private void validateStatusTransition(Order order, String newStatus, User actor) {
        String current = order.getCurrentStatus() != null ? order.getCurrentStatus().toUpperCase().trim() : "CREATED";
        String target = newStatus != null ? newStatus.toUpperCase().trim() : "";

        if (current.equals(target)) {
            throw new IllegalStateException("Đơn hàng [" + order.getTrackingCode() + "] hiện đã ở trạng thái [" + current + "], không cần cập nhật lại.");
        }

        // 1. Kiểm tra Terminal states (Trạng thái kết thúc tuyệt đối không được sửa đổi)
        if ("DELIVERED".equals(current)) {
            throw new IllegalStateException("Đơn hàng [" + order.getTrackingCode() + "] ĐÃ GIAO THÀNH CÔNG (DELIVERED). Đây là trạng thái hoàn tất cuối cùng, tuyệt đối không được phép chỉnh sửa, hủy hoặc chuyển về trạng thái trước!");
        }
        if ("CANCELLED".equals(current)) {
            throw new IllegalStateException("Đơn hàng [" + order.getTrackingCode() + "] ĐÃ BỊ HỦY (CANCELLED), không thể thay đổi trạng thái!");
        }
        if ("RETURNED".equals(current)) {
            throw new IllegalStateException("Đơn hàng [" + order.getTrackingCode() + "] ĐÃ HOÀN TRẢ VỀ SHOP (RETURNED), không thể thay đổi trạng thái!");
        }

        // 2. Kiểm tra Thứ tự luân chuyển trạng thái (State machine lifecycle order)
        boolean isValidTransition = false;
        switch (current) {
            case "CREATED" -> {
                // Từ CREATED chỉ có thể sang: PICKED_UP (bưu tá lấy hàng), AT_SORTING_HUB (khách gửi tại bưu cục), hoặc CANCELLED (hủy đơn)
                if ("PICKED_UP".equals(target) || "AT_SORTING_HUB".equals(target) || "CANCELLED".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "PICKED_UP" -> {
                // Từ PICKED_UP (đã lấy của shop) bắt buộc phải nhập kho bưu cục (AT_SORTING_HUB)
                if ("AT_SORTING_HUB".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "AT_SORTING_HUB" -> {
                // Từ AT_SORTING_HUB chỉ có thể sang: DELIVERING (lấy hàng đi giao), IN_TRANSIT (vận chuyển liên bưu cục), hoặc RETURNING (chuyển hoàn)
                if ("DELIVERING".equals(target) || "IN_TRANSIT".equals(target) || "RETURNING".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "IN_TRANSIT" -> {
                // Từ IN_TRANSIT chỉ có thể nhập về bưu cục kế tiếp (AT_SORTING_HUB)
                if ("AT_SORTING_HUB".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "DELIVERING" -> {
                // Từ DELIVERING chỉ có thể sang: DELIVERED (giao thành công) hoặc DELIVERY_FAILED (giao thất bại)
                if ("DELIVERED".equals(target) || "DELIVERY_FAILED".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "DELIVERY_FAILED" -> {
                // Từ DELIVERY_FAILED chỉ có thể sang: DELIVERING (giao lại) hoặc RETURNING (chuyển hoàn)
                if ("DELIVERING".equals(target) || "RETURNING".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "RETURNING" -> {
                // Từ RETURNING chỉ có thể sang RETURNED (đã trả hàng về shop)
                if ("RETURNED".equals(target)) {
                    isValidTransition = true;
                }
            }
            default -> isValidTransition = false;
        }

        if (!isValidTransition) {
            throw new IllegalStateException("Quy trình trạng thái không hợp lệ: Không thể chuyển đơn hàng từ [" + current + "] sang [" + target + "]. Vui lòng tác nghiệp theo đúng thứ tự giao nhận!");
        }

        // 3. Kiểm tra Phân quyền người dùng (Role-based Authorization)
        if (actor != null && actor.getRoles() != null) {
            boolean isAdmin = actor.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
            boolean isWarehouseStaff = actor.getRoles().stream().anyMatch(r ->
                    "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(r.getRoleName()) ||
                    "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                    "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName())
            );
            boolean isShipper = actor.getRoles().stream().anyMatch(r -> "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()));
            boolean isMerchant = actor.getRoles().stream().anyMatch(r -> "ROLE_MERCHANT".equalsIgnoreCase(r.getRoleName()));

            // Shop chỉ được hủy đơn khi CREATED
            if (isMerchant && !isAdmin && !isWarehouseStaff && !isShipper) {
                if (!"CANCELLED".equals(target) || !"CREATED".equals(current)) {
                    throw new org.springframework.security.access.AccessDeniedException("Tài khoản Shop chỉ có quyền hủy đơn hàng khi đơn còn ở trạng thái Mới tạo (CREATED)!");
                }
            }

            // Nhập kho bưu cục (AT_SORTING_HUB) chỉ dành cho nhân viên kho / quản lý kho / admin
            if ("AT_SORTING_HUB".equals(target) && !isWarehouseStaff && !isAdmin) {
                throw new org.springframework.security.access.AccessDeniedException("Chỉ nhân viên kho hoặc quản lý bưu cục mới có quyền quét xác nhận nhập kho!");
            }

            // Bưu tá (chỉ có ROLE_SHIPPER) chỉ được thao tác: PICKED_UP, DELIVERING, DELIVERED, DELIVERY_FAILED
            if (isShipper && !isWarehouseStaff && !isAdmin) {
                List<String> shipperAllowedTargets = List.of("PICKED_UP", "DELIVERING", "DELIVERED", "DELIVERY_FAILED");
                if (!shipperAllowedTargets.contains(target)) {
                    throw new org.springframework.security.access.AccessDeniedException("Bưu tá không có quyền cập nhật trạng thái [" + target + "]!");
                }
            }
        }
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

        // Kiểm tra thứ tự trạng thái & phân quyền nghiêm ngặt
        validateStatusTransition(order, "PICKED_UP", shipper);

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

        // Kiểm tra thứ tự trạng thái & phân quyền nghiêm ngặt
        validateStatusTransition(order, "AT_SORTING_HUB", actor);

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

        // Kiểm tra thứ tự trạng thái & phân quyền nghiêm ngặt
        validateStatusTransition(order, status, actor);

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

    @Override
    @Transactional
    public OrderResponse scanOutForDelivery(Long shipperId, String trackingCode) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu gửi với mã vận đơn: " + cleanCode));

        User shipper = userRepository.findById(shipperId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin bưu tá!"));

        // Kiểm tra trạng thái: Đơn hàng bắt buộc phải đang ở kho bưu cục (AT_SORTING_HUB) mới được lấy đi giao!
        if ("DELIVERING".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] ĐÃ ĐƯỢC XUẤT KHO ĐI GIAO trước đó rồi! Vui lòng không quét lại.");
        }
        if ("DELIVERED".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] ĐÃ GIAO THÀNH CÔNG cho khách rồi! Không thể xuất kho đi giao lại.");
        }
        if (!"AT_SORTING_HUB".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] hiện đang ở trạng thái [" + order.getCurrentStatus() + "], chưa nhập kho bưu cục nên không thể lấy đi phát!");
        }

        validateStatusTransition(order, "DELIVERING", shipper);

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);

        order.setCurrentStatus("DELIVERING");
        order.setAssignedShipperId(shipperId);
        order.setAssignedShipperName(shipper.getFullName());
        order.setAssignedShipperPhone(shipper.getPhoneNumber());

        Order saved = orderRepository.save(order);

        String shipperDisplayName = formatPersonName("Bưu tá", shipper.getFullName());
        String receiverAddr = (order.getReceiverAddress() != null ? order.getReceiverAddress() : "")
                + (order.getReceiverWardName() != null ? ", " + order.getReceiverWardName() : "");

        String desc = String.format("%s (SĐT: %s) đã quét xuất kho bưu cục lấy kiện hàng đi phát đến người nhận (%s - %s) vào lúc %s.",
                shipperDisplayName,
                shipper.getPhoneNumber() != null ? shipper.getPhoneNumber() : "N/A",
                order.getReceiverName() != null ? order.getReceiverName() : "Khách hàng",
                receiverAddr,
                timeStr);

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status("DELIVERING")
                .locationType("POST_OFFICE")
                .locationId(order.getAssignedPostOfficeId() != null ? order.getAssignedPostOfficeId() : 1L)
                .locationName("Bưu cục khai thác phát")
                .description(desc)
                .actorId(shipperId)
                .actorName(shipperDisplayName + " (Xuất kho đi phát)")
                .deviceInfo("SHIPPER_MOBILE_SCANNER")
                .build();
        trackingLogRepository.save(logEntry);

        log.info("Shipper {} đã quét xuất kho đơn {} mang đi phát lúc {}", shipper.getFullName(), cleanCode, timeStr);
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
                .senderLat(order.getSenderLat())
                .senderLng(order.getSenderLng())
                .receiverName(order.getReceiverName())
                .receiverPhone(order.getReceiverPhone())
                .receiverAddress(order.getReceiverAddress())
                .receiverProvinceId(order.getReceiverProvinceId())
                .receiverWardName(order.getReceiverWardName())
                .receiverLat(order.getReceiverLat())
                .receiverLng(order.getReceiverLng())
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
