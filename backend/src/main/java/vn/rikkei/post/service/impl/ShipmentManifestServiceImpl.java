package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.tms.CreateManifestRequest;
import vn.rikkei.post.dto.tms.LoadBagToManifestRequest;
import vn.rikkei.post.dto.tms.ManifestResponse;
import vn.rikkei.post.dto.wms.MasterBagResponse;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.MasterBagService;
import vn.rikkei.post.service.ShipmentManifestService;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShipmentManifestServiceImpl implements ShipmentManifestService {

    private final ShipmentManifestRepository manifestRepository;
    private final MasterBagRepository masterBagRepository;
    private final BagItemRepository bagItemRepository;
    private final WarehouseRepository warehouseRepository;
    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final MasterBagService masterBagService;
    private final WebSocketNotificationService webSocketNotificationService;
    private final vn.rikkei.post.service.RedisService redisService;

    @Override
    public List<ManifestResponse> getAllManifests() {
        return manifestRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    public List<ManifestResponse> getManifestsByHub(Long hubId) {
        return manifestRepository.findByOriginHubIdOrderByCreatedAtDesc(hubId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    public ManifestResponse getManifestById(Long id) {
        ShipmentManifest manifest = manifestRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê chuyến xe ID: " + id));
        return mapToResponse(manifest);
    }

    @Override
    public ManifestResponse getManifestByCode(String manifestCode) {
        ShipmentManifest manifest = manifestRepository.findByManifestCode(manifestCode.trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê chuyến xe mã: " + manifestCode));
        return mapToResponse(manifest);
    }

    @Override
    @Transactional
    public ManifestResponse createManifest(CreateManifestRequest request) {
        Warehouse origin = warehouseRepository.findById(request.getOriginHubId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy Hub xuất phát ID: " + request.getOriginHubId()));

        Warehouse dest = warehouseRepository.findById(request.getDestHubId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy Hub đích ID: " + request.getDestHubId()));

        if (origin.getId().equals(dest.getId())) {
            throw new IllegalArgumentException("Hub xuất phát và Hub đích không được trùng nhau!");
        }

        String manifestCode = generateUniqueManifestCode();

        ShipmentManifest manifest = ShipmentManifest.builder()
                .manifestCode(manifestCode)
                .tripCode(request.getTripCode().trim().toUpperCase())
                .vehiclePlate(request.getVehiclePlate().trim().toUpperCase())
                .driverName(request.getDriverName().trim())
                .driverPhone(request.getDriverPhone().trim())
                .originHubId(origin.getId())
                .originHubName(origin.getName())
                .destHubId(dest.getId())
                .destHubName(dest.getName())
                .truckSealNumber(request.getTruckSealNumber().trim().toUpperCase())
                .departureScheduledAt(request.getDepartureScheduledAt())
                .arrivalEstimatedAt(request.getArrivalEstimatedAt())
                .status("SCHEDULED")
                .totalBags(0)
                .totalPackages(0)
                .notes(request.getNotes())
                .build();

        ShipmentManifest saved = manifestRepository.save(manifest);

        // Nạp các bao tải nếu được truyền sẵn
        if (request.getBagCodes() != null && !request.getBagCodes().isEmpty()) {
            for (String code : request.getBagCodes()) {
                loadBagInternal(saved, code);
            }
        }

        log.info("Đã tạo bảng kê chuyến xe mới mã {} [Tuyến: {} -> {}]", manifestCode, origin.getName(), dest.getName());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public ManifestResponse loadBagToManifest(Long manifestId, LoadBagToManifestRequest request) {
        ShipmentManifest manifest = manifestRepository.findById(manifestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê ID: " + manifestId));

        if (!"SCHEDULED".equalsIgnoreCase(manifest.getStatus()) && !"LOADING".equalsIgnoreCase(manifest.getStatus())) {
            throw new IllegalStateException("Chuyến xe đã " + manifest.getStatus() + ", không thể nạp thêm bao tải!");
        }

        loadBagInternal(manifest, request.getBagCode());
        manifest.setStatus("LOADING");
        manifestRepository.save(manifest);

        return mapToResponse(manifest);
    }

    private void loadBagInternal(ShipmentManifest manifest, String rawBagCode) {
        String cleanCode = rawBagCode.trim().toUpperCase();
        MasterBag bag = masterBagRepository.findByBagCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải mã: " + cleanCode));

        if (!"SEALED".equalsIgnoreCase(bag.getStatus())) {
            throw new IllegalStateException("Bao tải [" + cleanCode + "] chưa được niêm phong kẹp chì (Trạng thái: " + bag.getStatus() + ")!");
        }

        if (bag.getManifestId() != null && !bag.getManifestId().equals(manifest.getId())) {
            throw new IllegalStateException("Bao tải [" + cleanCode + "] đã được nạp lên bảng kê khác (ID: " + bag.getManifestId() + ")!");
        }

        // Cảnh báo / chặn nếu điểm đến của bao tải khác điểm đến của chuyến xe
        if (!bag.getDestWarehouse().getId().equals(manifest.getDestHubId())) {
            log.warn("Cảnh báo định tuyến: Bao tải {} có đích đến là {}, trong khi chuyến xe đi tới {}",
                    cleanCode, bag.getDestWarehouse().getName(), manifest.getDestHubName());
        }

        bag.setManifestId(manifest.getId());
        bag.setStatus("MANIFESTED");
        masterBagRepository.save(bag);

        // Cập nhật số lượng trên bảng kê
        int curBags = masterBagRepository.findByManifestId(manifest.getId()).size();
        int curPackages = masterBagRepository.findByManifestId(manifest.getId()).stream()
                .mapToInt(MasterBag::getTotalItems)
                .sum();

        manifest.setTotalBags(curBags);
        manifest.setTotalPackages(curPackages);
        manifestRepository.save(manifest);
    }

    @Override
    @Transactional
    public ManifestResponse removeBagFromManifest(Long manifestId, String bagCode) {
        ShipmentManifest manifest = manifestRepository.findById(manifestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê ID: " + manifestId));

        if (!"SCHEDULED".equalsIgnoreCase(manifest.getStatus()) && !"LOADING".equalsIgnoreCase(manifest.getStatus())) {
            throw new IllegalStateException("Chuyến xe đã xuất bến, không thể dỡ bao tải!");
        }

        String cleanCode = bagCode.trim().toUpperCase();
        MasterBag bag = masterBagRepository.findByBagCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bao tải: " + cleanCode));

        if (bag.getManifestId() != null && bag.getManifestId().equals(manifestId)) {
            bag.setManifestId(null);
            bag.setStatus("SEALED");
            masterBagRepository.save(bag);
        }

        int curBags = masterBagRepository.findByManifestId(manifest.getId()).size();
        int curPackages = masterBagRepository.findByManifestId(manifest.getId()).stream()
                .mapToInt(MasterBag::getTotalItems)
                .sum();

        manifest.setTotalBags(curBags);
        manifest.setTotalPackages(curPackages);
        manifestRepository.save(manifest);

        return mapToResponse(manifest);
    }

    @Override
    @Transactional
    public ManifestResponse dispatchManifest(Long manifestId) {
        ShipmentManifest manifest = manifestRepository.findById(manifestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê ID: " + manifestId));

        if ("DISPATCHED".equalsIgnoreCase(manifest.getStatus()) || "COMPLETED".equalsIgnoreCase(manifest.getStatus())) {
            throw new IllegalStateException("Chuyến xe này đã xuất bến trước đó rồi!");
        }

        List<MasterBag> bags = masterBagRepository.findByManifestId(manifestId);
        if (bags.isEmpty()) {
            throw new IllegalStateException("Không thể xuất bến chuyến xe rỗng! Vui lòng quét nạp ít nhất 1 bao tải.");
        }

        manifest.setStatus("DISPATCHED");
        manifest.setDepartureActualAt(LocalDateTime.now());
        manifestRepository.save(manifest);

        // Cập nhật trạng thái các bao tải và kiện hàng bên trong
        for (MasterBag bag : bags) {
            bag.setStatus("DISPATCHED");
            masterBagRepository.save(bag);

            List<BagItem> items = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(bag.getId());
            for (BagItem item : items) {
                orderRepository.findByTrackingCode(item.getTrackingCode()).ifPresent(order -> {
                    order.setCurrentStatus("IN_TRANSIT");
                    orderRepository.save(order);
                    if (redisService != null) {
                        redisService.evictOrderCache(order.getTrackingCode());
                    }
                });

                OrderTrackingLog logEntry = OrderTrackingLog.builder()
                        .trackingCode(item.getTrackingCode())
                        .status("IN_TRANSIT")
                        .locationType("ON_ROAD")
                        .locationId(manifest.getOriginHubId())
                        .locationName(manifest.getOriginHubName())
                        .description(String.format("Chuyến xe luân chuyển [%s] (Xe tải %s, Lái xe: %s, Chì thùng: %s) đã xuất bến rời [%s] luân chuyển đến [%s].",
                                manifest.getTripCode(), manifest.getVehiclePlate(), manifest.getDriverName(),
                                manifest.getTruckSealNumber(), manifest.getOriginHubName(), manifest.getDestHubName()))
                        .actorId(1L)
                        .actorName("Điều độ Vận tải TMS")
                        .build();
                trackingLogRepository.save(logEntry);

                webSocketNotificationService.notifyOrderTracking(item.getTrackingCode(), "IN_TRANSIT",
                        String.format("Xe tải [%s] đã xuất bến luân chuyển hàng", manifest.getVehiclePlate()));
            }
        }

        log.info("Chuyến xe tải {} (Mã bảng kê: {}) đã chính thức xuất bến!", manifest.getVehiclePlate(), manifest.getManifestCode());
        return mapToResponse(manifest);
    }

    @Override
    @Transactional
    public ManifestResponse arriveManifest(Long manifestId) {
        ShipmentManifest manifest = manifestRepository.findById(manifestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê ID: " + manifestId));

        manifest.setStatus("ARRIVED");
        manifest.setArrivalActualAt(LocalDateTime.now());
        manifestRepository.save(manifest);

        List<MasterBag> bags = masterBagRepository.findByManifestId(manifestId);
        for (MasterBag bag : bags) {
            bag.setStatus("RECEIVED");
            masterBagRepository.save(bag);

            List<BagItem> items = bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(bag.getId());
            for (BagItem item : items) {
                OrderTrackingLog logEntry = OrderTrackingLog.builder()
                        .trackingCode(item.getTrackingCode())
                        .status("IN_WAREHOUSE")
                        .locationType("HUB")
                        .locationId(manifest.getDestHubId())
                        .locationName(manifest.getDestHubName())
                        .description(String.format("Chuyến xe luân chuyển [%s] đã cập bến an toàn tại [%s]. Chuẩn bị kiểm đếm và chia chọn.",
                                manifest.getTripCode(), manifest.getDestHubName()))
                        .actorId(1L)
                        .actorName("Nhân viên Kiểm soát Hub đích")
                        .build();
                trackingLogRepository.save(logEntry);

                webSocketNotificationService.notifyOrderTracking(item.getTrackingCode(), "IN_WAREHOUSE",
                        String.format("Kiện hàng đã đến Hub [%s]", manifest.getDestHubName()));
            }
        }

        log.info("Chuyến xe tải {} đã cập bến Hub đích {}", manifest.getVehiclePlate(), manifest.getDestHubName());
        return mapToResponse(manifest);
    }

    @Override
    @Transactional
    public ManifestResponse completeManifest(Long manifestId) {
        ShipmentManifest manifest = manifestRepository.findById(manifestId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng kê ID: " + manifestId));

        manifest.setStatus("COMPLETED");
        manifestRepository.save(manifest);
        return mapToResponse(manifest);
    }

    private ManifestResponse mapToResponse(ShipmentManifest manifest) {
        List<MasterBag> bags = masterBagRepository.findByManifestId(manifest.getId());
        List<MasterBagResponse> bagResponses = bags.stream()
                .map(b -> masterBagService.getBagById(b.getId()))
                .toList();

        return ManifestResponse.builder()
                .id(manifest.getId())
                .manifestCode(manifest.getManifestCode())
                .tripCode(manifest.getTripCode())
                .vehiclePlate(manifest.getVehiclePlate())
                .driverName(manifest.getDriverName())
                .driverPhone(manifest.getDriverPhone())
                .originHubId(manifest.getOriginHubId())
                .originHubName(manifest.getOriginHubName())
                .destHubId(manifest.getDestHubId())
                .destHubName(manifest.getDestHubName())
                .truckSealNumber(manifest.getTruckSealNumber())
                .departureScheduledAt(manifest.getDepartureScheduledAt())
                .departureActualAt(manifest.getDepartureActualAt())
                .arrivalEstimatedAt(manifest.getArrivalEstimatedAt())
                .arrivalActualAt(manifest.getArrivalActualAt())
                .totalBags(manifest.getTotalBags())
                .totalPackages(manifest.getTotalPackages())
                .status(manifest.getStatus())
                .notes(manifest.getNotes())
                .createdAt(manifest.getCreatedAt())
                .bags(bagResponses)
                .build();
    }

    private synchronized String generateUniqueManifestCode() {
        String datePrefix = "MNF" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        Random random = new Random();
        String code;
        do {
            int seq = 1000 + random.nextInt(9000);
            code = datePrefix + seq;
        } while (manifestRepository.existsByManifestCode(code));
        return code;
    }
}
