package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
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
import vn.rikkei.post.entity.ShipperAssignment;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.DeliveryRouteRepository;
import vn.rikkei.post.repository.MerchantAddressRepository;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.OrderTrackingLogRepository;
import vn.rikkei.post.repository.ShipperAssignmentRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.DeliveryRouteService;
import vn.rikkei.post.service.EmailService;
import vn.rikkei.post.service.OrderService;
import vn.rikkei.post.service.PricingService;
import vn.rikkei.post.service.RedisService;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderServiceImpl implements OrderService {

    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final PricingService pricingService;
    private final EmailService emailService;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;
    private final ShipperAssignmentRepository assignmentRepository;
    private final MerchantAddressRepository merchantAddressRepository;
    private final DeliveryRouteService deliveryRouteService;
    private final DeliveryRouteRepository routeRepository;
    private final WebSocketNotificationService webSocketNotificationService;
    private final RedisService redisService;
    private final Random random = new Random();
    private final Map<Long, String> warehouseNameCache = new java.util.concurrent.ConcurrentHashMap<>();

    private String getWarehouseName(Long warehouseId) {
        if (warehouseId == null) return null;
        return warehouseNameCache.computeIfAbsent(warehouseId, id ->
                warehouseRepository.findById(id).map(Warehouse::getName).orElse(null)
        );
    }

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

        // 4. Tự động xác định Bưu cục gần Shop nhất theo vị trí GPS hoặc địa chỉ hành chính
        Warehouse nearestPostOffice = findNearestPostOffice(
                request.getSenderLat(),
                request.getSenderLng(),
                request.getSenderProvinceId(),
                request.getSenderDistrictId(),
                request.getSenderWardName(),
                request.getSenderAddress()
        );

        // 5. Kiểm tra tuyến đường phù hợp
        DeliveryRoute matchedRoute = null;
        try {
            matchedRoute = deliveryRouteService.findBestMatchingRoute(
                    request.getSenderProvinceId(),
                    request.getSenderWardName(),
                    request.getSenderAddress()
            );
        } catch (Exception e) {
            log.warn("Không thể tự động phân bổ tuyến đường: {}", e.getMessage());
        }

        // 6. Tự động gán Bưu tá gần nhất phụ trách bưu cục/tuyến đường để đến lấy hàng
        User assignedShipper = findNearestShipper(nearestPostOffice, matchedRoute, request.getSenderProvinceId());

        Long finalPostOfficeId = nearestPostOffice != null ? nearestPostOffice.getId() : (matchedRoute != null ? matchedRoute.getPostOfficeId() : 1L);
        Long finalShipperId = assignedShipper != null ? assignedShipper.getId() : null;
        String finalShipperName = assignedShipper != null ? assignedShipper.getFullName() : null;
        String finalShipperPhone = assignedShipper != null ? assignedShipper.getPhoneNumber() : null;

        // 7. Lưu thực thể Order
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
                .pickupType(priceRes.getPickupType() != null ? priceRes.getPickupType() : "DOOR_PICKUP")
                .pickupFee(priceRes.getPickupFee() != null ? priceRes.getPickupFee() : BigDecimal.ZERO)
                .routingCode(routingCode)
                .currentStatus("CREATED")
                .deliveryAttempts(0)
                .notes(request.getNotes())
                .assignedRouteId(matchedRoute != null ? matchedRoute.getId() : null)
                .assignedPostOfficeId(finalPostOfficeId)
                .assignedShipperId(finalShipperId)
                .assignedShipperName(finalShipperName)
                .assignedShipperPhone(finalShipperPhone)
                .build();

        final Order savedOrder = orderRepository.save(order);

        // 8. Tự động khởi tạo ShipperAssignment để bưu tá nhận nhiệm vụ lấy hàng ngay lập tức
        if (finalShipperId != null) {
            ShipperAssignment assignment = ShipperAssignment.builder()
                    .shipperId(finalShipperId)
                    .trackingCode(savedOrder.getTrackingCode())
                    .taskType("PICKUP")
                    .status("ASSIGNED")
                    .sequenceOrder(1)
                    .build();
            assignmentRepository.save(assignment);
        }

        // 9. Ghi log khởi tạo hành trình ban đầu
        String poName = nearestPostOffice != null ? nearestPostOffice.getName() : "Bưu cục điều phối";
        String initialDesc;
        if (finalShipperName != null) {
            initialDesc = String.format("Đơn hàng mới được tạo trên hệ thống Rikkei_Post. Tiếp nhận bởi %s. Đã tự động điều phối bưu tá %s (SĐT: %s) đến tận nơi lấy hàng tại Shop.",
                    poName, finalShipperName, finalShipperPhone != null ? finalShipperPhone : "N/A");
        } else {
            initialDesc = String.format("Đơn hàng mới được tạo trên hệ thống Rikkei_Post. Tiếp nhận bởi %s. Chờ phân bổ bưu tá đến lấy hàng.", poName);
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

        OrderResponse response = mapToResponse(savedOrder);
        try {
            redisService.evictOrderCache(savedOrder.getTrackingCode());
            webSocketNotificationService.notifyOrderCreated(response);
        } catch (Exception e) {
            log.warn("Không thể gửi thông báo WebSocket tạo đơn #{}: {}", savedOrder.getTrackingCode(), e.getMessage());
        }
        return response;
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
    @Cacheable(value = "order:tracking", key = "#trackingCode")
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
                // Quản lý bưu cục: Xem đơn hàng được phân bổ về bưu cục của mình hoặc thuộc phạm vi bưu cục
                Warehouse po = warehouseRepository.findById(user.getAssignedPostOfficeId()).orElse(null);
                String keyword = po != null ? extractPostOfficeKeyword(po.getName(), po.getAddress()) : "";
                orders = orderRepository.findByPostOfficeScope(
                        user.getAssignedPostOfficeId(),
                        keyword,
                        hasStatus ? status : null,
                        pageable);
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
        return getDashboardStats(null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public DashboardStatsResponse getDashboardStats(CustomUserDetails currentUser, LocalDate startDate, LocalDate endDate) {
        List<Order> list = getOrdersForUserScope(currentUser);

        // Lọc theo khoảng ngày (startDate, endDate)
        if (startDate != null || endDate != null) {
            list = list.stream()
                    .filter(o -> {
                        LocalDate d = o.getCreatedAt() != null ? o.getCreatedAt().toLocalDate() : null;
                        if (d == null) return false;
                        if (startDate != null && d.isBefore(startDate)) return false;
                        if (endDate != null && d.isAfter(endDate)) return false;
                        return true;
                    })
                    .collect(Collectors.toList());
        }

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

    private List<Order> getOrdersForUserScope(CustomUserDetails currentUser) {
        if (currentUser == null) {
            return orderRepository.findAll();
        }
        User user = userRepository.findById(currentUser.getId()).orElse(null);
        if (user == null) {
            return orderRepository.findAll();
        }

        boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
        boolean isBranchManager = user.getRoles().stream().anyMatch(r -> "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()));
        boolean isPostOfficeManager = user.getRoles().stream().anyMatch(r ->
                "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(r.getRoleName()) ||
                "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(r.getRoleName())
        );
        boolean isShipper = user.getRoles().stream().anyMatch(r -> "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()));

        if (isAdmin) {
            return orderRepository.findAll();
        } else if (isBranchManager && user.getManagedProvinceId() != null) {
            return orderRepository.findAll().stream()
                    .filter(o -> user.getManagedProvinceId().equals(o.getSenderProvinceId()) || user.getManagedProvinceId().equals(o.getReceiverProvinceId()))
                    .collect(Collectors.toList());
        } else if (isPostOfficeManager && user.getAssignedPostOfficeId() != null) {
            Warehouse po = warehouseRepository.findById(user.getAssignedPostOfficeId()).orElse(null);
            String keyword = po != null ? extractPostOfficeKeyword(po.getName(), po.getAddress()) : "";
            return orderRepository.findByPostOfficeScopeList(user.getAssignedPostOfficeId(), keyword);
        } else if (isShipper) {
            return orderRepository.findByAssignedShipperId(user.getId());
        } else {
            return orderRepository.findByMerchantId(user.getId(), Pageable.unpaged()).getContent();
        }
    }

    /**
     * Tự động tìm kiếm Bưu cục gần Shop nhất theo tọa độ (senderLat, senderLng)
     * hoặc theo Xã/Phường, Địa chỉ chi tiết và Tỉnh/TP người gửi.
     */
    private Warehouse findNearestPostOffice(Double lat, Double lng, Integer provinceId, Integer districtId, String wardName, String senderAddress) {
        List<Warehouse> activeWhs = warehouseRepository.findByIsActiveTrue();
        if (activeWhs.isEmpty()) {
            return null;
        }

        // 1. Nếu có tọa độ GPS hợp lệ (lat, lng != 0), tính khoảng cách địa lý (Haversine)
        if (lat != null && lng != null && lat != 0.0 && lng != 0.0) {
            Warehouse closest = null;
            double minDistance = Double.MAX_VALUE;

            for (Warehouse wh : activeWhs) {
                if (wh.getLatitude() != null && wh.getLongitude() != null) {
                    double dist = calculateDistanceKm(lat, lng, wh.getLatitude(), wh.getLongitude());
                    // Ưu tiên bưu cục giao dịch (SPOKE_POST_OFFICE)
                    double adjustedDist = "SPOKE_POST_OFFICE".equalsIgnoreCase(wh.getType()) ? dist * 0.9 : dist;
                    if (adjustedDist < minDistance) {
                        minDistance = adjustedDist;
                        closest = wh;
                    }
                }
            }
            if (closest != null) {
                log.info("Tìm thấy bưu cục gần nhất theo GPS: {} (khoảng cách: ~{} km)", closest.getName(), Math.round(minDistance * 10.0) / 10.0);
                return closest;
            }
        }

        // 2. Nếu không có tọa độ GPS (hoặc GPS không khớp), tìm kiếm thông minh theo Xã/Phường, Địa chỉ và Tỉnh/TP
        if (provinceId != null) {
            List<Warehouse> provinceWhs = activeWhs.stream()
                    .filter(w -> provinceId.equals(w.getProvinceId()))
                    .collect(Collectors.toList());

            if (!provinceWhs.isEmpty()) {
                // 2.1. Quét tìm kiếm bưu cục khớp theo Xã/Phường hoặc Địa chỉ người gửi
                String normWard = normalizeSearchText(wardName);
                String normAddr = normalizeSearchText(senderAddress);

                Warehouse bestMatchedWh = null;
                int maxScore = 0;

                for (Warehouse wh : provinceWhs) {
                    int score = 0;
                    String whName = normalizeSearchText(wh.getName());
                    String whAddr = normalizeSearchText(wh.getAddress());
                    String whCode = normalizeSearchText(wh.getCode());

                    // Trích xuất các từ khóa đặc trưng từ wardName (loại bỏ "xa", "phuong", "thi tran")
                    String cleanWardKeyword = normWard.replaceAll("^(xa|phuong|thi tran|tp|thanh pho|tinh)\\s+", "").trim();
                    if (!cleanWardKeyword.isEmpty() && cleanWardKeyword.length() >= 3) {
                        if (whName.contains(cleanWardKeyword)) score += 60;
                        if (whAddr.contains(cleanWardKeyword)) score += 50;
                        if (whCode.contains(cleanWardKeyword.replace(" ", ""))) score += 40;
                    }

                    // Kiểm tra từ khóa trong senderAddress
                    if (!normAddr.isEmpty()) {
                        if (whName.contains(normAddr)) score += 40;
                        if (whAddr.contains(normAddr)) score += 30;

                        if (senderAddress != null) {
                            for (String part : senderAddress.split("[,;\\-]")) {
                                String cleanPart = normalizeSearchText(part).trim();
                                if (cleanPart.length() >= 3 && !cleanPart.matches("^(ha noi|tp hcm|viet nam|so \\d+.*)$")) {
                                    if (whName.contains(cleanPart) || whAddr.contains(cleanPart)) {
                                        score += 30;
                                    }
                                }
                            }
                        }
                    }

                    // Ưu tiên bưu cục giao dịch (SPOKE_POST_OFFICE)
                    if ("SPOKE_POST_OFFICE".equalsIgnoreCase(wh.getType())) {
                        score += 5;
                    }

                    if (score > maxScore) {
                        maxScore = score;
                        bestMatchedWh = wh;
                    }
                }

                if (bestMatchedWh != null && maxScore >= 30) {
                    log.info("Khớp bưu cục thành công: {} (Score: {}) cho địa chỉ: {}, Xã/Phường: {}",
                            bestMatchedWh.getName(), maxScore, senderAddress, wardName);
                    return bestMatchedWh;
                }

                // 2.2. Kiểm tra nếu có tuyến đường trong tỉnh khớp với xã/phường này
                if (wardName != null && !wardName.isBlank()) {
                    List<DeliveryRoute> matchedRoutes = routeRepository.findMatchingRoutes(provinceId, wardName.trim());
                    if (!matchedRoutes.isEmpty() && matchedRoutes.get(0).getPostOfficeId() != null) {
                        Optional<Warehouse> whByRoute = warehouseRepository.findById(matchedRoutes.get(0).getPostOfficeId());
                        if (whByRoute.isPresent() && Boolean.TRUE.equals(whByRoute.get().getIsActive())) {
                            log.info("Khớp bưu cục qua tuyến đường phân bổ: {}", whByRoute.get().getName());
                            return whByRoute.get();
                        }
                    }
                }

                // 2.3. Fallback: Chọn bưu cục giao dịch đầu tiên của tỉnh
                return provinceWhs.stream()
                        .filter(w -> "SPOKE_POST_OFFICE".equalsIgnoreCase(w.getType()))
                        .findFirst()
                        .orElse(provinceWhs.get(0));
            }
        }

        return activeWhs.stream()
                .filter(w -> "SPOKE_POST_OFFICE".equalsIgnoreCase(w.getType()))
                .findFirst()
                .orElse(activeWhs.get(0));
    }

    /**
     * Tự động tìm kiếm Shipper trực thuộc Bưu cục đó để đến lấy hàng.
     * TUYỆT ĐỐI KHÔNG gán shipper của bưu cục khác sang!
     */
    private User findNearestShipper(Warehouse postOffice, DeliveryRoute matchedRoute, Integer provinceId) {
        if (postOffice == null) {
            return null;
        }

        // 1. Nếu tuyến đường đã có bưu tá phụ trách VÀ tuyến đường đó thuộc đúng bưu cục này
        if (matchedRoute != null && postOffice.getId().equals(matchedRoute.getPostOfficeId()) && matchedRoute.getAssignedShipperId() != null) {
            Optional<User> shipperOpt = userRepository.findById(matchedRoute.getAssignedShipperId());
            if (shipperOpt.isPresent() && Boolean.TRUE.equals(shipperOpt.get().getIsActive())) {
                log.info("Gán bưu tá theo tuyến đường phụ trách [{}] của bưu cục {}: {}",
                        matchedRoute.getRouteName(), postOffice.getName(), shipperOpt.get().getFullName());
                return shipperOpt.get();
            }
        }

        // 2. Tìm bưu tá thuộc đúng bưu cục này
        List<User> poShippers = userRepository.findByRoles_RoleNameAndAssignedPostOfficeId("ROLE_SHIPPER", postOffice.getId())
                .stream().filter(u -> Boolean.TRUE.equals(u.getIsActive())).collect(Collectors.toList());
        if (!poShippers.isEmpty()) {
            log.info("Gán bưu tá trực thuộc bưu cục {}: {}", postOffice.getName(), poShippers.get(0).getFullName());
            return poShippers.get(0);
        }

        // 3. Nếu bưu cục chưa có shipper nào, trả về null để Quản lý bưu cục phân công sau (không gán nhầm shipper bưu cục khác)
        log.warn("Bưu cục [{}] (ID: {}) hiện chưa có bưu tá hoạt động. Đơn hàng sẽ chờ bưu cục điều phối.",
                postOffice.getName(), postOffice.getId());
        return null;
    }

    private String normalizeSearchText(String input) {
        if (input == null) return "";
        String temp = Normalizer.normalize(input, Normalizer.Form.NFD);
        Pattern pattern = Pattern.compile("\\p{InCombiningDiacriticalMarks}+");
        String normalized = pattern.matcher(temp).replaceAll("").toLowerCase();
        return normalized.replace('đ', 'd').replace('Đ', 'd').replaceAll("[^a-z0-9\\s]", " ").replaceAll("\\s+", " ").trim();
    }

    private double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Bán kính Trái Đất (km)
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private String extractPostOfficeKeyword(String poName, String poAddress) {
        if (poName != null) {
            String lower = poName.toLowerCase();
            if (lower.contains("bến thành")) return "Bến Thành";
            if (lower.contains("cầu giấy")) return "Cầu Giấy";
            if (lower.contains("hai bà trưng")) return "Hai Bà Trưng";
            if (lower.contains("hoài đức")) return "Hoài Đức";
            if (lower.contains("tân bình")) return "Tân Bình";
            if (lower.contains("hải châu")) return "Hải Châu";
            if (lower.contains("ninh kiều")) return "Ninh Kiều";
            if (lower.contains("the pride")) return "The Pride";
            if (lower.contains("thanh xuân")) return "Thanh Xuân";
            if (lower.contains("hoàng mai")) return "Hoàng Mai";
            String cleaned = poName.replaceAll("(?i)^(bưu cục|kho|hub|trung tâm khai thác)\\s*", "").trim();
            if (!cleaned.isBlank()) return cleaned;
        }
        return "";
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = "order:timeline", key = "#trackingCode")
    public List<OrderTrackingLog> getOrderTimeline(String trackingCode) {
        List<OrderTrackingLog> list = trackingLogRepository.findByTrackingCodeOrderByCreatedAtDesc(trackingCode);
        for (OrderTrackingLog logEntry : list) {
            if (logEntry.getGpsLat() == null && logEntry.getLocationId() != null) {
                warehouseRepository.findById(logEntry.getLocationId()).ifPresent(wh -> {
                    logEntry.setGpsLat(wh.getLatitude());
                    logEntry.setGpsLng(wh.getLongitude());
                });
            }
        }
        return list;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getPublicTrackingData(String trackingCode) {
        OrderResponse order = getOrderByTrackingCode(trackingCode);
        List<OrderTrackingLog> timeline = getOrderTimeline(trackingCode);

        // Bảo mật thông tin cá nhân & mã OTP khi tra cứu công khai
        if (order != null) {
            order.setDeliveryOtp(null);
            if (order.getReceiverPhone() != null && order.getReceiverPhone().length() >= 7) {
                String phone = order.getReceiverPhone();
                order.setReceiverPhone(phone.substring(0, 3) + "****" + phone.substring(phone.length() - 3));
            }
            if (order.getSenderPhone() != null && order.getSenderPhone().length() >= 7) {
                String phone = order.getSenderPhone();
                order.setSenderPhone(phone.substring(0, 3) + "****" + phone.substring(phone.length() - 3));
            }
        }

        List<Map<String, Object>> routeWaypoints = buildRouteWaypoints(order, timeline);

        Map<String, Object> data = new HashMap<>();
        data.put("order", order);
        data.put("timeline", timeline);
        data.put("routeWaypoints", routeWaypoints);
        return data;
    }

    private List<Map<String, Object>> buildRouteWaypoints(OrderResponse order, List<OrderTrackingLog> timeline) {
        List<Map<String, Object>> waypoints = new ArrayList<>();
        if (order == null) return waypoints;

        // 1. Điểm gửi (Shop)
        Map<String, Object> senderWp = new HashMap<>();
        senderWp.put("id", "WP_SENDER");
        senderWp.put("index", 1);
        senderWp.put("name", "Điểm gửi (Shop): " + (order.getSenderName() != null ? order.getSenderName() : "Người gửi"));
        senderWp.put("address", order.getSenderAddress());
        senderWp.put("lat", order.getSenderLat() != null ? order.getSenderLat() : 20.9720);
        senderWp.put("lng", order.getSenderLng() != null ? order.getSenderLng() : 105.7574);
        senderWp.put("type", "SENDER");
        senderWp.put("status", "CREATED");
        senderWp.put("statusLabel", "Khởi tạo đơn hàng");
        senderWp.put("timestamp", order.getCreatedAt());
        senderWp.put("isCompleted", true);
        waypoints.add(senderWp);

        // 2. Trích xuất các trạm/kho từ timeline (sắp xếp tăng dần theo thời gian)
        List<OrderTrackingLog> ascLogs = new ArrayList<>(timeline);
        ascLogs.sort(Comparator.comparing(OrderTrackingLog::getCreatedAt));

        Set<Long> visitedWarehouseIds = new LinkedHashSet<>();
        for (OrderTrackingLog logEntry : ascLogs) {
            Long locId = logEntry.getLocationId();
            if (locId != null && !visitedWarehouseIds.contains(locId)) {
                Warehouse wh = warehouseRepository.findById(locId).orElse(null);
                if (wh != null && wh.getLatitude() != null && wh.getLongitude() != null) {
                    visitedWarehouseIds.add(locId);

                    Map<String, Object> wp = new HashMap<>();
                    wp.put("id", "WP_WH_" + wh.getId());
                    wp.put("index", waypoints.size() + 1);
                    wp.put("name", wh.getName());
                    wp.put("code", wh.getCode());
                    wp.put("address", wh.getAddress());
                    wp.put("lat", wh.getLatitude());
                    wp.put("lng", wh.getLongitude());
                    wp.put("type", wh.getType());
                    wp.put("status", logEntry.getStatus());
                    wp.put("statusLabel", logEntry.getLocationName() != null ? logEntry.getLocationName() : wh.getName());
                    wp.put("timestamp", logEntry.getCreatedAt());
                    wp.put("description", logEntry.getDescription());
                    wp.put("actorName", logEntry.getActorName());
                    wp.put("isCompleted", true);
                    waypoints.add(wp);
                }
            }
        }

        // 3. Điểm nhận (Khách hàng)
        Double recLat = order.getReceiverLat();
        Double recLng = order.getReceiverLng();
        if (recLat == null || recLng == null) {
            if (order.getReceiverProvinceId() != null && order.getReceiverProvinceId() == 79) {
                recLat = 10.7728;
                recLng = 106.7001;
            } else {
                recLat = 10.8231;
                recLng = 106.6297;
            }
        }

        Map<String, Object> receiverWp = new HashMap<>();
        receiverWp.put("id", "WP_RECEIVER");
        receiverWp.put("index", waypoints.size() + 1);
        receiverWp.put("name", "Điểm nhận (Khách): " + (order.getReceiverName() != null ? order.getReceiverName() : "Người nhận"));
        receiverWp.put("address", order.getReceiverAddress());
        receiverWp.put("lat", recLat);
        receiverWp.put("lng", recLng);
        receiverWp.put("type", "RECEIVER");
        receiverWp.put("status", order.getCurrentStatus());
        receiverWp.put("statusLabel", "Điểm giao nhận chặng cuối");
        receiverWp.put("timestamp", order.getDeliveredAt() != null ? order.getDeliveredAt() : order.getUpdatedAt());
        receiverWp.put("isCompleted", "DELIVERED".equalsIgnoreCase(order.getCurrentStatus()));
        waypoints.add(receiverWp);

        // 4. Nếu đơn hàng chuyển hoàn (RETURNING hoặc RETURNED)
        if ("RETURNING".equalsIgnoreCase(order.getCurrentStatus()) || "RETURNED".equalsIgnoreCase(order.getCurrentStatus())) {
            Map<String, Object> returnWp = new HashMap<>();
            returnWp.put("id", "WP_RETURN_SHOP");
            returnWp.put("index", waypoints.size() + 1);
            returnWp.put("name", "Hoàn trả về Shop: " + (order.getSenderName() != null ? order.getSenderName() : "Người gửi"));
            returnWp.put("address", order.getSenderAddress());
            returnWp.put("lat", order.getSenderLat() != null ? order.getSenderLat() : 20.9720);
            returnWp.put("lng", order.getSenderLng() != null ? order.getSenderLng() : 105.7574);
            returnWp.put("type", "RETURN_SENDER");
            returnWp.put("status", order.getCurrentStatus());
            returnWp.put("statusLabel", "RETURNED".equalsIgnoreCase(order.getCurrentStatus()) ? "Đã hoàn trả tận tay Shop thành công" : "Đang luân chuyển hoàn về Shop");
            returnWp.put("timestamp", order.getUpdatedAt());
            returnWp.put("isCompleted", "RETURNED".equalsIgnoreCase(order.getCurrentStatus()));
            waypoints.add(returnWp);
        }

        return waypoints;
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
        String poName = getWarehouseName(order.getAssignedPostOfficeId());

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
                .podPhotoUrl(order.getPodPhotoUrl())
                .podSignatureUrl(order.getPodSignatureUrl())
                .podLatitude(order.getPodLatitude())
                .podLongitude(order.getPodLongitude())
                .podReceiverName(order.getPodReceiverName())
                .deliveryOtp(order.getDeliveryOtp())
                .rescheduledDeliveryDate(order.getRescheduledDeliveryDate())
                .failureProofPhotoUrl(order.getFailureProofPhotoUrl())
                .paymentMethod(order.getPaymentMethod())
                .assignedShipperId(order.getAssignedShipperId())
                .assignedShipperName(order.getAssignedShipperName())
                .assignedShipperPhone(order.getAssignedShipperPhone())
                .assignedPostOfficeId(order.getAssignedPostOfficeId())
                .postOfficeName(poName)
                .assignedRouteId(order.getAssignedRouteId())
                .pickupCompletedAt(order.getPickupCompletedAt())
                .deliveredAt(order.getDeliveredAt())
                .estimatedDeliveryAt(order.getEstimatedDeliveryAt())
                .isReconciled(order.getIsReconciled())
                .reconciliationSheetCode(order.getReconciliationSheetCode())
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
