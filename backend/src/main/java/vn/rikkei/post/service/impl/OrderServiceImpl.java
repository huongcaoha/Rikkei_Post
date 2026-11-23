package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.order.*;
import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.entity.DeliveryRoute;
import vn.rikkei.post.entity.MerchantAddress;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.OrderTrackingLog;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.MerchantAddressRepository;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.OrderTrackingLogRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.service.DeliveryRouteService;
import vn.rikkei.post.service.EmailService;
import vn.rikkei.post.service.OrderService;
import vn.rikkei.post.service.PricingService;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final PricingService pricingService;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final MerchantAddressRepository merchantAddressRepository;
    private final DeliveryRouteService deliveryRouteService;
    private final Random random = new Random();

    @Override
    @Transactional
    public OrderResponse createOrder(CreateOrderRequest request, Long merchantId) {
        // Kiểm tra quyền hạn nghiêm ngặt: Chỉ tài khoản Shop / Khách hàng (ROLE_MERCHANT) mới được tạo đơn hàng!
        // Tất cả tài khoản quản trị (ADMIN, BRANCH_MANAGER, POST_OFFICE_MANAGER, SHIPPER, WAREHOUSE_STAFF) đều không được phép tạo đơn.
        if (merchantId != null) {
            User caller = userRepository.findById(merchantId).orElse(null);
            if (caller != null) {
                boolean hasStaffOrAdminRole = caller.getRoles().stream().anyMatch(r ->
                        "ROLE_ADMIN".equals(r.getRoleName()) ||
                        "ROLE_BRANCH_MANAGER".equals(r.getRoleName()) ||
                        "ROLE_POST_OFFICE_MANAGER".equals(r.getRoleName()) ||
                        "ROLE_SHIPPER".equals(r.getRoleName()) ||
                        "ROLE_WAREHOUSE_STAFF".equals(r.getRoleName())
                );
                boolean isMerchant = caller.getRoles().stream().anyMatch(r -> "ROLE_MERCHANT".equals(r.getRoleName()));
                if (hasStaffOrAdminRole || !isMerchant) {
                    throw new org.springframework.security.access.AccessDeniedException(
                            "Tài khoản quản trị / bưu cục / shipper không có quyền tạo đơn hàng! Chỉ tài khoản Shop hoặc Khách hàng mới được phép tạo đơn.");
                }
            }
        }

        // 1. Tính giá cước động
        CalculatePriceRequest priceReq = CalculatePriceRequest.builder()
                .senderProvinceId(request.getSenderProvinceId())
                .receiverProvinceId(request.getReceiverProvinceId())
                .actualWeightGram(request.getActualWeightGram())
                .lengthCm(request.getLengthCm())
                .widthCm(request.getWidthCm())
                .heightCm(request.getHeightCm())
                .itemValue(request.getItemValue())
                .serviceType(request.getServiceType())
                .pickupType(request.getPickupType() != null ? request.getPickupType() : "DROP_OFF")
                .merchantId(merchantId)
                .build();

        PriceEstimateResponse priceRes = pricingService.calculatePrice(priceReq);

        // 2. Sinh mã vận đơn độc nhất
        String trackingCode = generateUniqueTrackingCode();

        // 3. Sinh Routing Code phân loại bưu cục
        String routingCode = generateRoutingCode(request.getReceiverProvinceId(), request.getReceiverDistrictId());

        // 4. Kiểm tra tuyến đường và phân bổ Shipper tự động nếu là DOOR_PICKUP (Lấy hàng tại Shop)
        DeliveryRoute matchedRoute = null;
        if ("DOOR_PICKUP".equalsIgnoreCase(priceRes.getPickupType())) {
            try {
                matchedRoute = deliveryRouteService.findBestMatchingRoute(
                        request.getSenderProvinceId(),
                        request.getSenderWardName(),
                        request.getSenderAddress()
                );
            } catch (Exception e) {
                log.warn("Không thể tự động phân bổ tuyến đường: {}", e.getMessage());
            }
        }

        // 5. Lưu thực thể Order
        Order order = Order.builder()
                .trackingCode(trackingCode)
                .merchantId(merchantId)
                .senderName(request.getSenderName())
                .senderPhone(request.getSenderPhone())
                .senderAddress(request.getSenderAddress())
                .senderProvinceId(request.getSenderProvinceId())
                .senderDistrictId(request.getSenderDistrictId() != null ? request.getSenderDistrictId() : 0)
                .senderWardId(request.getSenderWardId() != null ? request.getSenderWardId() : 0)
                .senderWardName(request.getSenderWardName())
                .senderLat(request.getSenderLat())
                .senderLng(request.getSenderLng())
                .receiverName(request.getReceiverName())
                .receiverPhone(request.getReceiverPhone())
                .receiverAddress(request.getReceiverAddress())
                .receiverProvinceId(request.getReceiverProvinceId())
                .receiverDistrictId(request.getReceiverDistrictId() != null ? request.getReceiverDistrictId() : 0)
                .receiverWardId(request.getReceiverWardId() != null ? request.getReceiverWardId() : 0)
                .receiverWardName(request.getReceiverWardName())
                .receiverLat(request.getReceiverLat())
                .receiverLng(request.getReceiverLng())
                .itemName(request.getItemName())
                .itemValue(request.getItemValue() != null ? request.getItemValue() : BigDecimal.ZERO)
                .actualWeightGram(priceRes.getActualWeightGram())
                .lengthCm(request.getLengthCm() != null ? request.getLengthCm() : 10)
                .widthCm(request.getWidthCm() != null ? request.getWidthCm() : 10)
                .heightCm(request.getHeightCm() != null ? request.getHeightCm() : 10)
                .volumetricWeightGram(priceRes.getVolumetricWeightGram())
                .billableWeightGram(priceRes.getBillableWeightGram())
                .shippingFee(priceRes.getShippingFee())
                .insuranceFee(priceRes.getInsuranceFee())
                .totalFee(priceRes.getTotalFee())
                .codAmount(request.getCodAmount() != null ? request.getCodAmount() : BigDecimal.ZERO)
                .paymentParty(request.getPaymentParty() != null ? request.getPaymentParty() : "RECEIVER")
                .serviceType(request.getServiceType() != null ? request.getServiceType() : "STANDARD")
                .pickupType(priceRes.getPickupType() != null ? priceRes.getPickupType() : "DROP_OFF")
                .pickupFee(priceRes.getPickupFee() != null ? priceRes.getPickupFee() : BigDecimal.ZERO)
                .routingCode(routingCode)
                .currentStatus("CREATED")
                .deliveryAttempts(0)
                .notes(request.getNotes())
                .assignedRouteId(matchedRoute != null ? matchedRoute.getId() : null)
                .assignedPostOfficeId(matchedRoute != null ? matchedRoute.getPostOfficeId() : null)
                .assignedShipperId(matchedRoute != null ? matchedRoute.getAssignedShipperId() : null)
                .assignedShipperName(matchedRoute != null ? matchedRoute.getAssignedShipperName() : null)
                .assignedShipperPhone(matchedRoute != null ? matchedRoute.getAssignedShipperPhone() : null)
                .build();

        final Order savedOrder = orderRepository.save(order);

        // 6. Ghi log khởi tạo hành trình ban đầu
        String initialDesc;
        if ("DOOR_PICKUP".equalsIgnoreCase(savedOrder.getPickupType())) {
            if (savedOrder.getAssignedShipperName() != null) {
                initialDesc = "Đơn hàng mới được tạo trên hệ thống Rikkei_Post. Đã tự động phân bổ bưu tá "
                        + savedOrder.getAssignedShipperName() + " (SĐT: " + savedOrder.getAssignedShipperPhone()
                        + ") thuộc bưu cục quản lý tuyến " + (matchedRoute != null ? matchedRoute.getRouteName() : "")
                        + " đến tận nơi lấy hàng.";
            } else {
                initialDesc = "Đơn hàng mới được tạo trên hệ thống Rikkei_Post. Đang điều phối bưu tá đến tận nơi lấy hàng.";
            }
        } else {
            initialDesc = "Đơn hàng mới được tạo trên hệ thống Rikkei_Post. Chờ Shop gửi hàng tại bưu cục.";
        }

        OrderTrackingLog logEntry = OrderTrackingLog.builder()
                .trackingCode(savedOrder.getTrackingCode())
                .status("CREATED")
                .locationType("POST_OFFICE")
                .locationId(savedOrder.getAssignedPostOfficeId() != null ? savedOrder.getAssignedPostOfficeId() : 1L)
                .locationName("Cổng thông tin khách hàng")
                .description(initialDesc)
                .actorId(merchantId)
                .actorName(request.getSenderName())
                .deviceInfo("WEB_CUSTOMER_PORTAL")
                .build();
        trackingLogRepository.save(logEntry);

        // 6. Lưu hoặc cập nhật thông tin địa chỉ người gửi mặc định (nếu được yêu cầu hoặc chưa có)
        try {
            saveOrUpdateDefaultSenderAddress(merchantId, request);
        } catch (Exception e) {
            log.warn("Không thể lưu địa chỉ người gửi mặc định: {}", e.getMessage());
        }

        // 7. Gửi email thông báo tạo đơn thành công (nếu người gửi có email)
        try {
            userRepository.findById(merchantId).ifPresent(user -> {
                if (user.getEmail() != null && !user.getEmail().isBlank()) {
                    emailService.sendOrderCreatedEmail(
                            user.getEmail(),
                            savedOrder.getTrackingCode(),
                            savedOrder.getReceiverName(),
                            savedOrder.getTotalFee().doubleValue()
                    );
                }
            });
        } catch (Exception e) {
            log.warn("Lỗi gửi email tạo đơn: {}", e.getMessage());
        }

        return mapToResponse(savedOrder);
    }

    @Override
    @Transactional
    public BatchOrderResponse createBatchOrders(BatchOrderRequest request, Long merchantId) {
        List<OrderResponse> created = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        int row = 1;
        for (CreateOrderRequest item : request.getOrders()) {
            try {
                OrderResponse res = createOrder(item, merchantId);
                created.add(res);
            } catch (Exception e) {
                errors.add("Dòng " + row + " lỗi: " + e.getMessage());
            }
            row++;
        }

        return BatchOrderResponse.builder()
                .totalSubmitted(request.getOrders().size())
                .successCount(created.size())
                .failureCount(errors.size())
                .createdOrders(created)
                .errors(errors)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public OrderResponse getOrderByTrackingCode(String trackingCode) {
        Order order = orderRepository.findByTrackingCode(trackingCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng với mã: " + trackingCode));
        return mapToResponse(order);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<OrderResponse> getMerchantOrders(Long userId, String status, Pageable pageable) {
        Page<Order> orders;
        boolean hasStatus = status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status);
        User user = userId != null ? userRepository.findById(userId).orElse(null) : null;

        if (user != null) {
            boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equals(r.getRoleName()));
            boolean isBranchManager = user.getRoles().stream().anyMatch(r -> "ROLE_BRANCH_MANAGER".equals(r.getRoleName()));
            boolean isPostOfficeManager = user.getRoles().stream().anyMatch(r -> "ROLE_POST_OFFICE_MANAGER".equals(r.getRoleName()));
            boolean isShipper = user.getRoles().stream().anyMatch(r -> "ROLE_SHIPPER".equals(r.getRoleName()));

            if (isAdmin) {
                // Quản trị viên: Có quyền xem toàn bộ đơn hàng của toàn hệ thống
                orders = hasStatus ? orderRepository.findByCurrentStatus(status, pageable) : orderRepository.findAll(pageable);
            } else if (isBranchManager && user.getManagedProvinceId() != null) {
                // Quản lý chi nhánh Tỉnh/TP: Xem đơn hàng gửi từ hoặc nhận đến địa bàn tỉnh mình quản lý
                orders = orderRepository.findByBranchProvinceAndStatus(user.getManagedProvinceId(), hasStatus ? status : null, pageable);
            } else if (isPostOfficeManager && user.getAssignedPostOfficeId() != null) {
                // Quản lý bưu cục: Xem đơn hàng được phân bổ về bưu cục của mình
                orders = hasStatus
                        ? orderRepository.findByAssignedPostOfficeIdAndCurrentStatus(user.getAssignedPostOfficeId(), status, pageable)
                        : orderRepository.findByAssignedPostOfficeId(user.getAssignedPostOfficeId(), pageable);
            } else if (isShipper) {
                // Shipper: Chỉ xem đơn hàng được gắn tên mình để đi lấy hoặc đi giao
                orders = hasStatus
                        ? orderRepository.findByAssignedShipperIdAndCurrentStatus(userId, status, pageable)
                        : orderRepository.findByAssignedShipperId(userId, pageable);
            } else {
                // Shop / Merchant / Khách hàng: Chỉ xem đơn do chính mình tạo
                orders = hasStatus
                        ? orderRepository.findByMerchantIdAndCurrentStatus(userId, status, pageable)
                        : orderRepository.findByMerchantId(userId, pageable);
            }
        } else {
            orders = hasStatus ? orderRepository.findByCurrentStatus(status, pageable) : orderRepository.findAll(pageable);
        }

        return orders.map(this::mapToResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardStatsResponse getDashboardStats(Long merchantId) {
        Page<Order> all = orderRepository.findByMerchantId(merchantId, Pageable.unpaged());
        List<Order> list = all.getContent();

        long total = list.size();
        long created = list.stream().filter(o -> "CREATED".equals(o.getCurrentStatus()) || "PICKED_UP".equals(o.getCurrentStatus())).count();
        long inTransit = list.stream().filter(o -> "IN_TRANSIT".equals(o.getCurrentStatus()) || "AT_SORTING_HUB".equals(o.getCurrentStatus())).count();
        long delivering = list.stream().filter(o -> "DELIVERING".equals(o.getCurrentStatus())).count();
        long delivered = list.stream().filter(o -> "DELIVERED".equals(o.getCurrentStatus())).count();
        long failed = list.stream().filter(o -> "DELIVERY_FAILED".equals(o.getCurrentStatus()) || "RETURNING".equals(o.getCurrentStatus())).count();

        BigDecimal codSum = list.stream()
                .filter(o -> "DELIVERED".equals(o.getCurrentStatus()))
                .map(Order::getCodAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal feeSum = list.stream()
                .map(Order::getTotalFee)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double rate = total > 0 ? (double) delivered / total * 100.0 : 0.0;

        return DashboardStatsResponse.builder()
                .totalOrders(total)
                .createdOrders(created)
                .inTransitOrders(inTransit)
                .deliveringOrders(delivering)
                .deliveredOrders(delivered)
                .failedOrders(failed)
                .totalCodCollected(codSum)
                .totalShippingFee(feeSum)
                .successRate(Math.round(rate * 10.0) / 10.0)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderTrackingLog> getOrderTimeline(String trackingCode) {
        return trackingLogRepository.findByTrackingCodeOrderByCreatedAtDesc(trackingCode);
    }

    private String generateUniqueTrackingCode() {
        String prefix = "RKP" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        String code;
        do {
            int rand = 100000 + random.nextInt(900000);
            code = prefix + rand;
        } while (orderRepository.existsByTrackingCode(code));
        return code;
    }

    private String generateRoutingCode(Integer provId, Integer distId) {
        String pStr = provId != null ? String.format("%02d", provId) : "00";
        String dStr = distId != null ? String.format("%03d", distId) : "000";
        return "RKP-" + pStr + "-" + dStr;
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
                .totalFee(order.getTotalFee())
                .codAmount(order.getCodAmount())
                .paymentParty(order.getPaymentParty())
                .serviceType(order.getServiceType())
                .pickupType(order.getPickupType())
                .pickupFee(order.getPickupFee())
                .routingCode(order.getRoutingCode())
                .currentStatus(order.getCurrentStatus())
                .deliveryAttempts(order.getDeliveryAttempts())
                .notes(order.getNotes())
                .assignedShipperId(order.getAssignedShipperId())
                .assignedShipperName(order.getAssignedShipperName())
                .assignedShipperPhone(order.getAssignedShipperPhone())
                .assignedPostOfficeId(order.getAssignedPostOfficeId())
                .assignedRouteId(order.getAssignedRouteId())
                .pickupCompletedAt(order.getPickupCompletedAt())
                .deliveredAt(order.getDeliveredAt())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public MerchantAddress getDefaultSenderAddress(Long merchantId) {
        return merchantAddressRepository.findFirstByMerchantIdAndIsDefaultTrue(merchantId).orElse(null);
    }

    @Override
    @Transactional
    public MerchantAddress saveDefaultSenderAddress(MerchantAddress request, Long merchantId) {
        User merchant = userRepository.findById(merchantId).orElse(null);
        if (merchant == null) {
            throw new IllegalArgumentException("Không tìm thấy thông tin Merchant!");
        }

        MerchantAddress addr = merchantAddressRepository.findFirstByMerchantIdAndIsDefaultTrue(merchantId)
                .orElse(MerchantAddress.builder().merchant(merchant).isDefault(true).build());

        addr.setContactName(request.getContactName());
        addr.setContactPhone(request.getContactPhone());
        addr.setProvinceId(request.getProvinceId());
        addr.setProvinceName(request.getProvinceName() != null ? request.getProvinceName() : "");
        addr.setDistrictId(request.getDistrictId() != null ? request.getDistrictId() : 0);
        addr.setDistrictName(request.getDistrictName() != null ? request.getDistrictName() : "");
        addr.setWardId(request.getWardId() != null ? request.getWardId() : 0);
        addr.setWardName(request.getWardName() != null ? request.getWardName() : "");
        addr.setStreetAddress(request.getStreetAddress());
        addr.setIsDefault(true);

        return merchantAddressRepository.save(addr);
    }

    private void saveOrUpdateDefaultSenderAddress(Long merchantId, CreateOrderRequest request) {
        if (merchantId == null) return;
        boolean hasExisting = merchantAddressRepository.findFirstByMerchantIdAndIsDefaultTrue(merchantId).isPresent();

        // Tự động lưu nếu người dùng tích chọn hoặc nếu người dùng chưa từng có địa chỉ gửi nào
        if (Boolean.TRUE.equals(request.getSaveAsDefaultSender()) || !hasExisting) {
            User merchant = userRepository.findById(merchantId).orElse(null);
            if (merchant == null) return;

            MerchantAddress addr = merchantAddressRepository.findFirstByMerchantIdAndIsDefaultTrue(merchantId)
                    .orElse(MerchantAddress.builder().merchant(merchant).isDefault(true).build());

            addr.setContactName(request.getSenderName());
            addr.setContactPhone(request.getSenderPhone());
            addr.setProvinceId(request.getSenderProvinceId());
            addr.setProvinceName("");
            addr.setDistrictId(request.getSenderDistrictId() != null ? request.getSenderDistrictId() : 0);
            addr.setDistrictName("");
            addr.setWardId(request.getSenderWardId() != null ? request.getSenderWardId() : 0);
            addr.setWardName(request.getSenderWardName() != null ? request.getSenderWardName() : "");
            addr.setStreetAddress(request.getSenderAddress());
            addr.setIsDefault(true);

            merchantAddressRepository.save(addr);
        }
    }
}
