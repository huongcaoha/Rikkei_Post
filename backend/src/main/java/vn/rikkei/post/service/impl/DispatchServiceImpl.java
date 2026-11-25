package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.criteria.Predicate;
import vn.rikkei.post.dto.dispatch.*;
import vn.rikkei.post.dto.wms.BagItemResponse;
import vn.rikkei.post.dto.wms.MasterBagResponse;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.DispatchService;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class DispatchServiceImpl implements DispatchService {

    private final DispatchOrderRepository dispatchOrderRepository;
    private final DispatchOrderItemRepository dispatchOrderItemRepository;
    private final MasterBagRepository masterBagRepository;
    private final BagItemRepository bagItemRepository;
    private final WarehouseRepository warehouseRepository;
    private final UserRepository userRepository;
    private final TruckRepository truckRepository;
    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final WebSocketNotificationService webSocketNotificationService;
    private final vn.rikkei.post.service.RedisService redisService;

    @Override
    public List<DispatchOrderResponse> getDispatchOrders(
            Long originWarehouseId,
            Long destWarehouseId,
            String status,
            LocalDateTime startDate,
            LocalDateTime endDate
    ) {
        String cleanStatus = (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status))
                ? status.trim().toUpperCase() : null;

        Specification<DispatchOrder> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (originWarehouseId != null) {
                predicates.add(cb.equal(root.get("originWarehouse").get("id"), originWarehouseId));
            }
            if (destWarehouseId != null) {
                predicates.add(cb.equal(root.get("destWarehouse").get("id"), destWarehouseId));
            }
            if (cleanStatus != null) {
                predicates.add(cb.equal(root.get("status"), cleanStatus));
            }
            if (startDate != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startDate));
            }
            if (endDate != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endDate));
            }
            if (query != null) {
                query.orderBy(cb.desc(root.get("createdAt")));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        List<DispatchOrder> list = dispatchOrderRepository.findAll(spec);
        return list.stream().map(this::mapToResponse).toList();
    }

    @Override
    public DispatchOrderResponse getDispatchById(Long id) {
        DispatchOrder order = dispatchOrderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lệnh điều vận ID: " + id));
        return mapToResponse(order);
    }

    @Override
    public DispatchOrderResponse getDispatchByCode(String code) {
        DispatchOrder order = dispatchOrderRepository.findByDispatchCode(code.trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lệnh điều vận mã: " + code));
        return mapToResponse(order);
    }

    @Override
    @Transactional
    public DispatchOrderResponse createDispatchOrder(CreateDispatchOrderRequest request, Long userId) {
        Warehouse origin = warehouseRepository.findById(request.getOriginWarehouseId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho xuất phát ID: " + request.getOriginWarehouseId()));

        Warehouse dest = warehouseRepository.findById(request.getDestWarehouseId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho đích đến ID: " + request.getDestWarehouseId()));

        if (origin.getId().equals(dest.getId())) {
            throw new IllegalArgumentException("Kho xuất phát và Kho đích đến không được trùng nhau!");
        }

        User driver = userRepository.findById(request.getDriverId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài xế ID: " + request.getDriverId()));

        User creator = userRepository.findById(userId).orElse(null);

        Truck truck = null;
        if (request.getTruckId() != null) {
            truck = truckRepository.findById(request.getTruckId()).orElse(null);
        }

        String dispatchCode = generateUniqueDispatchCode();
        LocalDateTime departureTime = request.getDepartureTime() != null ? request.getDepartureTime() : LocalDateTime.now();

        DispatchOrder dispatch = DispatchOrder.builder()
                .dispatchCode(dispatchCode)
                .originWarehouse(origin)
                .destWarehouse(dest)
                .driver(driver)
                .driverName(driver.getFullName())
                .driverPhone(driver.getPhoneNumber())
                .truck(truck)
                .truckPlate(truck != null ? truck.getLicensePlate() : null)
                .status("PICKED_UP")
                .notes(request.getNotes())
                .departureTime(departureTime)
                .createdUserId(userId)
                .createdUserName(creator != null ? creator.getFullName() : "Quản lý Hub")
                .totalBags(0)
                .totalWeightKg(BigDecimal.ZERO)
                .totalItems(0)
                .build();

        DispatchOrder saved = dispatchOrderRepository.save(dispatch);

        // Nạp các bao tải vào chuyến xe
        int bagCount = 0;
        int totalItems = 0;
        BigDecimal totalWeight = BigDecimal.ZERO;
        List<DispatchOrderItem> items = new ArrayList<>();

        if (request.getBagCodes() != null && !request.getBagCodes().isEmpty()) {
            Set<String> uniqueCodes = new LinkedHashSet<>(request.getBagCodes());
            for (String rawCode : uniqueCodes) {
                if (rawCode == null || rawCode.isBlank()) continue;
                String cleanCode = rawCode.trim().toUpperCase();

                MasterBag bag = masterBagRepository.findByBagCode(cleanCode)
                        .or(() -> masterBagRepository.findBySealNumber(cleanCode))
                        .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải với mã bao/seal: " + cleanCode));

                DispatchOrderItem item = DispatchOrderItem.builder()
                        .dispatchOrder(saved)
                        .masterBag(bag)
                        .bagCode(bag.getBagCode())
                        .sealNumber(bag.getSealNumber())
                        .totalItems(bag.getTotalItems() != null ? bag.getTotalItems() : 0)
                        .weightKg(bag.getTotalWeightKg() != null ? bag.getTotalWeightKg() : BigDecimal.ZERO)
                        .isReceivedAtDest(false)
                        .build();

                dispatchOrderItemRepository.save(item);
                items.add(item);

                // Cập nhật bao tải: gán thông tin chuyến xe & tài xế
                bag.setAssignedDriverId(driver.getId());
                bag.setAssignedDriverName(driver.getFullName());
                bag.setAssignedDriverPhone(driver.getPhoneNumber());
                if (truck != null) {
                    bag.setAssignedTruckId(truck.getId());
                    bag.setAssignedTruckPlate(truck.getLicensePlate());
                }
                bag.setStatus("ASSIGNED_TO_DRIVER");
                masterBagRepository.save(bag);

                bagCount++;
                totalItems += item.getTotalItems();
                totalWeight = totalWeight.add(item.getWeightKg());
            }
        }

        saved.setTotalBags(bagCount);
        saved.setTotalItems(totalItems);
        saved.setTotalWeightKg(totalWeight);
        saved.setItems(items);
        dispatchOrderRepository.save(saved);

        // Cập nhật trạng thái xe tải nếu có
        if (truck != null) {
            truck.setCurrentWarehouse(origin);
            truckRepository.save(truck);
        }

        // Gửi thông báo WebSocket đến Quản lý và nhân viên tại kho Hub đích đến
        try {
            Map<String, Object> notifData = new HashMap<>();
            notifData.put("type", "NEW_DISPATCH_ORDER");
            notifData.put("dispatchCode", dispatchCode);
            notifData.put("originWarehouseName", origin.getName());
            notifData.put("destWarehouseName", dest.getName());
            notifData.put("destWarehouseId", dest.getId());
            notifData.put("driverName", driver.getFullName());
            notifData.put("truckPlate", truck != null ? truck.getLicensePlate() : "N/A");
            notifData.put("totalBags", bagCount);
            notifData.put("message", String.format("Chuyến xe điều vận [%s] từ [%s] chở [%d bao tải] đang được chuẩn bị trung chuyển tới kho của bạn.",
                    dispatchCode, origin.getName(), bagCount));

            // Bắn vào topic kho đích
            webSocketNotificationService.notifyGeneric("/topic/hub/" + dest.getId() + "/dispatch", notifData);
            webSocketNotificationService.notifyGeneric("/topic/driver/" + driver.getId(), notifData);
            webSocketNotificationService.notifyGeneric("/topic/notifications", notifData);
            log.info("Đã gửi thông báo điều vận chuyến xe {} tới kho Hub đích {}", dispatchCode, dest.getName());
        } catch (Exception ex) {
            log.warn("Lỗi gửi thông báo WebSocket điều vận: {}", ex.getMessage());
        }

        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public DispatchOrderResponse updateDispatchOrder(Long id, UpdateDispatchOrderRequest request, Long userId) {
        DispatchOrder dispatch = dispatchOrderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lệnh điều vận ID: " + id));

        if ("COMPLETED".equalsIgnoreCase(dispatch.getStatus())) {
            throw new IllegalStateException("Chuyến xe điều vận đã hoàn tất giao xong (COMPLETED), không thể chỉnh sửa!");
        }
        if ("CANCELLED".equalsIgnoreCase(dispatch.getStatus())) {
            throw new IllegalStateException("Chuyến xe điều vận đã bị hủy, không thể chỉnh sửa!");
        }

        if (request.getDriverId() != null) {
            User driver = userRepository.findById(request.getDriverId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài xế ID: " + request.getDriverId()));
            dispatch.setDriver(driver);
            dispatch.setDriverName(driver.getFullName());
            dispatch.setDriverPhone(driver.getPhoneNumber());
        }

        if (request.getTruckId() != null) {
            Truck truck = truckRepository.findById(request.getTruckId()).orElse(null);
            dispatch.setTruck(truck);
            dispatch.setTruckPlate(truck != null ? truck.getLicensePlate() : null);
        }

        if (request.getDestWarehouseId() != null) {
            Warehouse dest = warehouseRepository.findById(request.getDestWarehouseId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho đích ID: " + request.getDestWarehouseId()));
            dispatch.setDestWarehouse(dest);
        }

        if (request.getNotes() != null) {
            dispatch.setNotes(request.getNotes());
        }

        if (request.getDepartureTime() != null) {
            dispatch.setDepartureTime(request.getDepartureTime());
        }

        // Cập nhật lại danh sách bao tải nếu có truyền
        if (request.getBagCodes() != null) {
            dispatch.getItems().clear();
            int bagCount = 0;
            int totalItems = 0;
            BigDecimal totalWeight = BigDecimal.ZERO;

            Set<String> uniqueCodes = new LinkedHashSet<>(request.getBagCodes());
            for (String rawCode : uniqueCodes) {
                if (rawCode == null || rawCode.isBlank()) continue;
                String cleanCode = rawCode.trim().toUpperCase();

                MasterBag bag = masterBagRepository.findByBagCode(cleanCode)
                        .or(() -> masterBagRepository.findBySealNumber(cleanCode))
                        .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải: " + cleanCode));

                DispatchOrderItem item = DispatchOrderItem.builder()
                        .dispatchOrder(dispatch)
                        .masterBag(bag)
                        .bagCode(bag.getBagCode())
                        .sealNumber(bag.getSealNumber())
                        .totalItems(bag.getTotalItems() != null ? bag.getTotalItems() : 0)
                        .weightKg(bag.getTotalWeightKg() != null ? bag.getTotalWeightKg() : BigDecimal.ZERO)
                        .isReceivedAtDest(false)
                        .build();

                dispatch.getItems().add(item);
                bagCount++;
                totalItems += item.getTotalItems();
                totalWeight = totalWeight.add(item.getWeightKg());
            }

            dispatch.setTotalBags(bagCount);
            dispatch.setTotalItems(totalItems);
            dispatch.setTotalWeightKg(totalWeight);
        }

        DispatchOrder saved = dispatchOrderRepository.save(dispatch);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public DispatchOrderResponse updateDispatchStatus(Long id, UpdateDispatchStatusRequest request, Long userId) {
        DispatchOrder dispatch = dispatchOrderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lệnh điều vận ID: " + id));

        String currentStatus = dispatch.getStatus();
        String targetStatus = request.getStatus() != null ? request.getStatus().trim().toUpperCase() : "";

        // Quy tắc chuyển đổi trạng thái nghiêm ngặt
        if ("COMPLETED".equalsIgnoreCase(currentStatus)) {
            throw new IllegalStateException("Lệnh điều vận đã ở trạng thái [ĐÃ GIAO XONG], không thể chuyển trạng thái hay hủy chuyến!");
        }

        if ("CANCELLED".equalsIgnoreCase(currentStatus)) {
            throw new IllegalStateException("Lệnh điều vận đã ở trạng thái [ĐÃ HỦY], không thể thay đổi trạng thái nữa!");
        }

        if ("IN_TRANSIT".equalsIgnoreCase(currentStatus)) {
            if ("PICKED_UP".equalsIgnoreCase(targetStatus)) {
                throw new IllegalStateException("Chuyến xe đang đi giao (IN_TRANSIT), không thể quay lùi trạng thái về [ĐÃ NHẬN HÀNG TẠI KHO]!");
            }
            if ("CANCELLED".equalsIgnoreCase(targetStatus)) {
                throw new IllegalStateException("Chuyến xe đang trên đường đi giao (IN_TRANSIT), không thể hủy lệnh điều vận!");
            }
        }

        if ("PICKED_UP".equalsIgnoreCase(currentStatus)) {
            if ("COMPLETED".equalsIgnoreCase(targetStatus)) {
                throw new IllegalStateException("Chuyến xe chưa xuất phát đi giao, không thể chuyển ngay sang [ĐÃ GIAO XONG]!");
            }
        }

        // Cập nhật trạng thái hợp lệ
        dispatch.setStatus(targetStatus);
        if ("IN_TRANSIT".equalsIgnoreCase(targetStatus)) {
            if (dispatch.getDepartureTime() == null) {
                dispatch.setDepartureTime(LocalDateTime.now());
            }
            if (dispatch.getTruck() != null) {
                dispatch.getTruck().setStatus("IN_TRANSIT");
                truckRepository.save(dispatch.getTruck());
            }
            // Chuyển toàn bộ bao tải sang IN_TRANSIT
            for (DispatchOrderItem item : dispatch.getItems()) {
                MasterBag bag = item.getMasterBag();
                if (bag != null) {
                    bag.setStatus("IN_TRANSIT");
                    bag.setDispatchedAt(LocalDateTime.now());
                    masterBagRepository.save(bag);
                }
            }
        } else if ("COMPLETED".equalsIgnoreCase(targetStatus)) {
            dispatch.setCompletedTime(LocalDateTime.now());
            if (dispatch.getTruck() != null) {
                dispatch.getTruck().setStatus("AT_WAREHOUSE");
                dispatch.getTruck().setCurrentWarehouse(dispatch.getDestWarehouse());
                truckRepository.save(dispatch.getTruck());
            }
        } else if ("CANCELLED".equalsIgnoreCase(targetStatus)) {
            // Giải phóng bao tải về trạng thái SEALED
            for (DispatchOrderItem item : dispatch.getItems()) {
                MasterBag bag = item.getMasterBag();
                if (bag != null) {
                    bag.setStatus("SEALED");
                    masterBagRepository.save(bag);
                }
            }
        }

        if (request.getNotes() != null) {
            dispatch.setNotes(request.getNotes());
        }

        DispatchOrder saved = dispatchOrderRepository.save(dispatch);
        log.info("Lệnh điều vận {} chuyển trạng thái: {} -> {}", dispatch.getDispatchCode(), currentStatus, targetStatus);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public DispatchOrderResponse scanBagInbound(Long dispatchId, String bagCode, Long warehouseId, Long userId) {
        final String cleanCode = bagCode != null ? bagCode.trim().toUpperCase() : "";
        DispatchOrder dispatch = dispatchOrderRepository.findById(dispatchId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy lệnh điều vận ID: " + dispatchId));

        User receiver = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin nhân viên thao tác!"));

        Warehouse destWh = dispatch.getDestWarehouse();

        // Tìm item trong chuyến xe khớp với mã bao hoặc mã seal
        DispatchOrderItem targetItem = dispatch.getItems().stream()
                .filter(it -> cleanCode.equalsIgnoreCase(it.getBagCode()) || cleanCode.equalsIgnoreCase(it.getSealNumber()))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Bao tải [" + cleanCode + "] không thuộc chuyến xe điều vận [" + dispatch.getDispatchCode() + "]!"));

        if (Boolean.TRUE.equals(targetItem.getIsReceivedAtDest())) {
            throw new IllegalStateException("Bao tải [" + targetItem.getBagCode() + "] đã được quét nhập kho đích trước đó vào lúc " + targetItem.getReceivedAt() + "!");
        }

        // Đánh dấu nhận bao
        targetItem.setIsReceivedAtDest(true);
        targetItem.setReceivedAt(LocalDateTime.now());
        targetItem.setReceiverUserId(userId);
        targetItem.setReceiverUserName(receiver.getFullName());
        dispatchOrderItemRepository.save(targetItem);

        // Cập nhật bao tải MasterBag
        MasterBag bag = targetItem.getMasterBag();
        bag.setStatus("ARRIVED_AT_HUB");
        bag.setArrivedAtHubAt(LocalDateTime.now());
        masterBagRepository.save(bag);

        // Tự động nhập kho toàn bộ đơn hàng trong bao tải này
        List<BagItem> bagItems = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(bag.getId());
        LocalDateTime now = LocalDateTime.now();
        String locType = (destWh.getType() != null) ? destWh.getType() : "HUB";

        for (BagItem bi : bagItems) {
            orderRepository.findByTrackingCode(bi.getTrackingCode()).ifPresent(order -> {
                order.setCurrentStatus("AT_SORTING_HUB");
                orderRepository.save(order);
                if (redisService != null) {
                    redisService.evictOrderCache(order.getTrackingCode());
                }

                OrderTrackingLog logEntry = OrderTrackingLog.builder()
                        .trackingCode(order.getTrackingCode())
                        .status("AT_SORTING_HUB")
                        .locationType(locType)
                        .locationId(destWh.getId())
                        .locationName(destWh.getName())
                        .actorId(userId)
                        .actorName(receiver.getFullName() + " (Kho Hub đích)")
                        .description(String.format("Bao tải [%s] (Seal: %s) trên chuyến xe điều vận [%s] đã cập bến và quét nhập kho [%s] an toàn.",
                                bag.getBagCode(), bag.getSealNumber(), dispatch.getDispatchCode(), destWh.getName()))
                        .build();

                trackingLogRepository.save(logEntry);

                try {
                    webSocketNotificationService.notifyOrderTracking(order.getTrackingCode(), "AT_SORTING_HUB",
                            String.format("Kiện hàng đã đến kho [%s] qua chuyến xe điều vận %s", destWh.getName(), dispatch.getDispatchCode()));
                } catch (Exception ignored) {}
            });
        }

        log.info("Kho {} đã quét tiếp nhận bao tải {} thuộc chuyến xe {}", destWh.getName(), bag.getBagCode(), dispatch.getDispatchCode());

        // Kiểm tra nếu tất cả bao tải trong chuyến xe đã được nhận hết -> Tự động chuyển COMPLETED
        boolean allReceived = dispatch.getItems().stream().allMatch(it -> Boolean.TRUE.equals(it.getIsReceivedAtDest()));
        if (allReceived) {
            dispatch.setStatus("COMPLETED");
            dispatch.setCompletedTime(now);
            if (dispatch.getTruck() != null) {
                dispatch.getTruck().setStatus("AT_WAREHOUSE");
                dispatch.getTruck().setCurrentWarehouse(destWh);
                truckRepository.save(dispatch.getTruck());
            }
            log.info("Toàn bộ bao tải trên chuyến xe {} đã được quét nhận hết. Chuyến xe tự động hoàn tất COMPLETED!", dispatch.getDispatchCode());
        }

        dispatchOrderRepository.save(dispatch);
        return mapToResponse(dispatch);
    }

    @Override
    public List<MasterBagResponse> getAvailableBagsForDispatch(Long originWarehouseId, Long destWarehouseId) {
        // Lấy các bao tải đang ở trạng thái SEALED hoặc OPEN tại kho xuất phát hướng về kho đích
        List<MasterBag> bags = masterBagRepository.findByOriginWarehouseIdOrderByCreatedAtDesc(originWarehouseId);

        return bags.stream()
                .filter(b -> destWarehouseId == null || (b.getDestWarehouse() != null && destWarehouseId.equals(b.getDestWarehouse().getId())))
                .filter(b -> "SEALED".equalsIgnoreCase(b.getStatus()) || "OPEN".equalsIgnoreCase(b.getStatus()) || "ASSIGNED_TO_DRIVER".equalsIgnoreCase(b.getStatus()))
                .map(this::mapBagToResponse)
                .toList();
    }

    private MasterBagResponse mapBagToResponse(MasterBag bag) {
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
                .totalItems(bag.getTotalItems())
                .totalWeightKg(bag.getTotalWeightKg())
                .createdAt(bag.getCreatedAt())
                .build();
    }

    private DispatchOrderResponse mapToResponse(DispatchOrder d) {
        List<DispatchOrderItemResponse> itemDtos = d.getItems().stream().map(it -> {
            MasterBag mb = it.getMasterBag();
            return DispatchOrderItemResponse.builder()
                    .id(it.getId())
                    .masterBagId(mb != null ? mb.getId() : null)
                    .bagCode(it.getBagCode())
                    .sealNumber(it.getSealNumber())
                    .originWarehouseName(mb != null && mb.getOriginWarehouse() != null ? mb.getOriginWarehouse().getName() : "")
                    .destWarehouseName(mb != null && mb.getDestWarehouse() != null ? mb.getDestWarehouse().getName() : "")
                    .bagStatus(mb != null ? mb.getStatus() : "")
                    .totalItems(it.getTotalItems())
                    .weightKg(it.getWeightKg())
                    .isReceivedAtDest(it.getIsReceivedAtDest())
                    .receivedAt(it.getReceivedAt())
                    .receiverUserId(it.getReceiverUserId())
                    .receiverUserName(it.getReceiverUserName())
                    .scannedAt(it.getScannedAt())
                    .build();
        }).toList();

        String statusDesc = switch (d.getStatus()) {
            case "PICKED_UP" -> "Đã nhận hàng tại kho";
            case "IN_TRANSIT" -> "Đang đi giao";
            case "COMPLETED" -> "Đã giao xong";
            case "CANCELLED" -> "Đã hủy chuyến";
            default -> d.getStatus();
        };

        return DispatchOrderResponse.builder()
                .id(d.getId())
                .dispatchCode(d.getDispatchCode())
                .originWarehouseId(d.getOriginWarehouse() != null ? d.getOriginWarehouse().getId() : null)
                .originWarehouseName(d.getOriginWarehouse() != null ? d.getOriginWarehouse().getName() : "")
                .originWarehouseCode(d.getOriginWarehouse() != null ? d.getOriginWarehouse().getCode() : "")
                .destWarehouseId(d.getDestWarehouse() != null ? d.getDestWarehouse().getId() : null)
                .destWarehouseName(d.getDestWarehouse() != null ? d.getDestWarehouse().getName() : "")
                .destWarehouseCode(d.getDestWarehouse() != null ? d.getDestWarehouse().getCode() : "")
                .driverId(d.getDriver() != null ? d.getDriver().getId() : null)
                .driverName(d.getDriverName())
                .driverPhone(d.getDriverPhone())
                .truckId(d.getTruck() != null ? d.getTruck().getId() : null)
                .truckPlate(d.getTruckPlate())
                .status(d.getStatus())
                .statusDescription(statusDesc)
                .totalBags(d.getTotalBags())
                .totalWeightKg(d.getTotalWeightKg())
                .totalItems(d.getTotalItems())
                .notes(d.getNotes())
                .departureTime(d.getDepartureTime())
                .completedTime(d.getCompletedTime())
                .createdUserId(d.getCreatedUserId())
                .createdUserName(d.getCreatedUserName())
                .createdAt(d.getCreatedAt())
                .updatedAt(d.getUpdatedAt())
                .items(itemDtos)
                .build();
    }

    private synchronized String generateUniqueDispatchCode() {
        String datePrefix = "DO" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        Random random = new Random();
        String code;
        do {
            int seq = 1000 + random.nextInt(9000);
            code = datePrefix + "-" + seq;
        } while (dispatchOrderRepository.existsByDispatchCode(code));
        return code;
    }
}
