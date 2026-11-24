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
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class MasterBagServiceImpl implements MasterBagService {

    private final MasterBagRepository masterBagRepository;
    private final BagItemRepository bagItemRepository;
    private final WarehouseRepository warehouseRepository;
    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final UserRepository userRepository;
    private final ShipmentManifestRepository manifestRepository;
    private final WebSocketNotificationService webSocketNotificationService;

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
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải mã: " + bagCode));
        return mapToResponse(bag);
    }

    @Override
    @Transactional
    public MasterBagResponse createBag(CreateMasterBagRequest request, Long userId) {
        Warehouse origin = warehouseRepository.findById(request.getOriginWarehouseId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho xuất phát ID: " + request.getOriginWarehouseId()));

        Warehouse dest = warehouseRepository.findById(request.getDestWarehouseId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho đích ID: " + request.getDestWarehouseId()));

        if (origin.getId().equals(dest.getId())) {
            throw new IllegalArgumentException("Kho xuất phát và Kho đích không được trùng nhau!");
        }

        String bagCode = generateUniqueBagCode();

        MasterBag bag = MasterBag.builder()
                .bagCode(bagCode)
                .originWarehouse(origin)
                .destWarehouse(dest)
                .status("OPEN")
                .totalItems(0)
                .totalWeightKg(BigDecimal.ZERO)
                .notes(request.getNotes())
                .sealedByUserId(userId)
                .build();

        MasterBag saved = masterBagRepository.save(bag);
        log.info("Đã tạo bao tải mới mã {} từ {} tới {}", bagCode, origin.getName(), dest.getName());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public MasterBagResponse addItemToBag(Long bagId, AddBagItemRequest request) {
        MasterBag bag = masterBagRepository.findById(bagId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải ID: " + bagId));

        if (!"OPEN".equalsIgnoreCase(bag.getStatus())) {
            throw new IllegalStateException("Bao tải [" + bag.getBagCode() + "] đã được niêm phong/kẹp chì (" + bag.getStatus() + "), không thể thêm kiện!");
        }

        String trackingCode = request.getTrackingCode().trim().toUpperCase();

        if (bagItemRepository.existsByMasterBagIdAndTrackingCode(bagId, trackingCode)) {
            throw new IllegalArgumentException("Kiện hàng [" + trackingCode + "] đã có trong bao tải này rồi!");
        }

        Order order = orderRepository.findByTrackingCode(trackingCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy vận đơn: " + trackingCode));

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
        BigDecimal addWeightKg = BigDecimal.valueOf(weight).divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_UP);
        BigDecimal newTotalWeightKg = bag.getTotalWeightKg().add(addWeightKg);

        bag.setTotalItems(newTotalItems);
        bag.setTotalWeightKg(newTotalWeightKg);
        masterBagRepository.save(bag);

        // Ghi log hành trình đơn hàng
        OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                .trackingCode(trackingCode)
                .status("IN_WAREHOUSE")
                .locationType(bag.getOriginWarehouse().getType() != null ? bag.getOriginWarehouse().getType() : "HUB")
                .locationId(bag.getOriginWarehouse().getId())
                .locationName(bag.getOriginWarehouse().getName())
                .description(String.format("Đã quét gom vào Bao tải gom hàng [%s] chuẩn bị gửi tới [%s]",
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
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kiện hàng " + cleanCode + " trong bao"));

        int weight = item.getWeightGram();
        bagItemRepository.delete(item);

        bag.setTotalItems(Math.max(0, bag.getTotalItems() - 1));
        BigDecimal subWeightKg = BigDecimal.valueOf(weight).divide(BigDecimal.valueOf(1000), 2, RoundingMode.HALF_UP);
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
            throw new IllegalStateException("Không thể niêm phong bao tải rỗng! Vui lòng quét ít nhất 1 kiện hàng vào bao.");
        }

        String cleanSeal = request.getSealNumber().trim().toUpperCase();

        if (masterBagRepository.existsBySealNumber(cleanSeal)) {
            throw new IllegalArgumentException("Mã kẹp chì (Seal) [" + cleanSeal + "] đã được sử dụng cho một bao tải khác!");
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
                    .description(String.format("Bao tải [%s] đã được niêm phong kẹp chì số [%s] (Tổng %d kiện, %.2f kg). Sẵn sàng xuất kho lên xe.",
                            bag.getBagCode(), cleanSeal, bag.getTotalItems(), bag.getTotalWeightKg()))
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
                order.setCurrentStatus("IN_WAREHOUSE");
                order.setAssignedPostOfficeId(bag.getDestWarehouse().getId());
                orderRepository.save(order);
            });

            OrderTrackingLog trackingLog = OrderTrackingLog.builder()
                    .trackingCode(it.getTrackingCode())
                    .status("IN_WAREHOUSE")
                    .locationType(bag.getDestWarehouse().getType() != null ? bag.getDestWarehouse().getType() : "HUB")
                    .locationId(bag.getDestWarehouse().getId())
                    .locationName(bag.getDestWarehouse().getName())
                    .description(String.format("Bao tải [%s] (Kẹp chì [%s]) đã đến và được cắt chì, nhập kho tại [%s]",
                            bag.getBagCode(), bag.getSealNumber(), bag.getDestWarehouse().getName()))
                    .actorId(userId)
                    .actorName("Nhân viên Tiếp nhận & Mở bao")
                    .build();
            trackingLogRepository.save(trackingLog);

            webSocketNotificationService.notifyOrderTracking(it.getTrackingCode(), "IN_WAREHOUSE",
                    String.format("Đã cắt chì bao tải tại kho [%s]", bag.getDestWarehouse().getName()));
        }

        return mapToResponse(bag);
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

        String manifestCode = null;
        if (bag.getManifestId() != null) {
            manifestCode = manifestRepository.findById(bag.getManifestId())
                    .map(ShipmentManifest::getManifestCode)
                    .orElse(null);
        }

        return MasterBagResponse.builder()
                .id(bag.getId())
                .bagCode(bag.getBagCode())
                .originWarehouseId(bag.getOriginWarehouse() != null ? bag.getOriginWarehouse().getId() : null)
                .originWarehouseName(bag.getOriginWarehouse() != null ? bag.getOriginWarehouse().getName() : "")
                .destWarehouseId(bag.getDestWarehouse() != null ? bag.getDestWarehouse().getId() : null)
                .destWarehouseName(bag.getDestWarehouse() != null ? bag.getDestWarehouse().getName() : "")
                .sealNumber(bag.getSealNumber())
                .status(bag.getStatus())
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
