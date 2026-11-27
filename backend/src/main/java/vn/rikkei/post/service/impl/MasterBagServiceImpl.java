package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.wms.*;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.MasterBagService;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class MasterBagServiceImpl implements MasterBagService {

        private final MasterBagRepository masterBagRepository;
        private final BagItemRepository bagItemRepository;
        private final WarehouseRepository warehouseRepository;
        private final OrderRepository orderRepository;
        private final OrderTrackingLogRepository trackingLogRepository;
        private final UserRepository userRepository;
        private final ShipmentManifestRepository manifestRepository;
        private final WebSocketNotificationService webSocketNotificationService;
        private final vn.rikkei.post.repository.TruckRepository truckRepository;
        private final vn.rikkei.post.kafka.MasterBagKafkaProducer kafkaProducer;
        private final vn.rikkei.post.service.RedisService redisService;
        private final DispatchOrderItemRepository dispatchOrderItemRepository;

        @Override
        public List<MasterBagResponse> getAllBags() {
                return masterBagRepository.findAllByOrderByCreatedAtDesc().stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        @Override
        public List<MasterBagResponse> getBagsByWarehouse(Long warehouseId) {
                return masterBagRepository.findByOriginWarehouseIdOrderByCreatedAtDesc(warehouseId).stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        @Override
        public MasterBagResponse getBagById(Long id) {
                MasterBag bag = masterBagRepository.findById(id)
                                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải ID: " + id));
                return mapToResponse(bag);
        }

        @Override
        public MasterBagResponse getBagByCode(String bagCode) {
                MasterBag bag = masterBagRepository.findByBagCode(bagCode.trim().toUpperCase())
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy bao tải mã: " + bagCode));
                return mapToResponse(bag);
        }

        @Override
        @Transactional
        public MasterBagResponse createBag(CreateMasterBagRequest request, Long userId) {
                Warehouse origin = warehouseRepository.findById(request.getOriginWarehouseId())
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy kho xuất phát ID: " + request.getOriginWarehouseId()));

                Warehouse dest = warehouseRepository.findById(request.getDestWarehouseId())
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy kho đích ID: " + request.getDestWarehouseId()));

                if (origin.getId().equals(dest.getId())) {
                        throw new IllegalArgumentException("Kho xuất phát và Kho đích không được trùng nhau!");
                }

                String bagCode = generateUniqueBagCode();
                String sealNumber = (request.getSealNumber() != null && !request.getSealNumber().isBlank())
                                ? request.getSealNumber().trim().toUpperCase()
                                : ("SEAL-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + "-"
                                                + String.format("%04d", new Random().nextInt(10000)));

                MasterBag bag = MasterBag.builder()
                                .bagCode(bagCode)
                                .originWarehouse(origin)
                                .destWarehouse(dest)
                                .sealNumber(sealNumber)
                                .status("OPEN")
                                .totalItems(0)
                                .totalWeightKg(BigDecimal.ZERO)
                                .notes(request.getNotes())
                                .sealedByUserId(userId)
                                .assignedDriverId(null)
                                .assignedDriverName(null)
                                .assignedDriverPhone(null)
                                .assignedTruckId(null)
                                .assignedTruckPlate(null)
                                .build();

                MasterBag saved = masterBagRepository.save(bag);

                // Nạp các kiện hàng đã quét trực tiếp trong quá trình tạo bao
                if (request.getTrackingCodes() != null && !request.getTrackingCodes().isEmpty()) {
                        int totalItems = 0;
                        BigDecimal totalWeightKg = BigDecimal.ZERO;
                        List<BagItem> items = new ArrayList<>();

                        for (String rawCode : request.getTrackingCodes()) {
                                if (rawCode == null || rawCode.isBlank())
                                        continue;
                                String trackingCode = rawCode.trim().toUpperCase();

                                Order order = orderRepository.findByTrackingCode(trackingCode)
                                                .orElseThrow(() -> new IllegalArgumentException(
                                                                "Không tìm thấy vận đơn: " + trackingCode));

                                int weight = order.getBillableWeightGram() != null ? order.getBillableWeightGram()
                                                : 500;

                                BagItem item = BagItem.builder()
                                                .masterBag(saved)
                                                .trackingCode(trackingCode)
                                                .weightGram(weight)
                                                .itemName(order.getItemName())
                                                .receiverAddress(order.getReceiverAddress())
                                                .routingCode(order.getRoutingCode())
                                                .build();

                                bagItemRepository.save(item);
                                items.add(item);

                                totalItems++;
                                BigDecimal addWeightKg = BigDecimal.valueOf(weight).divide(BigDecimal.valueOf(1000), 2,
                                                RoundingMode.HALF_UP);
                                totalWeightKg = totalWeightKg.add(addWeightKg);

                                // Ghi log hành trình đơn hàng
                                OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                                                .trackingCode(trackingCode)
                                                .status("IN_WAREHOUSE")
                                                .locationType(origin.getType() != null ? origin.getType() : "HUB")
                                                .locationId(origin.getId())
                                                .locationName(origin.getName())
                                                .description(String.format(
                                                                "Đã quét gom vào Bao tải [%s] kẹp chì [%s] chuẩn bị gửi tới [%s]",
                                                                bagCode, sealNumber, dest.getName()))
                                                .actorId(userId)
                                                .actorName("Nhân viên Bàn Đóng bao")
                                                .build();
                                trackingLogRepository.save(trackingLog);

                                try {
                                        webSocketNotificationService.notifyOrderTracking(trackingCode, "IN_WAREHOUSE",
                                                        String.format("Kiện hàng đã gom vào bao tải [%s] kẹp chì [%s]",
                                                                        bagCode, sealNumber));
                                } catch (Exception e) {
                                        log.warn("Lỗi gửi notify tracking order: {}", e.getMessage());
                                }
                        }

                        saved.setTotalItems(totalItems);
                        saved.setTotalWeightKg(totalWeightKg);
                        saved.setStatus("SEALED");
                        saved.setSealedAt(LocalDateTime.now());
                        saved.setItems(items);
                        saved = masterBagRepository.save(saved);
                }

                log.info("Đã tạo bao tải mới mã {} kẹp chì {} từ {} tới {}", bagCode, sealNumber, origin.getName(),
                                dest.getName());

                // Bắn thông báo realtime tới Quản lý kho và nhân viên kho bưu cục đích đến
                try {
                        String destTopic = "/topic/warehouse/" + dest.getId();
                        Map<String, Object> notificationData = new HashMap<>();
                        notificationData.put("type", "MASTER_BAG_CREATED");
                        notificationData.put("bagCode", bagCode);
                        notificationData.put("sealNumber", sealNumber);
                        notificationData.put("originWarehouseId", origin.getId());
                        notificationData.put("originWarehouseName", origin.getName());
                        notificationData.put("destWarehouseId", dest.getId());
                        notificationData.put("destWarehouseName", dest.getName());
                        notificationData.put("totalItems", saved.getTotalItems());
                        notificationData.put("totalWeightKg", saved.getTotalWeightKg());
                        notificationData.put("status", saved.getStatus());
                        notificationData.put("message", String.format(
                                        "Bưu cục [%s] vừa đóng bao tải [%s] (kẹp chì %s) gồm %d kiện hàng gửi tới bưu cục của bạn!",
                                        origin.getName(), bagCode, sealNumber, saved.getTotalItems()));

                        webSocketNotificationService.notifyGeneric(destTopic, notificationData);
                        webSocketNotificationService.notifyGeneric("/topic/master-bags", notificationData);
                } catch (Exception e) {
                        log.warn("Lỗi gửi thông báo WebSocket đóng bao tới kho đích: {}", e.getMessage());
                }

                return mapToResponse(saved);
        }

        @Override
        @Transactional
        public MasterBagResponse addItemToBag(Long bagId, AddBagItemRequest request) {
                MasterBag bag = masterBagRepository.findById(bagId)
                                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải ID: " + bagId));

                if (!"OPEN".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException(
                                        "Bao tải [" + bag.getBagCode() + "] đã được niêm phong/kẹp chì ("
                                                        + bag.getStatus() + "), không thể thêm kiện!");
                }

                String trackingCode = request.getTrackingCode().trim().toUpperCase();

                if (bagItemRepository.existsByMasterBagIdAndTrackingCode(bagId, trackingCode)) {
                        throw new IllegalArgumentException(
                                        "Kiện hàng [" + trackingCode + "] đã có trong bao tải này rồi!");
                }

                Order order = orderRepository.findByTrackingCode(trackingCode)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy vận đơn: " + trackingCode));

                int weight = order.getBillableWeightGram() != null ? order.getBillableWeightGram() : 500;

                BagItem item = BagItem.builder()
                                .masterBag(bag)
                                .trackingCode(trackingCode)
                                .weightGram(weight)
                                .itemName(order.getItemName())
                                .receiverAddress(order.getReceiverAddress())
                                .routingCode(order.getRoutingCode())
                                .build();

                bagItemRepository.save(item);

                // Cập nhật thống kê bao
                int newTotalItems = bag.getTotalItems() + 1;
                BigDecimal addWeightKg = BigDecimal.valueOf(weight).divide(BigDecimal.valueOf(1000), 2,
                                RoundingMode.HALF_UP);
                BigDecimal newTotalWeightKg = bag.getTotalWeightKg().add(addWeightKg);

                bag.setTotalItems(newTotalItems);
                bag.setTotalWeightKg(newTotalWeightKg);
                masterBagRepository.save(bag);

                // Ghi log hành trình đơn hàng
                OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                                .trackingCode(trackingCode)
                                .status("IN_WAREHOUSE")
                                .locationType(bag.getOriginWarehouse().getType() != null
                                                ? bag.getOriginWarehouse().getType()
                                                : "HUB")
                                .locationId(bag.getOriginWarehouse().getId())
                                .locationName(bag.getOriginWarehouse().getName())
                                .description(String.format(
                                                "Đã quét gom vào Bao tải gom hàng [%s] chuẩn bị gửi tới [%s]",
                                                bag.getBagCode(), bag.getDestWarehouse().getName()))
                                .actorId(bag.getSealedByUserId() != null ? bag.getSealedByUserId() : 1L)
                                .actorName("Nhân viên Bàn Đóng bao")
                                .build();
                trackingLogRepository.save(trackingLog);

                webSocketNotificationService.notifyOrderTracking(trackingCode, "IN_WAREHOUSE",
                                String.format("Kiện hàng đã gom vào bao tải [%s]", bag.getBagCode()));

                return mapToResponse(bag);
        }

        @Override
        @Transactional
        public MasterBagResponse removeItemFromBag(Long bagId, String trackingCode) {
                MasterBag bag = masterBagRepository.findById(bagId)
                                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải ID: " + bagId));

                if (!"OPEN".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải đã niêm phong, không thể gỡ kiện hàng!");
                }

                String cleanCode = trackingCode.trim().toUpperCase();
                BagItem item = bagItemRepository.findByTrackingCode(cleanCode)
                                .filter(i -> i.getMasterBag().getId().equals(bagId))
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy kiện hàng " + cleanCode + " trong bao"));

                int weight = item.getWeightGram();
                bagItemRepository.delete(item);

                bag.setTotalItems(Math.max(0, bag.getTotalItems() - 1));
                BigDecimal subWeightKg = BigDecimal.valueOf(weight).divide(BigDecimal.valueOf(1000), 2,
                                RoundingMode.HALF_UP);
                bag.setTotalWeightKg(bag.getTotalWeightKg().subtract(subWeightKg).max(BigDecimal.ZERO));
                masterBagRepository.save(bag);

                return mapToResponse(bag);
        }

        @Override
        @Transactional
        public MasterBagResponse sealBag(Long bagId, SealMasterBagRequest request, Long userId) {
                MasterBag bag = masterBagRepository.findById(bagId)
                                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải ID: " + bagId));

                if (!"OPEN".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải này đã được niêm phong trước đó rồi!");
                }

                if (bag.getTotalItems() == 0) {
                        throw new IllegalStateException(
                                        "Không thể niêm phong bao tải rỗng! Vui lòng quét ít nhất 1 kiện hàng vào bao.");
                }

                String cleanSeal = request.getSealNumber().trim().toUpperCase();

                if (masterBagRepository.existsBySealNumber(cleanSeal)) {
                        throw new IllegalArgumentException(
                                        "Mã kẹp chì (Seal) [" + cleanSeal + "] đã được sử dụng cho một bao tải khác!");
                }

                bag.setSealNumber(cleanSeal);
                bag.setStatus("SEALED");
                bag.setSealedAt(LocalDateTime.now());
                bag.setSealedByUserId(userId);
                masterBagRepository.save(bag);

                // Ghi log kẹp chì cho tất cả các kiện bên trong
                List<BagItem> items = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(bagId);
                for (BagItem it : items) {
                        OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                                        .trackingCode(it.getTrackingCode())
                                        .status("IN_WAREHOUSE")
                                        .locationType("HUB")
                                        .locationId(bag.getOriginWarehouse().getId())
                                        .locationName(bag.getOriginWarehouse().getName())
                                        .description(String.format(
                                                        "Bao tải [%s] đã được niêm phong kẹp chì số [%s] (Tổng %d kiện, %.2f kg). Sẵn sàng xuất kho lên xe.",
                                                        bag.getBagCode(), cleanSeal, bag.getTotalItems(),
                                                        bag.getTotalWeightKg()))
                                        .actorId(userId)
                                        .actorName("Nhân viên Niêm phong")
                                        .build();
                        trackingLogRepository.save(trackingLog);

                        webSocketNotificationService.notifyOrderTracking(it.getTrackingCode(), "IN_WAREHOUSE",
                                        String.format("Bao tải đã niêm phong kẹp chì [%s]", cleanSeal));
                }

                log.info("Đã niêm phong kẹp chì bao tải {} với mã seal {}", bag.getBagCode(), cleanSeal);
                return mapToResponse(bag);
        }

        @Override
        @Transactional
        public MasterBagResponse unsealBag(Long bagId, Long userId) {
                MasterBag bag = masterBagRepository.findById(bagId)
                                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải ID: " + bagId));

                bag.setStatus("UNSEALED");
                masterBagRepository.save(bag);

                // Đánh dấu các kiện hàng bên trong đã nhập kho tại kho đích
                List<BagItem> items = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(bagId);
                for (BagItem it : items) {
                        orderRepository.findByTrackingCode(it.getTrackingCode()).ifPresent(order -> {
                                order.setCurrentStatus("AT_SORTING_HUB");
                                order.setAssignedPostOfficeId(bag.getDestWarehouse().getId());
                                order.setAssignedShipperId(null);
                                order.setAssignedShipperName(null);
                                order.setAssignedShipperPhone(null);
                                orderRepository.save(order);
                                if (redisService != null) {
                                        redisService.evictOrderCache(order.getTrackingCode());
                                }
                        });

                        OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                                        .trackingCode(it.getTrackingCode())
                                        .status("IN_WAREHOUSE")
                                        .locationType(bag.getDestWarehouse().getType() != null
                                                        ? bag.getDestWarehouse().getType()
                                                        : "HUB")
                                        .locationId(bag.getDestWarehouse().getId())
                                        .locationName(bag.getDestWarehouse().getName())
                                        .description(String.format(
                                                        "Bao tải [%s] (Kẹp chì [%s]) đã đến và được cắt chì, nhập kho tại [%s]",
                                                        bag.getBagCode(), bag.getSealNumber(),
                                                        bag.getDestWarehouse().getName()))
                                        .actorId(userId)
                                        .actorName("Nhân viên Tiếp nhận & Mở bao")
                                        .build();
                        trackingLogRepository.save(trackingLog);

                        webSocketNotificationService.notifyOrderTracking(it.getTrackingCode(), "IN_WAREHOUSE",
                                        String.format("Đã cắt chì bao tải tại kho [%s]",
                                                        bag.getDestWarehouse().getName()));
                }

                return mapToResponse(bag);
        }

        @Override
        @Transactional
        public MasterBagResponse assignDriver(Long bagId, vn.rikkei.post.dto.wms.AssignBagDriverRequest request,
                        Long userId) {
                MasterBag bag = masterBagRepository.findById(bagId)
                                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải ID: " + bagId));

                User driver = userRepository.findById(request.getDriverId())
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy thông tin tài xế ID: " + request.getDriverId()));

                vn.rikkei.post.entity.Truck truck = null;
                if (request.getTruckId() != null) {
                        truck = truckRepository.findById(request.getTruckId()).orElse(null);
                }

                bag.setAssignedDriverId(driver.getId());
                bag.setAssignedDriverName(driver.getFullName());
                bag.setAssignedDriverPhone(driver.getPhoneNumber());
                if (truck != null) {
                        bag.setAssignedTruckId(truck.getId());
                        bag.setAssignedTruckPlate(truck.getLicensePlate());
                }
                if (request.getNotes() != null && !request.getNotes().isBlank()) {
                        bag.setNotes((bag.getNotes() != null ? bag.getNotes() + ". " : "") + request.getNotes());
                }
                bag.setStatus("ASSIGNED_TO_DRIVER");
                MasterBag saved = masterBagRepository.save(bag);

                log.info("Đã gán tài xế xe tải {} (SĐT: {}) cho bao tải {}", driver.getFullName(),
                                driver.getPhoneNumber(), bag.getBagCode());

                // Bắn thông báo realtime tới tài xế xe tải
                try {
                        Map<String, Object> notif = new HashMap<>();
                        notif.put("type", "BAG_ASSIGNED_TO_DRIVER");
                        notif.put("bagCode", bag.getBagCode());
                        notif.put("sealNumber", bag.getSealNumber());
                        notif.put("originWarehouseName", bag.getOriginWarehouse().getName());
                        notif.put("destWarehouseName", bag.getDestWarehouse().getName());
                        notif.put("totalItems", bag.getTotalItems());
                        notif.put("totalWeightKg", bag.getTotalWeightKg());
                        notif.put("truckPlate", bag.getAssignedTruckPlate());
                        notif.put("message",
                                        String.format("Bạn vừa được gán nhận vận chuyển Bao tải [%s] từ [%s] tới [%s]!",
                                                        bag.getBagCode(), bag.getOriginWarehouse().getName(),
                                                        bag.getDestWarehouse().getName()));

                        webSocketNotificationService.notifyGeneric("/topic/driver/" + driver.getId(), notif);
                        webSocketNotificationService.notifyGeneric("/topic/master-bags", notif);
                } catch (Exception ex) {
                        log.warn("Lỗi gửi thông báo websocket tới tài xế: {}", ex.getMessage());
                }

                return mapToResponse(saved);
        }

        @Override
        @Transactional(readOnly = true)
        public List<MasterBagResponse> getDriverBags(Long driverId) {
                return masterBagRepository.findDriverTasksWithAvailableBags(driverId).stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        @Override
        @Transactional(readOnly = true)
        public List<MasterBagResponse> getIncomingBagsForHub(Long hubWarehouseId) {
                List<String> activeStatuses = List.of("SEALED", "ASSIGNED_TO_DRIVER", "IN_TRANSIT", "ARRIVED_AT_HUB");
                return masterBagRepository
                                .findByDestWarehouseIdAndStatusInOrderByCreatedAtDesc(hubWarehouseId, activeStatuses)
                                .stream()
                                .map(this::mapToResponse)
                                .toList();
        }

        @Override
        @Transactional
        public MasterBagResponse driverScanTransit(String bagCode, Long driverId) {
                final String cleanCode = bagCode != null ? bagCode.trim().toUpperCase() : "";
                MasterBag bag = masterBagRepository.findByBagCode(cleanCode)
                                .or(() -> masterBagRepository.findBySealNumber(cleanCode))
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy bao tải với mã bao/mã seal: " + cleanCode));

                User driver = userRepository.findById(driverId)
                                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài xế!"));

                boolean isAdmin = driver.getRoles().stream()
                                .anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));

                if ("OPEN".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải [" + bag.getBagCode()
                                        + "] chưa được kẹp chì niêm phong! Vui lòng kẹp chì trước khi xuất kho.");
                }

                if ("IN_TRANSIT".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải [" + bag.getBagCode()
                                        + "] đã ở trạng thái Đang trung chuyển trước đó!");
                }

                if ("ARRIVED_AT_HUB".equalsIgnoreCase(bag.getStatus()) || "UNSEALED".equalsIgnoreCase(bag.getStatus())
                                || "RECEIVED".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải [" + bag.getBagCode()
                                        + "] đã đến kho đích hoặc đã hoàn thành, không thể quét nhận!");
                }

                // Nếu bao tải đã được gán/nhận bởi tài xế khác
                if (!isAdmin && bag.getAssignedDriverId() != null && !bag.getAssignedDriverId().equals(driverId)) {
                        String assignedName = bag.getAssignedDriverName() != null ? bag.getAssignedDriverName()
                                        : "tài xế khác";
                        throw new org.springframework.security.access.AccessDeniedException(
                                        "Từ chối quyền quét nhận: Bao tải này đã được tài xế [" + assignedName
                                                        + "] nhận trước đó! Vui lòng kiểm tra lại.");
                }

                // Gán tên và thông tin tài xế cho bao tải khi tài xế quét mã
                bag.setAssignedDriverId(driver.getId());
                bag.setAssignedDriverName(driver.getFullName());
                bag.setAssignedDriverPhone(driver.getPhoneNumber());

                // Tự động gán xe tải mà tài xế đang phụ trách (nếu có)
                List<vn.rikkei.post.entity.Truck> driverTrucks = truckRepository.findByCurrentDriverId(driver.getId());
                if (!driverTrucks.isEmpty()) {
                        vn.rikkei.post.entity.Truck currentTruck = driverTrucks.get(0);
                        bag.setAssignedTruckId(currentTruck.getId());
                        bag.setAssignedTruckPlate(currentTruck.getLicensePlate());
                        currentTruck.setStatus("IN_TRANSIT");
                        truckRepository.save(currentTruck);
                } else if (bag.getAssignedTruckId() != null) {
                        truckRepository.findById(bag.getAssignedTruckId()).ifPresent(tr -> {
                                tr.setStatus("IN_TRANSIT");
                                truckRepository.save(tr);
                        });
                }

                bag.setStatus("IN_TRANSIT");
                bag.setDispatchedAt(LocalDateTime.now());
                MasterBag saved = masterBagRepository.save(bag);

                // Lấy danh sách tracking codes trong bao tải
                List<BagItem> items = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(saved.getId());
                List<String> trackingCodes = items.stream().map(BagItem::getTrackingCode).toList();

                // Ghi log hành trình cho các đơn hàng trong bao
                for (String tc : trackingCodes) {
                        OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                                        .trackingCode(tc)
                                        .status("IN_TRANSIT")
                                        .locationType("TRUCK")
                                        .locationId(saved.getOriginWarehouse().getId())
                                        .locationName(saved.getOriginWarehouse().getName())
                                        .description(String.format(
                                                        "Tài xế [%s] (SĐT: %s%s) đã quét nhận bao tải [%s] lên xe, đang trung chuyển tới [%s]",
                                                        driver.getFullName(), driver.getPhoneNumber(),
                                                        saved.getAssignedTruckPlate() != null ? " - Xe: " + saved.getAssignedTruckPlate() : "",
                                                        saved.getBagCode(), saved.getDestWarehouse().getName()))
                                        .actorId(driver.getId())
                                        .actorName(driver.getFullName())
                                        .build();
                        trackingLogRepository.save(trackingLog);

                        try {
                                webSocketNotificationService.notifyOrderTracking(tc, "IN_TRANSIT",
                                                String.format("Đang trên xe trung chuyển của tài xế [%s] tới [%s]",
                                                                driver.getFullName(), saved.getDestWarehouse().getName()));
                        } catch (Exception e) {
                                log.warn("Lỗi gửi notify tracking order: {}", e.getMessage());
                        }
                }

                // Bắn sự kiện qua KAFKA để tự động chuyển trạng thái của tất cả các đơn hàng và ghi log hành trình
                vn.rikkei.post.dto.kafka.MasterBagTransitKafkaEvent event = vn.rikkei.post.dto.kafka.MasterBagTransitKafkaEvent
                                .builder()
                                .eventType("DEPARTURE_TO_HUB")
                                .bagCode(saved.getBagCode())
                                .sealNumber(saved.getSealNumber())
                                .originWarehouseId(saved.getOriginWarehouse().getId())
                                .originWarehouseName(saved.getOriginWarehouse().getName())
                                .destWarehouseId(saved.getDestWarehouse().getId())
                                .destWarehouseName(saved.getDestWarehouse().getName())
                                .driverId(driver.getId())
                                .driverName(driver.getFullName())
                                .driverPhone(driver.getPhoneNumber())
                                .truckId(saved.getAssignedTruckId())
                                .truckPlate(saved.getAssignedTruckPlate())
                                .timestamp(LocalDateTime.now())
                                .trackingCodes(trackingCodes)
                                .build();

                kafkaProducer.sendTransitEvent(event);

                // Gửi thông báo WebSocket
                try {
                        Map<String, Object> notif = new HashMap<>();
                        notif.put("type", "MASTER_BAG_IN_TRANSIT");
                        notif.put("bagCode", saved.getBagCode());
                        notif.put("sealNumber", saved.getSealNumber());
                        notif.put("driverName", driver.getFullName());
                        notif.put("driverPhone", driver.getPhoneNumber());
                        notif.put("truckPlate", saved.getAssignedTruckPlate());
                        notif.put("originWarehouseName", saved.getOriginWarehouse().getName());
                        notif.put("destWarehouseName", saved.getDestWarehouse().getName());
                        notif.put("totalItems", saved.getTotalItems());
                        notif.put("message", String.format("Tài xế [%s] đã quét nhận bao tải [%s] lên xe vận chuyển!",
                                        driver.getFullName(), saved.getBagCode()));

                        webSocketNotificationService.notifyGeneric("/topic/master-bags", notif);
                        webSocketNotificationService.notifyGeneric("/topic/driver/" + driver.getId(), notif);
                } catch (Exception ex) {
                        log.warn("Lỗi gửi thông báo websocket khi tài xế quét nhận: {}", ex.getMessage());
                }

                log.info("Tài xế {} ({}) đã quét mã code bao tải {} lên xe khởi hành trung chuyển", driver.getFullName(),
                                driver.getId(), saved.getBagCode());

                return mapToResponse(saved);
        }

        @Override
        @Transactional
        public MasterBagResponse hubScanInbound(String bagCode, Long hubWarehouseId, Long operatorId) {
                final String cleanCode = bagCode != null ? bagCode.trim().toUpperCase() : "";
                MasterBag bag = masterBagRepository.findByBagCode(cleanCode)
                                .or(() -> masterBagRepository.findBySealNumber(cleanCode))
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy bao tải với mã bao/mã seal: " + cleanCode));

                User operator = userRepository.findById(operatorId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy thông tin nhân sự thao tác!"));

                Warehouse hub = warehouseRepository.findById(hubWarehouseId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Không tìm thấy kho Hub ID: " + hubWarehouseId));

                if ("ARRIVED_AT_HUB".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải [" + bag.getBagCode() + "] đã được quét tiếp nhận nhập kho đích từ trước rồi!");
                }

                if ("OPEN".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải [" + bag.getBagCode() + "] hiện đang mở, chưa được đóng bao và kẹp chì!");
                }

                if (!"IN_TRANSIT".equalsIgnoreCase(bag.getStatus())
                                && !"ASSIGNED_TO_DRIVER".equalsIgnoreCase(bag.getStatus())
                                && !"SEALED".equalsIgnoreCase(bag.getStatus())
                                && !"MANIFESTED".equalsIgnoreCase(bag.getStatus())
                                && !"DISPATCHED".equalsIgnoreCase(bag.getStatus())) {
                        throw new IllegalStateException("Bao tải [" + bag.getBagCode() + "] hiện đang ở trạng thái ["
                                        + bag.getStatus() + "], không thể quét tiếp nhận nhập kho!");
                }

                bag.setStatus("ARRIVED_AT_HUB");
                bag.setArrivedAtHubAt(LocalDateTime.now());
                MasterBag saved = masterBagRepository.save(bag);

                // Cập nhật trạng thái xe tải về AT_WAREHOUSE tại Hub này
                if (saved.getAssignedTruckId() != null) {
                        truckRepository.findById(saved.getAssignedTruckId()).ifPresent(tr -> {
                                tr.setStatus("AT_WAREHOUSE");
                                tr.setCurrentWarehouse(hub);
                                truckRepository.save(tr);
                        });
                }

                List<BagItem> items = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(saved.getId());
                List<String> trackingCodes = items.stream().map(BagItem::getTrackingCode).toList();

                // Bắn sự kiện qua KAFKA để chuyển toàn bộ trạng thái đơn hàng trong bao tải về
                // đang ở kho trung chuyển hiện tại
                vn.rikkei.post.dto.kafka.MasterBagTransitKafkaEvent event = vn.rikkei.post.dto.kafka.MasterBagTransitKafkaEvent
                                .builder()
                                .eventType("ARRIVED_AT_HUB")
                                .bagCode(saved.getBagCode())
                                .sealNumber(saved.getSealNumber())
                                .originWarehouseId(saved.getOriginWarehouse().getId())
                                .originWarehouseName(saved.getOriginWarehouse().getName())
                                .destWarehouseId(hub.getId())
                                .destWarehouseName(hub.getName())
                                .driverId(saved.getAssignedDriverId())
                                .driverName(saved.getAssignedDriverName())
                                .driverPhone(saved.getAssignedDriverPhone())
                                .truckId(saved.getAssignedTruckId())
                                .truckPlate(saved.getAssignedTruckPlate())
                                .operatorId(operator.getId())
                                .operatorName(operator.getFullName())
                                .timestamp(LocalDateTime.now())
                                .trackingCodes(trackingCodes)
                                .build();

                kafkaProducer.sendTransitEvent(event);

                // Cập nhật trạng thái DispatchOrderItem nếu bao tải này nằm trong chuyến xe điều vận
                try {
                    dispatchOrderItemRepository.findFirstByBagCodeOrderByScannedAtDesc(saved.getBagCode()).ifPresent(item -> {
                        item.setIsReceivedAtDest(true);
                        item.setReceivedAt(LocalDateTime.now());
                        item.setReceiverUserId(operator.getId());
                        item.setReceiverUserName(operator.getFullName());
                        dispatchOrderItemRepository.save(item);

                        DispatchOrder dispatch = item.getDispatchOrder();
                        if (dispatch != null) {
                            boolean allReceived = dispatch.getItems().stream()
                                    .allMatch(it -> Boolean.TRUE.equals(it.getIsReceivedAtDest()) || it.getId().equals(item.getId()));

                            Map<String, Object> dispatchMsg = new HashMap<>();
                            dispatchMsg.put("type", "DISPATCH_BAG_RECEIVED");
                            dispatchMsg.put("bagCode", saved.getBagCode());
                            dispatchMsg.put("sealNumber", saved.getSealNumber());
                            dispatchMsg.put("dispatchId", dispatch.getId());
                            dispatchMsg.put("dispatchCode", dispatch.getDispatchCode());
                            dispatchMsg.put("status", dispatch.getStatus());
                            dispatchMsg.put("isReceivedAtDest", true);
                            dispatchMsg.put("allReceived", allReceived);
                            dispatchMsg.put("receiverUserName", operator.getFullName());
                            dispatchMsg.put("receivedAt", LocalDateTime.now().toString());
                            dispatchMsg.put("message", String.format("Kho đích [%s] đã quét tiếp nhận bao tải [%s] của chuyến xe [%s]!",
                                    hub.getName(), saved.getBagCode(), dispatch.getDispatchCode()));

                            webSocketNotificationService.notifyGeneric("/topic/dispatch-orders", dispatchMsg);
                            webSocketNotificationService.notifyGeneric("/topic/master-bags", dispatchMsg);
                            if (dispatch.getDriver() != null) {
                                webSocketNotificationService.notifyGeneric("/topic/driver/" + dispatch.getDriver().getId(), dispatchMsg);
                            }
                        }
                    });
                } catch (Exception ex) {
                    log.warn("Lỗi cập nhật DispatchOrderItem hoặc gửi WebSocket trong hubScanInbound: {}", ex.getMessage());
                }

                log.info("Kho Hub {} ({}) đã quét tiếp nhận bao tải {} từ tài xế {}",
                                hub.getName(), operator.getFullName(), saved.getBagCode(),
                                saved.getAssignedDriverName());

                return mapToResponse(saved);
        }

    private MasterBagResponse mapToResponse(MasterBag bag) {
        List<BagItem> items = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(bag.getId());
        List<BagItemResponse> itemDtos = items.stream().map(it -> BagItemResponse.builder()
                .id(it.getId())
                .trackingCode(it.getTrackingCode())
                .weightGram(it.getWeightGram())
                .itemName(it.getItemName())
                .receiverAddress(it.getReceiverAddress())
                .routingCode(it.getRoutingCode())
                .scannedAt(it.getScannedAt())
                .build()).toList();

        String sealedName = null;
        if (bag.getSealedByUserId() != null) {
            sealedName = userRepository.findById(bag.getSealedByUserId())
                    .map(User::getFullName)
                    .orElse("ID: " + bag.getSealedByUserId());
        }

        String manifestCode = bag.getManifestId() != null ? ("MNF-" + bag.getManifestId()) : null;

        String statusDesc = switch (bag.getStatus()) {
            case "OPEN" -> "Đang gom hàng";
            case "SEALED" -> "Đã kẹp chì niêm phong";
            case "ASSIGNED_TO_DRIVER" -> "Đã gán tài xế xe tải";
            case "IN_TRANSIT" -> "Đang trên xe trung chuyển";
            case "ARRIVED_AT_HUB" -> "Đã đến kho Hub trung chuyển";
            case "UNSEALED" -> "Đã cắt chì mở bao";
            default -> bag.getStatus();
        };

        return MasterBagResponse.builder()
                .id(bag.getId())
                .bagCode(bag.getBagCode())
                .originWarehouseId(bag.getOriginWarehouse() != null ? bag.getOriginWarehouse().getId() : null)
                .originWarehouseName(bag.getOriginWarehouse() != null ? bag.getOriginWarehouse().getName() : "")
                .destWarehouseId(bag.getDestWarehouse() != null ? bag.getDestWarehouse().getId() : null)
                .destWarehouseName(bag.getDestWarehouse() != null ? bag.getDestWarehouse().getName() : "")
                .sealNumber(bag.getSealNumber())
                .status(bag.getStatus())
                .statusDescription(statusDesc)
                .assignedDriverId(bag.getAssignedDriverId())
                .assignedDriverName(bag.getAssignedDriverName())
                .assignedDriverPhone(bag.getAssignedDriverPhone())
                .assignedTruckId(bag.getAssignedTruckId())
                .assignedTruckPlate(bag.getAssignedTruckPlate())
                .dispatchedAt(bag.getDispatchedAt())
                .arrivedAtHubAt(bag.getArrivedAtHubAt())
                .totalItems(bag.getTotalItems())
                .totalWeightKg(bag.getTotalWeightKg())
                .sealedByUserId(bag.getSealedByUserId())
                .sealedByUserName(sealedName)
                .sealedAt(bag.getSealedAt())
                .manifestId(bag.getManifestId())
                .manifestCode(manifestCode)
                .notes(bag.getNotes())
                .createdAt(bag.getCreatedAt())
                .items(itemDtos)
                .build();
    }

        private synchronized String generateUniqueBagCode() {
                String datePrefix = "BAG" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
                Random random = new Random();
                String code;
                do {
                        int seq = 1000 + random.nextInt(9000);
                        code = datePrefix + seq;
                } while (masterBagRepository.existsByBagCode(code));
                return code;
        }
}
