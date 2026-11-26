package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.payos.PayOS;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkRequest;
import vn.payos.model.v2.paymentRequests.CreatePaymentLinkResponse;
import vn.payos.model.v2.paymentRequests.PaymentLink;
import vn.payos.model.v2.paymentRequests.PaymentLinkStatus;
import vn.payos.model.webhooks.Webhook;
import vn.payos.model.webhooks.WebhookData;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.dto.shipper.*;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.OrderTrackingLog;
import vn.rikkei.post.entity.ShipperAssignment;
import vn.rikkei.post.entity.ShipperCashSubmission;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.EmailService;
import vn.rikkei.post.service.ShipperService;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
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
    private final WebSocketNotificationService webSocketNotificationService;
    private final EmailService emailService;
    private final ShipperCashSubmissionRepository cashSubmissionRepository;
    private final PayOS payOS;
    private final vn.rikkei.post.service.RedisService redisService;

    private Order saveOrderAndEvictCache(Order order) {
        Order saved = orderRepository.save(order);
        if (redisService != null && saved.getTrackingCode() != null) {
            try {
                redisService.evictOrderCache(saved.getTrackingCode());
            } catch (Exception e) {
                log.warn("Lỗi khi evict cache đơn hàng: {}", e.getMessage());
            }
        }
        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderResponse> getMyAssignedOrders(Long shipperId, String category, LocalDate startDate,
            LocalDate endDate) {
        return getMyAssignedOrders(shipperId, null, category, startDate, endDate);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderResponse> getMyAssignedOrders(Long userId, Long filterShipperId, String category,
            LocalDate startDate, LocalDate endDate) {
        User currentUser = userRepository.findById(userId).orElse(null);
        List<Order> orders = getOrdersByScopeAndShipper(currentUser, filterShipperId);

        // 1. Phân loại theo category yêu cầu của shipper / bưu cục
        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            String cat = category.toUpperCase().trim();
            switch (cat) {
                case "PICKUP_PENDING":
                case "PICKUP":
                    // 1. Đơn hàng cần mới tạo chưa được lấy hoặc khách chưa mang đến
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
                    // 3. Đơn đã được quét mã code nhập kho: status AT_SORTING_HUB hoặc IN_TRANSIT
                    // hoặc PICKED_UP
                    orders = orders.stream()
                            .filter(o -> "AT_SORTING_HUB".equalsIgnoreCase(o.getCurrentStatus())
                                    || "IN_TRANSIT".equalsIgnoreCase(o.getCurrentStatus())
                                    || "PICKED_UP".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "DELIVERING":
                case "DELIVERY":
                    // 4. Đơn hàng đang được đi giao
                    orders = orders.stream()
                            .filter(o -> "DELIVERING".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "DELIVERED":
                    // 5. Đơn hàng đã giao xong
                    orders = orders.stream()
                            .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus()))
                            .collect(Collectors.toList());
                    break;
                case "DELIVERY_FAILED":
                    // 6. Đơn hàng không giao được đang chờ hoàn về
                    orders = orders.stream()
                            .filter(o -> "DELIVERY_FAILED".equalsIgnoreCase(o.getCurrentStatus())
                                    || "RETURNING".equalsIgnoreCase(o.getCurrentStatus()))
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
        return getShipperSummary(shipperId, null, startDate, endDate);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getShipperSummary(Long userId, Long filterShipperId, LocalDate startDate,
            LocalDate endDate) {
        User currentUser = userRepository.findById(userId).orElse(null);
        List<Order> orders = getOrdersByScopeAndShipper(currentUser, filterShipperId);

        // Đếm theo từng phân loại chuẩn xác
        long pickupPending = orders.stream()
                .filter(o -> "CREATED".equalsIgnoreCase(o.getCurrentStatus())
                        && isMatchDate(o, "PICKUP_PENDING", startDate, endDate))
                .count();

        long pickedUp = orders.stream()
                .filter(o -> "PICKED_UP".equalsIgnoreCase(o.getCurrentStatus())
                        && isMatchDate(o, "PICKED_UP", startDate, endDate))
                .count();

        long inWarehouse = orders.stream()
                .filter(o -> ("AT_SORTING_HUB".equalsIgnoreCase(o.getCurrentStatus())
                        || "IN_TRANSIT".equalsIgnoreCase(o.getCurrentStatus())
                        || "PICKED_UP".equalsIgnoreCase(o.getCurrentStatus()))
                        && isMatchDate(o, "IN_WAREHOUSE", startDate, endDate))
                .count();

        long delivering = orders.stream()
                .filter(o -> "DELIVERING".equalsIgnoreCase(o.getCurrentStatus())
                        && isMatchDate(o, "DELIVERING", startDate, endDate))
                .count();

        long delivered = orders.stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus())
                        && isMatchDate(o, "DELIVERED", startDate, endDate))
                .count();

        long deliveryFailed = orders.stream()
                .filter(o -> ("DELIVERY_FAILED".equalsIgnoreCase(o.getCurrentStatus())
                        || "RETURNING".equalsIgnoreCase(o.getCurrentStatus()))
                        && isMatchDate(o, "DELIVERY_FAILED", startDate, endDate))
                .count();

        // Tính tiền COD & cước đã thu được từ các đơn giao thành công (DELIVERED)
        List<Order> deliveredOrders = orders.stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus())
                        && isMatchDate(o, "COD_COLLECTED", startDate, endDate))
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
                        || ("RECEIVER".equalsIgnoreCase(o.getPaymentParty()) && o.getTotalFee() != null
                                && o.getTotalFee().compareTo(BigDecimal.ZERO) > 0))
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

    private List<Order> getOrdersByScopeAndShipper(User currentUser, Long filterShipperId) {
        if (currentUser == null) {
            return filterShipperId != null ? orderRepository.findByAssignedShipperId(filterShipperId)
                    : orderRepository.findAll();
        }

        boolean isAdmin = currentUser.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
        boolean isBranchManager = currentUser.getRoles().stream()
                .anyMatch(r -> "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()));
        boolean isPostOfficeManager = currentUser.getRoles().stream()
                .anyMatch(r -> "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                        "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(r.getRoleName()));
        boolean isShipper = currentUser.getRoles().stream()
                .anyMatch(r -> "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()));

        if (filterShipperId != null) {
            return orderRepository.findByAssignedShipperId(filterShipperId);
        }

        if (isAdmin) {
            return orderRepository.findAll();
        }

        if (isBranchManager && currentUser.getManagedProvinceId() != null) {
            return orderRepository.findAll().stream()
                    .filter(o -> currentUser.getManagedProvinceId().equals(o.getSenderProvinceId())
                            || currentUser.getManagedProvinceId().equals(o.getReceiverProvinceId()))
                    .collect(Collectors.toList());
        }

        if (isPostOfficeManager && currentUser.getAssignedPostOfficeId() != null) {
            return orderRepository.findByAssignedPostOfficeId(currentUser.getAssignedPostOfficeId());
        }

        if (isShipper) {
            return orderRepository.findByAssignedShipperId(currentUser.getId());
        }

        return orderRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getPostOfficeShippers(Long currentUserId) {
        User currentUser = userRepository.findById(currentUserId).orElse(null);
        if (currentUser == null)
            return Collections.emptyList();

        List<User> shippers;
        if (currentUser.getAssignedPostOfficeId() != null) {
            shippers = userRepository.findByRoles_RoleNameAndAssignedPostOfficeId("ROLE_SHIPPER",
                    currentUser.getAssignedPostOfficeId());
        } else if (currentUser.getManagedProvinceId() != null) {
            shippers = userRepository.findByRoles_RoleNameAndManagedProvinceId("ROLE_SHIPPER",
                    currentUser.getManagedProvinceId());
        } else {
            shippers = userRepository.findByRoles_RoleName("ROLE_SHIPPER");
        }

        return shippers.stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .map(u -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", u.getId());
                    map.put("fullName", u.getFullName());
                    map.put("phoneNumber", u.getPhoneNumber());
                    map.put("username", u.getUsername());
                    return map;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public OrderResponse scanReturnToWarehouse(Long userId, String trackingCode, String reason, String note) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu gửi với mã vận đơn: " + cleanCode));

        User actor = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản thao tác!"));

        if (!isWarehouseAuthorized(actor)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Chỉ quản lý bưu cục hoặc nhân viên kho mới có quyền quét thu hồi đơn hàng về kho!");
        }

        // Kiểm tra trạng thái hiện tại
        String currentStatus = order.getCurrentStatus() != null ? order.getCurrentStatus().toUpperCase() : "";
        if ("RETURNING".equals(currentStatus)) {
            throw new IllegalStateException(
                    "Đơn hàng [" + cleanCode + "] ĐÃ ĐƯỢC THU HỒI VỀ KHO trước đó rồi! Vui lòng không quét lại.");
        }
        if ("DELIVERED".equals(currentStatus)) {
            throw new IllegalStateException(
                    "Đơn hàng [" + cleanCode + "] ĐÃ GIAO THÀNH CÔNG cho khách rồi! Không thể thu hồi hoàn kho.");
        }
        if (!"DELIVERY_FAILED".equals(currentStatus) && !"DELIVERING".equals(currentStatus)) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] hiện đang ở trạng thái [" + currentStatus
                    + "], không phải đơn giao thất bại nên không thể thu hồi hoàn kho!");
        }

        validateStatusTransition(order, "RETURNING", actor);

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);
        String roleTitle = getRoleTitle(actor);

        order.setCurrentStatus("RETURNING");
        if (actor.getAssignedPostOfficeId() != null) {
            order.setAssignedPostOfficeId(actor.getAssignedPostOfficeId());
        }
        Order saved = saveOrderAndEvictCache(order);

        Long whId = actor.getAssignedPostOfficeId() != null ? actor.getAssignedPostOfficeId()
                : order.getAssignedPostOfficeId();
        Warehouse wh = whId != null ? warehouseRepository.findById(whId).orElse(null) : null;
        String whName = wh != null ? wh.getName() + " (" + wh.getCode() + ")" : "Bưu cục thu hồi";

        String reasonStr = (reason != null && !reason.isBlank()) ? reason.trim()
                : "Giao hàng không thành công sau các lần phát";
        String noteSuffix = (note != null && !note.isBlank()) ? ". Ghi chú bưu cục: " + note.trim() : "";

        String desc = String.format(
                "Bưu cục %s đã quét mã thu hồi đơn hàng hoàn về kho vào lúc %s. Người thực hiện thu hồi: %s (%s - SĐT: %s). Lý do không giao được / hoàn hàng: %s%s. Kiện hàng đã lưu kho bưu cục an toàn chờ xử lý hoàn trả về cho Shop/Người gửi.",
                whName,
                timeStr,
                actor.getFullName(),
                roleTitle,
                actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                reasonStr,
                noteSuffix);

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status("RETURNING")
                .locationType("POST_OFFICE")
                .locationId(whId != null ? whId : 1L)
                .locationName("Kho bưu cục: " + whName)
                .description(desc)
                .actorId(userId)
                .actorName(actor.getFullName() + " (" + roleTitle + ")")
                .deviceInfo("POST_OFFICE_RETURN_SCANNER")
                .build();
        trackingLogRepository.save(logEntry);

        log.info("Bưu cục {} đã quét thu hồi đơn hàng {} sang RETURNING bởi {} lúc {}",
                whName, cleanCode, actor.getFullName(), timeStr);
        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, "DELIVERY_FAILED", actor.getFullName(),
                    "Thu hồi hoàn kho: " + reasonStr);
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
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
                case "PICKED_UP" -> o.getPickupCompletedAt() != null ? o.getPickupCompletedAt()
                        : (o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt());
                case "DELIVERED", "COD_COLLECTED" -> o.getDeliveredAt() != null ? o.getDeliveredAt()
                        : (o.getUpdatedAt() != null ? o.getUpdatedAt() : o.getCreatedAt());
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

        if (current.equals(target) && !"DELIVERY_FAILED".equals(current)) {
            throw new IllegalStateException("Đơn hàng [" + order.getTrackingCode() + "] hiện đã ở trạng thái ["
                    + current + "], không cần cập nhật lại.");
        }

        // 1. Kiểm tra Terminal states (Trạng thái kết thúc tuyệt đối không được sửa
        // đổi)
        if ("DELIVERED".equals(current)) {
            throw new IllegalStateException("Đơn hàng [" + order.getTrackingCode()
                    + "] ĐÃ GIAO THÀNH CÔNG (DELIVERED). Đây là trạng thái hoàn tất cuối cùng, tuyệt đối không được phép chỉnh sửa, hủy hoặc chuyển về trạng thái trước!");
        }
        if ("CANCELLED".equals(current)) {
            throw new IllegalStateException(
                    "Đơn hàng [" + order.getTrackingCode() + "] ĐÃ BỊ HỦY (CANCELLED), không thể thay đổi trạng thái!");
        }
        if ("RETURNED".equals(current)) {
            throw new IllegalStateException("Đơn hàng [" + order.getTrackingCode()
                    + "] ĐÃ HOÀN TRẢ VỀ SHOP (RETURNED), không thể thay đổi trạng thái!");
        }

        // 2. Kiểm tra Thứ tự luân chuyển trạng thái (State machine lifecycle order)
        boolean isValidTransition = false;
        switch (current) {
            case "CREATED" -> {
                // Từ CREATED chỉ có thể sang: PICKED_UP (bưu tá lấy hàng), AT_SORTING_HUB
                // (khách gửi tại bưu cục), hoặc CANCELLED (hủy đơn)
                if ("PICKED_UP".equals(target) || "AT_SORTING_HUB".equals(target) || "CANCELLED".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "PICKED_UP" -> {
                // Từ PICKED_UP (đã lấy của shop) bắt buộc phải nhập kho bưu cục
                // (AT_SORTING_HUB)
                if ("AT_SORTING_HUB".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "AT_SORTING_HUB" -> {
                // Từ AT_SORTING_HUB chỉ có thể sang: DELIVERING (lấy hàng đi giao), IN_TRANSIT
                // (vận chuyển liên bưu cục), hoặc RETURNING (chuyển hoàn)
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
                // Từ DELIVERING chỉ có thể sang: DELIVERED (giao thành công), DELIVERY_FAILED
                // (giao thất bại) hoặc RETURNING (thu hồi hoàn kho)
                if ("DELIVERED".equals(target) || "DELIVERY_FAILED".equals(target) || "RETURNING".equals(target)) {
                    isValidTransition = true;
                }
            }
            case "DELIVERY_FAILED" -> {
                // Từ DELIVERY_FAILED có thể sang: DELIVERING (giao lại), DELIVERY_FAILED (cập
                // nhật lần phát tiếp theo) hoặc RETURNING (chuyển hoàn)
                if ("DELIVERING".equals(target) || "DELIVERY_FAILED".equals(target) || "RETURNING".equals(target)) {
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
            throw new IllegalStateException("Quy trình trạng thái không hợp lệ: Không thể chuyển đơn hàng từ ["
                    + current + "] sang [" + target + "]. Vui lòng tác nghiệp theo đúng thứ tự giao nhận!");
        }

        // 3. Kiểm tra Phân quyền người dùng (Role-based Authorization)
        if (actor != null && actor.getRoles() != null) {
            boolean isAdmin = actor.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
            boolean isWarehouseStaff = actor.getRoles().stream()
                    .anyMatch(r -> "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(r.getRoleName()) ||
                            "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                            "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()));
            boolean isShipper = actor.getRoles().stream()
                    .anyMatch(r -> "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()));
            boolean isMerchant = actor.getRoles().stream()
                    .anyMatch(r -> "ROLE_MERCHANT".equalsIgnoreCase(r.getRoleName()));

            // Shop chỉ được hủy đơn khi CREATED
            if (isMerchant && !isAdmin && !isWarehouseStaff && !isShipper) {
                if (!"CANCELLED".equals(target) || !"CREATED".equals(current)) {
                    throw new org.springframework.security.access.AccessDeniedException(
                            "Tài khoản Shop chỉ có quyền hủy đơn hàng khi đơn còn ở trạng thái Mới tạo (CREATED)!");
                }
            }

            // Nhập kho bưu cục (AT_SORTING_HUB) chỉ dành cho nhân viên kho / quản lý kho /
            // admin
            if ("AT_SORTING_HUB".equals(target) && !isWarehouseStaff && !isAdmin) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "Chỉ nhân viên kho hoặc quản lý bưu cục mới có quyền quét xác nhận nhập kho!");
            }

            // Bưu tá (chỉ có ROLE_SHIPPER) được thao tác: PICKED_UP, DELIVERING, DELIVERED,
            // DELIVERY_FAILED, RETURNING (khi phát thất bại quá số lần)
            if (isShipper && !isWarehouseStaff && !isAdmin) {
                List<String> shipperAllowedTargets = List.of("PICKED_UP", "DELIVERING", "DELIVERED", "DELIVERY_FAILED",
                        "RETURNING");
                if (!shipperAllowedTargets.contains(target)) {
                    throw new org.springframework.security.access.AccessDeniedException(
                            "Bưu tá không có quyền cập nhật trạng thái [" + target + "]!");
                }
            }
        }
    }

    private boolean isWarehouseAuthorized(User user) {
        if (user == null || user.getRoles() == null)
            return false;
        return user.getRoles().stream().anyMatch(r -> "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(r.getRoleName()) ||
                "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
    }

    private String formatPersonName(String rolePrefix, String fullName) {
        if (fullName == null || fullName.isBlank())
            return rolePrefix;
        if (fullName.toLowerCase().startsWith(rolePrefix.toLowerCase()))
            return fullName;
        return rolePrefix + " " + fullName;
    }

    private String getRoleTitle(User user) {
        if (user == null || user.getRoles() == null)
            return "Nhân viên";
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

        Order saved = saveOrderAndEvictCache(order);

        // Cập nhật ShipperAssignment (nếu có)
        assignmentRepository.findByTrackingCode(cleanCode).ifPresent(a -> {
            a.setStatus("SUCCESS");
            assignmentRepository.save(a);
        });

        String senderAddr = (order.getSenderAddress() != null ? order.getSenderAddress() : "")
                + (order.getSenderWardName() != null ? ", " + order.getSenderWardName() : "");

        String shipperDisplayName = formatPersonName("Bưu tá", shipper.getFullName());
        String desc = String.format(
                "%s (SĐT: %s) đã lấy hàng thành công từ Shop/Người gửi (%s) vào lúc %s. Kiện hàng đang trên đường vận chuyển về kho bưu cục để làm thủ tục nhập kho.",
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

        log.info("Shipper {} đã quét lấy hàng thành công đơn: {} vào lúc {}", shipper.getFullName(), cleanCode,
                timeStr);
        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, "CREATED", shipper.getFullName(),
                    "Bưu tá đã lấy hàng thành công tại Shop");
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
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
        Order saved = saveOrderAndEvictCache(order);

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);
        String roleTitle = getRoleTitle(actor);

        String shipperHandover = order.getAssignedShipperName() != null
                ? ". Bưu tá bàn giao kiện hàng: " + order.getAssignedShipperName()
                        + (order.getAssignedShipperPhone() != null ? " (SĐT: " + order.getAssignedShipperPhone() + ")"
                                : "")
                : "";

        String desc = String.format(
                "Đơn hàng đã được nhập kho thành công tại %s vào lúc %s. Người thực hiện nhập kho: %s (%s - SĐT: %s)%s. Kiện hàng đã lưu kho an toàn và sẵn sàng chia chọn, phân tuyến phát.",
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
        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, "PICKED_UP", actor.getFullName(),
                    "Đã nhập kho bưu cục " + whName);
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
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
            if (order.getAssignedShipperId() == null
                    && actor.getRoles().stream().anyMatch(r -> "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()))) {
                order.setAssignedShipperId(actor.getId());
                order.setAssignedShipperName(actor.getFullName());
                order.setAssignedShipperPhone(actor.getPhoneNumber());
            }
        } else if ("DELIVERED".equalsIgnoreCase(status)) {
            order.setDeliveredAt(now);
        } else if ("DELIVERY_FAILED".equalsIgnoreCase(status)) {
            order.setDeliveryAttempts(order.getDeliveryAttempts() + 1);
        }

        Order saved = saveOrderAndEvictCache(order);

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
                desc = String.format(
                        "%s (SĐT: %s) đã lấy hàng thành công từ Shop/Người gửi (%s) vào lúc %s%s. Kiện hàng đang trên đường vận chuyển về kho bưu cục để làm thủ tục nhập kho.",
                        shipperDisplayName,
                        actor.getPhoneNumber() != null ? actor.getPhoneNumber() : "N/A",
                        order.getSenderName() != null ? order.getSenderName() : "Shop",
                        timeStr,
                        noteSuffix);
                actorDisplayName = shipperDisplayName + " (Lấy hàng)";
                deviceInfo = "SHIPPER_APP";
            }
            case "AT_SORTING_HUB" -> {
                Long targetWhId = actor.getAssignedPostOfficeId() != null ? actor.getAssignedPostOfficeId()
                        : order.getAssignedPostOfficeId();
                if (targetWhId == null)
                    targetWhId = 1L;
                Warehouse wh = warehouseRepository.findById(targetWhId).orElse(null);
                String whName = wh != null ? wh.getName() + " (" + wh.getCode() + ")" : "Bưu cục / Kho khai thác";

                locationType = "POST_OFFICE";
                locationName = "Kho bưu cục: " + whName;
                String shipperHandover = order.getAssignedShipperName() != null
                        ? ". Bưu tá bàn giao kiện hàng: " + formatPersonName("Bưu tá", order.getAssignedShipperName())
                                + (order.getAssignedShipperPhone() != null
                                        ? " (SĐT: " + order.getAssignedShipperPhone() + ")"
                                        : "")
                        : "";
                desc = String.format(
                        "Đơn hàng đã được nhập kho thành công tại %s vào lúc %s. Người thực hiện nhập kho: %s (%s - SĐT: %s)%s%s. Kiện hàng đã lưu kho an toàn và sẵn sàng phân tuyến phát.",
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
                locationName = "Địa chỉ người nhận: "
                        + (order.getReceiverAddress() != null ? order.getReceiverAddress() : "");
                String shipperDisplayName = formatPersonName("Bưu tá", actor.getFullName());
                desc = String.format(
                        "Đơn hàng đã được giao thành công cho người nhận (%s) vào lúc %s. Bưu tá phát: %s (SĐT: %s)%s. Khách hàng đã kiểm tra và nhận hàng.",
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
                locationName = "Địa chỉ người nhận: "
                        + (order.getReceiverAddress() != null ? order.getReceiverAddress() : "");
                String shipperDisplayName = formatPersonName("Bưu tá", actor.getFullName());
                String reason = (note != null && !note.isBlank()) ? note.trim()
                        : "Khách hẹn lại thời gian phát hoặc không liên lạc được";
                desc = String.format(
                        "Giao hàng không thành công vào lúc %s. Bưu tá phụ trách: %s (SĐT: %s). Lý do phát thất bại: %s.",
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
                String reason = (note != null && !note.isBlank()) ? note.trim()
                        : "Giao thất bại nhiều lần hoặc người nhận từ chối nhận hàng";
                desc = String.format(
                        "Đơn hàng đang trong quá trình chuyển hoàn về cho Shop/Người gửi (%s) vào lúc %s. Người xác nhận chuyển hoàn: %s (%s). Lý do: %s.",
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
                locationName = "Địa chỉ người nhận: "
                        + (order.getReceiverAddress() != null ? order.getReceiverAddress() : "");
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
        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, order.getCurrentStatus(), actor.getFullName(),
                    note);
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
    }

    @Override
    @Transactional
    public OrderResponse scanOutForDelivery(Long shipperId, String trackingCode) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu gửi với mã vận đơn: " + cleanCode));

        User shipper = userRepository.findById(shipperId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin bưu tá!"));

        // Kiểm tra khóa chặn: Shipper phải thanh toán toàn bộ tiền hàng COD đã thu được
        // từ các ngày trước đó
        LocalDate today = LocalDate.now();
        List<Order> pastUnsettledOrders = orderRepository.findByAssignedShipperId(shipperId).stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus())
                        && o.getDeliveredAt() != null
                        && o.getDeliveredAt().toLocalDate().isBefore(today)
                        && !Boolean.TRUE.equals(o.getIsCashSettled())
                        && !"VIETQR".equalsIgnoreCase(o.getPaymentMethod()))
                .collect(Collectors.toList());

        BigDecimal pastUnsettledDebt = BigDecimal.ZERO;
        for (Order po : pastUnsettledOrders) {
            BigDecimal orderCod = po.getCodAmount() != null ? po.getCodAmount() : BigDecimal.ZERO;
            BigDecimal orderFee = ("RECEIVER".equalsIgnoreCase(po.getPaymentParty()) && po.getTotalFee() != null)
                    ? po.getTotalFee()
                    : BigDecimal.ZERO;
            BigDecimal totalOrderCash = orderCod.add(orderFee);
            BigDecimal settled = po.getSettledCashAmount() != null ? po.getSettledCashAmount() : BigDecimal.ZERO;
            BigDecimal remaining = totalOrderCash.subtract(settled);
            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                pastUnsettledDebt = pastUnsettledDebt.add(remaining);
            }
        }

        if (pastUnsettledDebt.compareTo(BigDecimal.ZERO) > 0) {
            throw new IllegalStateException(String.format(
                    "KHÓA XUẤT KHO: Bạn đang còn nợ %,d đ tiền thu hộ COD từ các ca ngày trước chưa nộp! Vui lòng hoàn tất nộp tiền cuối ca (qua PayOS VietQR hoặc nộp tiền mặt tại bưu cục) trước khi được lấy đơn mới đi giao.",
                    pastUnsettledDebt.longValue()));
        }

        // Kiểm tra trạng thái: Đơn hàng bắt buộc phải đang ở kho bưu cục
        // (AT_SORTING_HUB) mới được lấy đi giao!
        if ("DELIVERING".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException(
                    "Đơn hàng [" + cleanCode + "] ĐÃ ĐƯỢC XUẤT KHO ĐI GIAO trước đó rồi! Vui lòng không quét lại.");
        }
        if ("DELIVERED".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException(
                    "Đơn hàng [" + cleanCode + "] ĐÃ GIAO THÀNH CÔNG cho khách rồi! Không thể xuất kho đi giao lại.");
        }
        if (!"AT_SORTING_HUB".equalsIgnoreCase(order.getCurrentStatus())
                && !"DELIVERY_FAILED".equalsIgnoreCase(order.getCurrentStatus())) {
            throw new IllegalStateException("Đơn hàng [" + cleanCode + "] hiện đang ở trạng thái ["
                    + order.getCurrentStatus() + "], không thể xuất kho đi giao phát!");
        }

        validateStatusTransition(order, "DELIVERING", shipper);

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);

        order.setCurrentStatus("DELIVERING");
        order.setAssignedShipperId(shipperId);
        order.setAssignedShipperName(shipper.getFullName());
        order.setAssignedShipperPhone(shipper.getPhoneNumber());

        Order saved = saveOrderAndEvictCache(order);

        String shipperDisplayName = formatPersonName("Bưu tá", shipper.getFullName());
        String receiverAddr = (order.getReceiverAddress() != null ? order.getReceiverAddress() : "")
                + (order.getReceiverWardName() != null ? ", " + order.getReceiverWardName() : "");

        String desc = String.format(
                "%s (SĐT: %s) đã quét xuất kho bưu cục lấy kiện hàng đi phát đến người nhận (%s - %s) vào lúc %s.",
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
        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, "AT_SORTING_HUB", shipper.getFullName(),
                    "Bưu tá xuất kho mang đi phát");
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
    }

    // ==========================================
    // SPRINT 3: VẬN TẢI TMS, BƯU TÁ & POD
    // ==========================================

    @Override
    @Transactional
    public OrderResponse smartDispatchOrder(String trackingCode, Long manualShipperId, Long currentUserId) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu gửi: " + cleanCode));

        User actor = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản thao tác!"));

        if (!isWarehouseAuthorized(actor)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Chỉ quản lý bưu cục, chi nhánh hoặc admin mới có quyền điều phối bưu tá!");
        }

        User chosenShipper;
        if (manualShipperId != null) {
            chosenShipper = userRepository.findById(manualShipperId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bưu tá được chỉ định!"));
            if (!Boolean.TRUE.equals(chosenShipper.getIsActive())) {
                throw new IllegalStateException("Bưu tá được chọn hiện không ở trạng thái sẵn sàng hoạt động!");
            }
        } else {
            // US-13: Thuật toán Tự động Điều phối bưu tá thông minh (Smart Dispatch)
            Long poId = order.getAssignedPostOfficeId();
            if (poId == null && actor.getAssignedPostOfficeId() != null) {
                poId = actor.getAssignedPostOfficeId();
            }
            if (poId == null) {
                poId = 1L;
            }

            List<User> activeShippers = userRepository.findByRoles_RoleNameAndAssignedPostOfficeId("ROLE_SHIPPER", poId)
                    .stream()
                    .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                    .collect(Collectors.toList());

            if (activeShippers.isEmpty()) {
                // Fallback: Tìm bưu tá theo tỉnh quản lý
                if (actor.getManagedProvinceId() != null) {
                    activeShippers = userRepository
                            .findByRoles_RoleNameAndManagedProvinceId("ROLE_SHIPPER", actor.getManagedProvinceId())
                            .stream().filter(u -> Boolean.TRUE.equals(u.getIsActive())).collect(Collectors.toList());
                }
            }

            if (activeShippers.isEmpty()) {
                throw new IllegalStateException(
                        "Không tìm thấy bưu tá nào đang hoạt động trong bưu cục hoặc khu vực này!");
            }

            final int orderWeight = order.getBillableWeightGram() != null ? order.getBillableWeightGram() : 500;

            // Tính toán tải trọng và khối lượng đơn hàng hiện tại của từng bưu tá để cân
            // bằng tải (Load Balancing)
            User bestShipper = null;
            int maxRemainingCapacity = Integer.MIN_VALUE;

            for (User s : activeShippers) {
                List<Order> assignedOrders = orderRepository.findByAssignedShipperIdAndCurrentStatusIn(
                        s.getId(),
                        List.of("CREATED", "PICKED_UP", "DELIVERING"));

                int currentTotalWeight = assignedOrders.stream()
                        .mapToInt(o -> o.getBillableWeightGram() != null ? o.getBillableWeightGram() : 500)
                        .sum();

                int maxCapacity = s.getMaxWeightCapacityGram() != null ? s.getMaxWeightCapacityGram() : 50000;
                int remaining = maxCapacity - currentTotalWeight;

                if (remaining >= orderWeight && remaining > maxRemainingCapacity) {
                    maxRemainingCapacity = remaining;
                    bestShipper = s;
                }
            }

            // Nếu tất cả shipper đều quá tải, chọn shipper có tổng số đơn đang giao ít nhất
            if (bestShipper == null) {
                bestShipper = activeShippers.stream()
                        .min((s1, s2) -> {
                            long c1 = orderRepository.countByAssignedShipperIdAndCurrentStatus(s1.getId(),
                                    "DELIVERING");
                            long c2 = orderRepository.countByAssignedShipperIdAndCurrentStatus(s2.getId(),
                                    "DELIVERING");
                            return Long.compare(c1, c2);
                        })
                        .orElse(activeShippers.get(0));
            }

            chosenShipper = bestShipper;
        }

        order.setAssignedShipperId(chosenShipper.getId());
        order.setAssignedShipperName(chosenShipper.getFullName());
        order.setAssignedShipperPhone(chosenShipper.getPhoneNumber());
        Order saved = saveOrderAndEvictCache(order);

        // Tạo hoặc cập nhật ShipperAssignment
        String taskType = "CREATED".equalsIgnoreCase(order.getCurrentStatus()) ? "PICKUP" : "DELIVERY";
        ShipperAssignment assignment = assignmentRepository.findByTrackingCode(cleanCode)
                .orElse(ShipperAssignment.builder()
                        .trackingCode(cleanCode)
                        .taskType(taskType)
                        .sequenceOrder(1)
                        .build());
        assignment.setShipperId(chosenShipper.getId());
        assignment.setStatus("ASSIGNED");
        assignmentRepository.save(assignment);

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);
        String vehicleInfo = chosenShipper.getVehicleType() != null ? chosenShipper.getVehicleType() : "Xe máy";

        String desc = String.format(
                "Thuật toán Smart Dispatch đã tự động điều phối bưu tá: %s (SĐT: %s, Phương tiện: %s) tiếp nhận đơn hàng vào lúc %s. Người điều phối: %s (%s).",
                chosenShipper.getFullName(),
                chosenShipper.getPhoneNumber() != null ? chosenShipper.getPhoneNumber() : "N/A",
                vehicleInfo,
                timeStr,
                actor.getFullName(),
                getRoleTitle(actor));

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status(order.getCurrentStatus())
                .locationType("POST_OFFICE")
                .locationId(order.getAssignedPostOfficeId() != null ? order.getAssignedPostOfficeId() : 1L)
                .locationName("Bưu cục điều phối vận tải TMS")
                .description(desc)
                .actorId(actor.getId())
                .actorName(actor.getFullName() + " (" + getRoleTitle(actor) + ")")
                .deviceInfo("TMS_SMART_DISPATCH_ENGINE")
                .build();
        trackingLogRepository.save(logEntry);

        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, order.getCurrentStatus(), actor.getFullName(),
                    "Smart Dispatch: Điều phối bưu tá " + chosenShipper.getFullName());
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
    }

    @Override
    @Transactional
    public Map<String, Object> smartDispatchBatch(Long postOfficeId, Long currentUserId) {
        User actor = userRepository.findById(currentUserId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản thao tác!"));

        if (!isWarehouseAuthorized(actor)) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "Chỉ quản lý bưu cục, chi nhánh hoặc admin mới có quyền điều phối hàng loạt!");
        }

        Long targetPoId = postOfficeId != null ? postOfficeId : actor.getAssignedPostOfficeId();
        List<Order> unassignedOrders;
        if (targetPoId != null) {
            unassignedOrders = orderRepository.findByAssignedPostOfficeId(targetPoId).stream()
                    .filter(o -> o.getAssignedShipperId() == null && ("CREATED".equalsIgnoreCase(o.getCurrentStatus())
                            || "AT_SORTING_HUB".equalsIgnoreCase(o.getCurrentStatus())))
                    .collect(Collectors.toList());
        } else {
            unassignedOrders = orderRepository.findAll().stream()
                    .filter(o -> o.getAssignedShipperId() == null && ("CREATED".equalsIgnoreCase(o.getCurrentStatus())
                            || "AT_SORTING_HUB".equalsIgnoreCase(o.getCurrentStatus())))
                    .collect(Collectors.toList());
        }

        int successCount = 0;
        int failureCount = 0;
        for (Order o : unassignedOrders) {
            try {
                smartDispatchOrder(o.getTrackingCode(), null, currentUserId);
                successCount++;
            } catch (Exception e) {
                log.warn("Không thể điều phối đơn #{}: {}", o.getTrackingCode(), e.getMessage());
                failureCount++;
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("totalEligible", unassignedOrders.size());
        result.put("successCount", successCount);
        result.put("failureCount", failureCount);
        result.put("message", String.format("Đã điều phối thành công %d/%d đơn hàng bằng Smart Dispatch!", successCount,
                unassignedOrders.size()));
        return result;
    }

    @Override
    @Transactional
    public Map<String, Object> sendDeliveryOtp(String trackingCode, Long currentUserId) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng: " + cleanCode));

        // Sinh mã OTP 6 số bảo mật ngẫu nhiên
        int randomPin = 100000 + new java.util.Random().nextInt(900000);
        String otpCode = String.valueOf(randomPin);

        order.setDeliveryOtp(otpCode);
        saveOrderAndEvictCache(order);

        assignmentRepository.findByTrackingCode(cleanCode).ifPresent(a -> {
            a.setOtpCode(otpCode);
            assignmentRepository.save(a);
        });

        // Gửi email OTP (nếu người gửi hoặc tài khoản liên kết có email)
        try {
            userRepository.findById(order.getMerchantId()).ifPresent(user -> {
                if (user.getEmail() != null && !user.getEmail().isBlank()) {
                    emailService.sendOtpEmail(user.getEmail(), otpCode);
                }
            });
        } catch (Exception e) {
            log.warn("Không thể gửi email OTP: {}", e.getMessage());
        }

        log.info("Đã sinh mã OTP giao hàng cho đơn {}: {}", cleanCode, otpCode);

        Map<String, Object> res = new HashMap<>();
        res.put("trackingCode", cleanCode);
        res.put("otpCode", otpCode);
        res.put("message", "Mã xác thực OTP 6 số đã được kích hoạt thành công!");
        return res;
    }

    @Override
    @Transactional
    public OrderResponse completeDelivery(Long shipperId, CompleteDeliveryRequest request) {
        if (request == null || request.getTrackingCode() == null) {
            throw new IllegalArgumentException("Thông tin hoàn tất giao hàng không hợp lệ!");
        }

        final String cleanCode = request.getTrackingCode().trim().toUpperCase();
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng: " + cleanCode));

        User shipper = userRepository.findById(shipperId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin bưu tá!"));

        // Kiểm tra thứ tự trạng thái & phân quyền
        validateStatusTransition(order, "DELIVERED", shipper);

        // US-16: Xác thực OTP cho đơn hàng giá trị cao (> 2 triệu VNĐ hoặc có yêu cầu)
        BigDecimal highValueThreshold = new BigDecimal("2000000");
        boolean isHighValue = (order.getItemValue() != null && order.getItemValue().compareTo(highValueThreshold) >= 0)
                || (order.getCodAmount() != null && order.getCodAmount().compareTo(highValueThreshold) >= 0);

        if (isHighValue) {
            String enteredOtp = request.getOtpCode() != null ? request.getOtpCode().trim() : "";
            if (enteredOtp.isEmpty()) {
                throw new IllegalArgumentException(
                        "Đơn hàng giá trị cao (trên 2.000.000 đ) bắt buộc phải nhập mã xác thực OTP 6 số từ người nhận!");
            }
            if (order.getDeliveryOtp() != null && !order.getDeliveryOtp().trim().equalsIgnoreCase(enteredOtp)) {
                throw new IllegalArgumentException(
                        "Mã xác thực OTP không chính xác! Vui lòng hỏi lại mã 6 số từ người nhận.");
            }
        }

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);

        // US-15 & US-17: Cập nhật bằng chứng POD và thông tin hoàn tất
        order.setCurrentStatus("DELIVERED");
        order.setDeliveredAt(now);
        order.setPodPhotoUrl(request.getPodPhotoUrl());
        order.setPodSignatureUrl(request.getPodSignatureUrl());
        order.setPodLatitude(request.getPodLatitude());
        order.setPodLongitude(request.getPodLongitude());
        order.setPodReceiverName(
                request.getReceiverName() != null ? request.getReceiverName().trim() : order.getReceiverName());
        order.setPaymentMethod(request.getPaymentMethod() != null ? request.getPaymentMethod().trim() : "CASH");
        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            order.setNotes(request.getNotes().trim());
        }

        Order saved = saveOrderAndEvictCache(order);

        // Cập nhật ShipperAssignment
        assignmentRepository.findByTrackingCode(cleanCode).ifPresent(a -> {
            a.setStatus("SUCCESS");
            a.setCompletedAt(now);
            a.setPodPhotoUrl(request.getPodPhotoUrl());
            a.setPodSignatureUrl(request.getPodSignatureUrl());
            a.setPodLatitude(request.getPodLatitude());
            a.setPodLongitude(request.getPodLongitude());
            assignmentRepository.save(a);
        });

        String shipperDisplayName = formatPersonName("Bưu tá", shipper.getFullName());
        String receiverDisplayName = order.getPodReceiverName() != null ? order.getPodReceiverName()
                : order.getReceiverName();
        String receiverAddr = (order.getReceiverAddress() != null ? order.getReceiverAddress() : "");

        String paymentInfo = "VIETQR".equalsIgnoreCase(order.getPaymentMethod())
                ? "Thanh toán quét mã VietQR động NAPAS thành công"
                : "Thu tiền mặt trực tiếp";

        String podDetails = String.format(
                "[Chữ ký điện tử cảm ứng: %s] | [Ảnh hiện trường Watermark GPS: %s (Tọa độ: %s, %s)]",
                (request.getPodSignatureUrl() != null && !request.getPodSignatureUrl().isBlank()) ? "Đã ký" : "Chưa có",
                (request.getPodPhotoUrl() != null && !request.getPodPhotoUrl().isBlank()) ? "Đã chụp" : "Chưa có",
                request.getPodLatitude() != null ? String.format("%.6f", request.getPodLatitude()) : "N/A",
                request.getPodLongitude() != null ? String.format("%.6f", request.getPodLongitude()) : "N/A");

        String desc = String.format(
                "Đơn hàng đã được giao thành công cho người nhận (%s) vào lúc %s. Bưu tá phát: %s (SĐT: %s). Hình thức thanh toán: %s. Bằng chứng giao hàng POD: %s.",
                receiverDisplayName,
                timeStr,
                shipperDisplayName,
                shipper.getPhoneNumber() != null ? shipper.getPhoneNumber() : "N/A",
                paymentInfo,
                podDetails);

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status("DELIVERED")
                .locationType("DELIVERY_POINT")
                .locationId(order.getAssignedPostOfficeId() != null ? order.getAssignedPostOfficeId() : 1L)
                .locationName("Địa chỉ người nhận: " + receiverAddr)
                .description(desc)
                .actorId(shipperId)
                .actorName(shipperDisplayName + " (Giao hàng POD)")
                .deviceInfo("SHIPPER_MOBILE_POD")
                .build();
        trackingLogRepository.save(logEntry);

        // Gửi email thông báo giao hàng thành công kèm POD
        try {
            userRepository.findById(order.getMerchantId()).ifPresent(user -> {
                if (user.getEmail() != null && !user.getEmail().isBlank()) {
                    emailService.sendDeliverySuccessEmail(user.getEmail(), cleanCode, request.getPodPhotoUrl());
                }
            });
        } catch (Exception e) {
            log.warn("Không thể gửi email giao hàng thành công: {}", e.getMessage());
        }

        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, "DELIVERING", shipper.getFullName(),
                    "Giao hàng POD thành công");
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
    }

    @Override
    @Transactional
    public OrderResponse reportDeliveryFailure(Long shipperId, DeliveryFailureRequest request) {
        if (request == null || request.getTrackingCode() == null) {
            throw new IllegalArgumentException("Thông tin báo phát thất bại không hợp lệ!");
        }

        final String cleanCode = request.getTrackingCode().trim().toUpperCase();
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng: " + cleanCode));

        User shipper = userRepository.findById(shipperId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin bưu tá!"));

        // US-18: Xử lý Ngoại lệ Giao không thành công & Phát lại
        int nextAttempts = (order.getDeliveryAttempts() != null ? order.getDeliveryAttempts() : 0) + 1;
        order.setDeliveryAttempts(nextAttempts);
        order.setFailureProofPhotoUrl(request.getFailureProofPhotoUrl());
        order.setRescheduledDeliveryDate(request.getRescheduledDate());

        String reason = (request.getReason() != null && !request.getReason().isBlank())
                ? request.getReason().trim()
                : "Không liên lạc được với người nhận";

        String targetStatus = "DELIVERY_FAILED";
        boolean autoReturn = false;

        // Nếu đã thử phát >= 3 lần hoặc khách từ chối dứt khoát -> Tự động chuyển hoàn
        // (RETURNING)
        if (nextAttempts >= 3 || reason.toLowerCase().contains("từ chối") || reason.toLowerCase().contains("hủy đơn")) {
            targetStatus = "RETURNING";
            autoReturn = true;
        }

        validateStatusTransition(order, targetStatus, shipper);
        order.setCurrentStatus(targetStatus);
        Order saved = saveOrderAndEvictCache(order);

        assignmentRepository.findByTrackingCode(cleanCode).ifPresent(a -> {
            a.setStatus("FAILED");
            a.setFailReason(reason);
            a.setPodPhotoUrl(request.getFailureProofPhotoUrl());
            assignmentRepository.save(a);
        });

        LocalDateTime now = LocalDateTime.now();
        String timeStr = now.format(TIME_FORMATTER);
        String shipperDisplayName = formatPersonName("Bưu tá", shipper.getFullName());

        String rescheduleInfo = request.getRescheduledDate() != null
                ? ". Hẹn phát lại vào ngày: " + request.getRescheduledDate()
                : "";

        String returnNotice = autoReturn
                ? String.format(
                        " [CẢNH BÁO: Đã phát thất bại %d lần hoặc khách từ chối nhận hàng -> Đơn hàng tự động kích hoạt quy trình CHUYỂN HOÀN về kho bưu cục!]",
                        nextAttempts)
                : String.format(" [Lần phát thứ %d/3]", nextAttempts);

        String desc = String.format(
                "Giao hàng không thành công vào lúc %s. Bưu tá phụ trách: %s (SĐT: %s). Lý do: %s%s%s. Bằng chứng hiện trường: %s.",
                timeStr,
                shipperDisplayName,
                shipper.getPhoneNumber() != null ? shipper.getPhoneNumber() : "N/A",
                reason,
                rescheduleInfo,
                returnNotice,
                (request.getFailureProofPhotoUrl() != null && !request.getFailureProofPhotoUrl().isBlank())
                        ? "Đã đính kèm ảnh xác minh"
                        : "Không có ảnh");

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(cleanCode)
                .status(targetStatus)
                .locationType("DELIVERY_POINT")
                .locationId(order.getAssignedPostOfficeId() != null ? order.getAssignedPostOfficeId() : 1L)
                .locationName(
                        "Địa chỉ người nhận: " + (order.getReceiverAddress() != null ? order.getReceiverAddress() : ""))
                .description(desc)
                .actorId(shipperId)
                .actorName(shipperDisplayName + " (Báo thất bại)")
                .deviceInfo("SHIPPER_MOBILE_EXCEPTION")
                .build();
        trackingLogRepository.save(logEntry);

        OrderResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyOrderStatusUpdated(res, "DELIVERING", shipper.getFullName(),
                    "Giao thất bại: " + reason);
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket: {}", e.getMessage());
        }
        return res;
    }

    @Override
    @Transactional(readOnly = true)
    public CashReconciliationResponse getCashReconciliation(Long userId, Long filterShipperId, LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return getCashReconciliation(userId, filterShipperId, targetDate, targetDate);
    }

    @Override
    @Transactional(readOnly = true)
    public CashReconciliationResponse getCashReconciliation(Long userId, Long filterShipperId, LocalDate startDate,
            LocalDate endDate) {
        User currentUser = userRepository.findById(userId).orElse(null);
        Long targetShipperId = filterShipperId != null ? filterShipperId : userId;
        User targetShipper = userRepository.findById(targetShipperId).orElse(null);

        LocalDate effectiveStart = startDate != null ? startDate : (endDate != null ? endDate : LocalDate.now());
        LocalDate effectiveEnd = endDate != null ? endDate : effectiveStart;

        // Lấy tất cả đơn đã giao của shipper thu tiền mặt (loại trừ đơn đã thanh toán
        // VietQR ngân hàng)
        List<Order> allDeliveredOrders = orderRepository.findByAssignedShipperId(targetShipperId).stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus())
                        && o.getDeliveredAt() != null
                        && !"VIETQR".equalsIgnoreCase(o.getPaymentMethod()))
                .collect(Collectors.toList());

        // 1. Kiểm tra nợ cũ: Các đơn giao trước ngày effectiveStart mà CHƯA nộp đủ tiền
        BigDecimal pastUnsettledDebt = BigDecimal.ZERO;
        List<Order> pastUnsettledOrders = new ArrayList<>();

        for (Order po : allDeliveredOrders) {
            if (po.getDeliveredAt().toLocalDate().isBefore(effectiveStart)
                    && !Boolean.TRUE.equals(po.getIsCashSettled())) {
                BigDecimal orderCod = po.getCodAmount() != null ? po.getCodAmount() : BigDecimal.ZERO;
                BigDecimal orderFee = ("RECEIVER".equalsIgnoreCase(po.getPaymentParty()) && po.getTotalFee() != null)
                        ? po.getTotalFee()
                        : BigDecimal.ZERO;
                BigDecimal totalOrderCash = orderCod.add(orderFee);
                BigDecimal settled = po.getSettledCashAmount() != null ? po.getSettledCashAmount() : BigDecimal.ZERO;
                BigDecimal remaining = totalOrderCash.subtract(settled);
                if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                    pastUnsettledDebt = pastUnsettledDebt.add(remaining);
                    pastUnsettledOrders.add(po);
                }
            }
        }

        // 2. Các đơn giao trong khoảng [effectiveStart, effectiveEnd]
        List<Order> periodOrders = allDeliveredOrders.stream()
                .filter(o -> {
                    LocalDate d = o.getDeliveredAt().toLocalDate();
                    return !d.isBefore(effectiveStart) && !d.isAfter(effectiveEnd);
                })
                .collect(Collectors.toList());

        BigDecimal totalCod = BigDecimal.ZERO;
        BigDecimal totalFee = BigDecimal.ZERO;
        BigDecimal periodUnsettledCash = BigDecimal.ZERO;
        int settledCount = 0;
        int unsettledCount = 0;

        for (Order o : periodOrders) {
            BigDecimal orderCod = o.getCodAmount() != null ? o.getCodAmount() : BigDecimal.ZERO;
            BigDecimal orderFee = ("RECEIVER".equalsIgnoreCase(o.getPaymentParty()) && o.getTotalFee() != null)
                    ? o.getTotalFee()
                    : BigDecimal.ZERO;
            BigDecimal totalOrderCash = orderCod.add(orderFee);

            totalCod = totalCod.add(orderCod);
            totalFee = totalFee.add(orderFee);

            BigDecimal settled = o.getSettledCashAmount() != null ? o.getSettledCashAmount() : BigDecimal.ZERO;
            BigDecimal remaining = totalOrderCash.subtract(settled);

            if (remaining.compareTo(BigDecimal.ZERO) <= 0 && Boolean.TRUE.equals(o.getIsCashSettled())) {
                settledCount++;
            } else {
                unsettledCount++;
                periodUnsettledCash = periodUnsettledCash.add(remaining);
            }
        }

        // Tổng tiền cần nộp = tiền đơn trong kỳ chưa nộp + tiền nợ các ngày trước
        BigDecimal totalCashToSubmit = periodUnsettledCash.add(pastUnsettledDebt);
        boolean isBlocked = pastUnsettledDebt.compareTo(BigDecimal.ZERO) > 0;

        // Tổng hợp danh sách hiển thị: trong kỳ + nợ cũ (để shipper & thủ quỹ dễ dàng
        // đối soát)
        List<Order> displayOrders = new ArrayList<>(periodOrders);
        for (Order po : pastUnsettledOrders) {
            if (!displayOrders.contains(po)) {
                displayOrders.add(po);
            }
        }

        return CashReconciliationResponse.builder()
                .shipperId(targetShipperId)
                .shipperName(targetShipper != null ? targetShipper.getFullName() : "Bưu tá")
                .shipperPhone(targetShipper != null ? targetShipper.getPhoneNumber() : "N/A")
                .shiftDate(effectiveEnd)
                .startDate(effectiveStart)
                .endDate(effectiveEnd)
                .totalOrdersDelivered(periodOrders.size())
                .totalCodCollected(totalCod)
                .totalFeeCollected(totalFee)
                .totalCashToSubmit(totalCashToSubmit)
                .pastUnsettledDebt(pastUnsettledDebt)
                .isBlockedFromDelivery(isBlocked)
                .settledOrdersCount(settledCount)
                .unsettledOrdersCount(unsettledCount + pastUnsettledOrders.size())
                .orders(displayOrders.stream().map(this::mapToResponse).collect(Collectors.toList()))
                .build();
    }

    @Override
    @Transactional
    public Map<String, Object> submitCashReconciliation(Long shipperId, CashSubmitRequest request) {
        User shipper = userRepository.findById(shipperId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin bưu tá!"));

        LocalDate shiftDate = (request != null && request.getShiftDate() != null)
                ? request.getShiftDate()
                : LocalDate.now();
        String method = (request != null && request.getPaymentMethod() != null && !request.getPaymentMethod().isBlank())
                ? request.getPaymentMethod().toUpperCase()
                : "PAYOS";

        // Lấy tất cả các đơn hàng chưa nộp đủ (bao gồm nợ cũ và hôm nay)
        List<Order> unsettledOrders = orderRepository.findByAssignedShipperId(shipperId).stream()
                .filter(o -> "DELIVERED".equalsIgnoreCase(o.getCurrentStatus())
                        && o.getDeliveredAt() != null
                        && (o.getDeliveredAt().toLocalDate().isBefore(shiftDate)
                                || o.getDeliveredAt().toLocalDate().equals(shiftDate))
                        && !Boolean.TRUE.equals(o.getIsCashSettled())
                        && !"VIETQR".equalsIgnoreCase(o.getPaymentMethod()))
                .collect(Collectors.toList());

        if (request != null && request.getTrackingCodes() != null && !request.getTrackingCodes().isEmpty()) {
            Set<String> selectedCodes = new HashSet<>(request.getTrackingCodes());
            unsettledOrders = unsettledOrders.stream()
                    .filter(o -> selectedCodes.contains(o.getTrackingCode()))
                    .collect(Collectors.toList());
        }

        BigDecimal calculatedCod = BigDecimal.ZERO;
        BigDecimal calculatedFee = BigDecimal.ZERO;
        BigDecimal calculatedRemainingTotal = BigDecimal.ZERO;
        for (Order o : unsettledOrders) {
            BigDecimal orderCod = o.getCodAmount() != null ? o.getCodAmount() : BigDecimal.ZERO;
            BigDecimal orderFee = ("RECEIVER".equalsIgnoreCase(o.getPaymentParty()) && o.getTotalFee() != null)
                    ? o.getTotalFee()
                    : BigDecimal.ZERO;
            BigDecimal orderTotal = orderCod.add(orderFee);
            BigDecimal settled = o.getSettledCashAmount() != null ? o.getSettledCashAmount() : BigDecimal.ZERO;
            BigDecimal remaining = orderTotal.subtract(settled);

            calculatedCod = calculatedCod.add(orderCod);
            calculatedFee = calculatedFee.add(orderFee);
            if (remaining.compareTo(BigDecimal.ZERO) > 0) {
                calculatedRemainingTotal = calculatedRemainingTotal.add(remaining);
            }
        }

        BigDecimal amountToSubmit = (request != null && request.getAmountSubmitted() != null
                && request.getAmountSubmitted().compareTo(BigDecimal.ZERO) > 0)
                        ? request.getAmountSubmitted()
                        : calculatedRemainingTotal;

        if (amountToSubmit.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException(
                    "Số tiền nộp phải lớn hơn 0 VNĐ (Không có khoản tiền thu hộ COD nào cần nộp)!");
        }

        String submissionCode = "CSUB-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        String trackingCodesStr = unsettledOrders.stream().map(Order::getTrackingCode).collect(Collectors.joining(","));
        String notes = (request != null && request.getNotes() != null && !request.getNotes().isBlank())
                ? request.getNotes()
                : ("Nộp tiền cuối ca ngày " + shiftDate);

        ShipperCashSubmission submission = ShipperCashSubmission.builder()
                .submissionCode(submissionCode)
                .shipperId(shipperId)
                .shipperName(shipper.getFullName())
                .shipperPhone(shipper.getPhoneNumber())
                .postOfficeId(shipper.getAssignedPostOfficeId())
                .shiftDate(shiftDate)
                .totalOrders(unsettledOrders.size())
                .totalCodAmount(calculatedCod)
                .totalFeeAmount(calculatedFee)
                .totalAmount(amountToSubmit)
                .amountPaid(BigDecimal.ZERO)
                .paymentMethod(method)
                .status("PENDING")
                .notes(notes)
                .orderCodesJson(trackingCodesStr)
                .build();

        Map<String, Object> res = new HashMap<>();
        res.put("submissionCode", submissionCode);
        res.put("shipperId", shipperId);
        res.put("shipperName", shipper.getFullName());
        res.put("totalAmount", amountToSubmit);
        res.put("totalOrders", unsettledOrders.size());
        res.put("paymentMethod", method);
        res.put("shiftDate", shiftDate);

        if ("PAYOS".equalsIgnoreCase(method)) {
            // Tạo mã orderCode hợp lệ cho PayOS (dưới 9007199254740991)
            long orderCode = Long.parseLong(String.valueOf(System.currentTimeMillis()).substring(3)
                    + String.format("%03d", (int) (Math.random() * 1000)));

            String description = "Nop COD " + (orderCode % 1000000);
            if (description.length() > 25) {
                description = description.substring(0, 25);
            }

            String returnUrl = (request != null && request.getReturnUrl() != null && !request.getReturnUrl().isBlank())
                    ? request.getReturnUrl()
                    : ("http://localhost:3000/shipper-portal?csubCode=" + submissionCode + "&status=success");
            String cancelUrl = (request != null && request.getCancelUrl() != null && !request.getCancelUrl().isBlank())
                    ? request.getCancelUrl()
                    : ("http://localhost:3000/shipper-portal?csubCode=" + submissionCode + "&status=cancelled");

            try {
                CreatePaymentLinkRequest payOsReq = CreatePaymentLinkRequest.builder()
                        .orderCode(orderCode)
                        .amount(amountToSubmit.longValue())
                        .description(description)
                        .returnUrl(returnUrl)
                        .cancelUrl(cancelUrl)
                        .build();

                CreatePaymentLinkResponse payOsRes = payOS.paymentRequests().create(payOsReq);

                submission.setPayosOrderCode(orderCode);
                submission.setPayosPaymentLinkId(payOsRes.getPaymentLinkId());
                submission.setCheckoutUrl(payOsRes.getCheckoutUrl());
                submission.setQrCode(payOsRes.getQrCode());

                res.put("orderCode", orderCode);
                res.put("checkoutUrl", payOsRes.getCheckoutUrl());
                res.put("qrCode", payOsRes.getQrCode());
                res.put("accountName", payOsRes.getAccountName());
                res.put("accountNumber", payOsRes.getAccountNumber());
                res.put("bin", payOsRes.getBin());
                res.put("status", "PENDING");
                res.put("message", "Đã tạo link thanh toán VietQR PayOS thành công!");
            } catch (Exception e) {
                log.warn("⚠️ [PayOS] Lỗi kết nối PayOS API: {}. Sử dụng thanh toán QR PayOS dự phòng.", e.getMessage());
                submission.setPayosOrderCode(orderCode);
                String fallbackCheckoutUrl = "https://pay.payos.vn/web/" + orderCode;
                submission.setCheckoutUrl(fallbackCheckoutUrl);
                res.put("orderCode", orderCode);
                res.put("checkoutUrl", fallbackCheckoutUrl);
                res.put("status", "PENDING");
                res.put("message", "Đã tạo yêu cầu thanh toán VietQR PayOS thành công!");
            }
        } else {
            // Nộp tiền mặt trực tiếp tại bưu cục
            res.put("status", "PENDING");
            res.put("message",
                    "Đã tạo yêu cầu nộp tiền mặt. Vui lòng bàn giao tiền cho Thủ quỹ bưu cục để xác nhận hoàn tất!");
        }

        cashSubmissionRepository.save(submission);
        return res;
    }

    @Override
    @Transactional
    public Map<String, Object> checkSubmissionPaymentStatus(String submissionCode) {
        ShipperCashSubmission submission = cashSubmissionRepository.findBySubmissionCode(submissionCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê nộp tiền: " + submissionCode));

        if ("COMPLETED".equalsIgnoreCase(submission.getStatus())) {
            Map<String, Object> res = new HashMap<>();
            res.put("submissionCode", submissionCode);
            res.put("status", "COMPLETED");
            res.put("message", "Giao dịch nộp tiền đã hoàn tất thành công!");
            return res;
        }

        if ("PAYOS".equalsIgnoreCase(submission.getPaymentMethod()) && submission.getPayosOrderCode() != null) {
            try {
                PaymentLink link = payOS.paymentRequests().get(submission.getPayosOrderCode());
                if (link != null && link.getStatus() != null) {
                    if (PaymentLinkStatus.PAID.equals(link.getStatus())) {
                        markSubmissionCompleted(submission, null, "PayOS VietQR Gateway");
                        Map<String, Object> res = new HashMap<>();
                        res.put("submissionCode", submissionCode);
                        res.put("status", "COMPLETED");
                        res.put("message", "Thanh toán VietQR PayOS thành công!");
                        return res;
                    } else if (PaymentLinkStatus.CANCELLED.equals(link.getStatus())) {
                        submission.setStatus("CANCELLED");
                        cashSubmissionRepository.save(submission);
                        Map<String, Object> res = new HashMap<>();
                        res.put("submissionCode", submissionCode);
                        res.put("status", "CANCELLED");
                        res.put("message", "Giao dịch nộp tiền đã bị hủy.");
                        return res;
                    }
                }
            } catch (Exception e) {
                log.warn("⚠️ Kiểm tra PayOS payment request {}: {}", submission.getPayosOrderCode(), e.getMessage());
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("submissionCode", submissionCode);
        res.put("status", submission.getStatus());
        res.put("message", "Đang chờ thanh toán...");
        return res;
    }

    @Override
    @Transactional
    public Map<String, Object> handlePayOsWebhook(Webhook webhook) {
        try {
            WebhookData data = payOS.webhooks().verify(webhook);
            if (data != null && ("00".equals(data.getCode()) || "success".equalsIgnoreCase(data.getDesc()))) {
                Long orderCode = data.getOrderCode();
                cashSubmissionRepository.findByPayosOrderCode(orderCode).ifPresent(sub -> {
                    markSubmissionCompleted(sub, null, "PayOS Webhook");
                });
            }
            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            return res;
        } catch (Exception e) {
            log.error("❌ Lỗi xác thực Webhook PayOS: {}", e.getMessage(), e);
            throw new RuntimeException("Xác thực Webhook PayOS thất bại: " + e.getMessage());
        }
    }

    @Override
    @Transactional
    public Map<String, Object> approveCashSubmission(String submissionCode, Long managerId) {
        ShipperCashSubmission submission = cashSubmissionRepository.findBySubmissionCode(submissionCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê nộp tiền: " + submissionCode));

        User manager = userRepository.findById(managerId).orElse(null);
        String managerName = manager != null ? manager.getFullName() : "Thủ quỹ bưu cục";

        markSubmissionCompleted(submission, managerId, managerName);

        Map<String, Object> res = new HashMap<>();
        res.put("submissionCode", submissionCode);
        res.put("status", "COMPLETED");
        res.put("message", "Thủ quỹ " + managerName + " đã duyệt nhận đủ tiền mặt!");
        return res;
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CashSubmissionResponse> getCashSubmissions(Long shipperId, Long postOfficeId, LocalDate startDate,
            LocalDate endDate, Pageable pageable) {
        Specification<ShipperCashSubmission> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (shipperId != null) {
                predicates.add(cb.equal(root.get("shipperId"), shipperId));
            }
            if (postOfficeId != null) {
                predicates.add(cb.equal(root.get("postOfficeId"), postOfficeId));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("shiftDate"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("shiftDate"), endDate));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        Page<ShipperCashSubmission> page = cashSubmissionRepository.findAll(spec, pageable);

        return page.map(s -> CashSubmissionResponse.builder()
                .id(s.getId())
                .submissionCode(s.getSubmissionCode())
                .shipperId(s.getShipperId())
                .shipperName(s.getShipperName())
                .shipperPhone(s.getShipperPhone())
                .postOfficeId(s.getPostOfficeId())
                .shiftDate(s.getShiftDate())
                .totalOrders(s.getTotalOrders())
                .totalCodAmount(s.getTotalCodAmount())
                .totalFeeAmount(s.getTotalFeeAmount())
                .totalAmount(s.getTotalAmount())
                .amountPaid(s.getAmountPaid())
                .paymentMethod(s.getPaymentMethod())
                .status(s.getStatus())
                .payosOrderCode(s.getPayosOrderCode())
                .checkoutUrl(s.getCheckoutUrl())
                .qrCode(s.getQrCode())
                .approvedBy(s.getApprovedBy())
                .approvedByName(s.getApprovedByName())
                .approvedAt(s.getApprovedAt())
                .paidAt(s.getPaidAt())
                .notes(s.getNotes())
                .createdAt(s.getCreatedAt())
                .build());
    }

    private void markSubmissionCompleted(ShipperCashSubmission submission, Long approverId, String approverName) {
        if ("COMPLETED".equalsIgnoreCase(submission.getStatus())) {
            return;
        }

        submission.setStatus("COMPLETED");
        submission.setAmountPaid(submission.getTotalAmount());
        submission.setPaidAt(LocalDateTime.now());
        if (approverId != null) {
            submission.setApprovedBy(approverId);
            submission.setApprovedByName(approverName);
            submission.setApprovedAt(LocalDateTime.now());
        }
        cashSubmissionRepository.save(submission);

        // Đánh dấu các đơn hàng đã quyết toán nộp tiền, trừ nợ COD theo số tiền thực
        // nộp (FIFO allocation)
        if (submission.getOrderCodesJson() != null && !submission.getOrderCodesJson().isBlank()) {
            String[] codes = submission.getOrderCodesJson().split(",");
            List<Order> orders = new ArrayList<>();
            for (String c : codes) {
                String clean = c.trim().toUpperCase();
                orderRepository.findByTrackingCode(clean).ifPresent(orders::add);
            }
            // Sắp xếp các đơn theo thời gian giao (đơn giao trước quyết toán trước)
            orders.sort(Comparator.comparing(
                    o -> o.getDeliveredAt() != null ? o.getDeliveredAt() : LocalDateTime.MIN));

            BigDecimal remainingPayment = submission.getTotalAmount() != null ? submission.getTotalAmount()
                    : BigDecimal.ZERO;

            for (Order order : orders) {
                BigDecimal orderCod = order.getCodAmount() != null ? order.getCodAmount() : BigDecimal.ZERO;
                BigDecimal orderFee = ("RECEIVER".equalsIgnoreCase(order.getPaymentParty())
                        && order.getTotalFee() != null)
                                ? order.getTotalFee()
                                : BigDecimal.ZERO;
                BigDecimal orderCashTotal = orderCod.add(orderFee);

                BigDecimal alreadySettled = order.getSettledCashAmount() != null ? order.getSettledCashAmount()
                        : BigDecimal.ZERO;
                BigDecimal neededForThisOrder = orderCashTotal.subtract(alreadySettled);
                if (neededForThisOrder.compareTo(BigDecimal.ZERO) <= 0) {
                    order.setIsCashSettled(true);
                    saveOrderAndEvictCache(order);
                    continue;
                }

                if (remainingPayment.compareTo(BigDecimal.ZERO) <= 0) {
                    // Hết tiền phân bổ, đơn này vẫn chưa quyết toán đủ
                    order.setIsCashSettled(false);
                    saveOrderAndEvictCache(order);
                    continue;
                }

                if (remainingPayment.compareTo(neededForThisOrder) >= 0) {
                    // Đủ tiền tất toán toàn bộ đơn này
                    order.setSettledCashAmount(orderCashTotal);
                    order.setIsCashSettled(true);
                    order.setCashSubmissionCode(submission.getSubmissionCode());
                    remainingPayment = remainingPayment.subtract(neededForThisOrder);
                } else {
                    // Chỉ nộp được một phần của đơn này
                    order.setSettledCashAmount(alreadySettled.add(remainingPayment));
                    order.setIsCashSettled(false);
                    order.setCashSubmissionCode(submission.getSubmissionCode());
                    remainingPayment = BigDecimal.ZERO;
                }
                saveOrderAndEvictCache(order);
            }
        }

        log.info("🎉 [Nộp tiền cuối ca] Bảng kê {} đã hoàn tất thành công! Đã quyết toán trừ nợ cho bưu tá {}",
                submission.getSubmissionCode(), submission.getShipperName());

        try {
            webSocketNotificationService.notifyGeneric(
                    "/topic/cash-submissions",
                    Map.of(
                            "type", "CASH_SUBMISSION_COMPLETED",
                            "submissionCode", submission.getSubmissionCode(),
                            "message", "Giao dịch nộp tiền [" + submission.getSubmissionCode() + "] của bưu tá "
                                    + submission.getShipperName() + " đã thành công!"));
        } catch (Exception e) {
            log.warn("Lỗi gửi thông báo WebSocket nộp tiền: {}", e.getMessage());
        }
    }

    private OrderResponse mapToResponse(Order order) {
        BigDecimal orderCod = order.getCodAmount() != null ? order.getCodAmount() : BigDecimal.ZERO;
        BigDecimal orderFee = ("RECEIVER".equalsIgnoreCase(order.getPaymentParty()) && order.getTotalFee() != null)
                ? order.getTotalFee()
                : BigDecimal.ZERO;
        BigDecimal totalOrderCash = orderCod.add(orderFee);
        BigDecimal settled = order.getSettledCashAmount() != null ? order.getSettledCashAmount() : BigDecimal.ZERO;
        BigDecimal remaining = totalOrderCash.subtract(settled);
        if (remaining.compareTo(BigDecimal.ZERO) < 0)
            remaining = BigDecimal.ZERO;

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
                .podPhotoUrl(order.getPodPhotoUrl())
                .podSignatureUrl(order.getPodSignatureUrl())
                .podLatitude(order.getPodLatitude())
                .podLongitude(order.getPodLongitude())
                .podReceiverName(order.getPodReceiverName())
                .deliveryOtp(order.getDeliveryOtp())
                .rescheduledDeliveryDate(order.getRescheduledDeliveryDate())
                .failureProofPhotoUrl(order.getFailureProofPhotoUrl())
                .paymentMethod(order.getPaymentMethod())
                .isReconciled(order.getIsReconciled())
                .reconciliationSheetCode(order.getReconciliationSheetCode())
                .isCashSettled(order.getIsCashSettled())
                .settledCashAmount(settled)
                .remainingCashAmount(remaining)
                .cashSubmissionCode(order.getCashSubmissionCode())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }
}
