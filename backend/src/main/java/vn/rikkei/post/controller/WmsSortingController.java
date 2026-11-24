package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.wms.SmartSortingResponse;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.ProvinceRepository;
import vn.rikkei.post.repository.WarehouseRepository;

import java.util.List;

@RestController
@RequestMapping("/api/v1/wms/sorting")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
public class WmsSortingController {

    private final OrderRepository orderRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProvinceRepository provinceRepository;

    @GetMapping("/classify")
    public ResponseEntity<ApiResponse<SmartSortingResponse>> classifyOrder(@RequestParam String trackingCode) {
        final String cleanCode = trackingCode != null ? trackingCode.trim().toUpperCase() : "";
        Order order = orderRepository.findByTrackingCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đơn hàng với mã vận đơn: " + cleanCode));

        String provName = null;
        if (order.getReceiverProvinceId() != null) {
            provName = provinceRepository.findById(order.getReceiverProvinceId())
                    .map(Province::getName)
                    .orElse("Hà Nội");
        }

        String senderProvName = null;
        if (order.getSenderProvinceId() != null) {
            senderProvName = provinceRepository.findById(order.getSenderProvinceId())
                    .map(Province::getName)
                    .orElse(null);
        }

        // Tìm Bưu cục điểm cuối (Last-mile Spoke Post Office) sẽ phụ trách giao đơn cho khách
        Warehouse destPostOffice = resolveDestinationPostOffice(order);

        String binCode = "LỒNG-" + (destPostOffice != null ? destPostOffice.getCode() : "CHUNG");
        String zoneName = (provName != null ? provName.toUpperCase() : "VIỆT NAM") + " - " + (destPostOffice != null ? destPostOffice.getName() : "BƯU CỤC PHÁT");
        String suggestedAction = "Phân loại vào " + binCode + " (Chuyển tiếp tới " + (destPostOffice != null ? destPostOffice.getName() : "bưu cục giao") + ")";

        Double recLat = order.getReceiverLat();
        Double recLng = order.getReceiverLng();
        if ((recLat == null || recLng == null) && destPostOffice != null) {
            recLat = destPostOffice.getLatitude();
            recLng = destPostOffice.getLongitude();
        }

        SmartSortingResponse response = SmartSortingResponse.builder()
                .trackingCode(order.getTrackingCode())
                .itemName(order.getItemName())
                .actualWeightGram(order.getActualWeightGram())
                .billableWeightGram(order.getBillableWeightGram())
                .codAmount(order.getCodAmount())
                .serviceType(order.getServiceType())
                .currentStatus(order.getCurrentStatus())
                .routingCode(order.getRoutingCode())
                .senderName(order.getSenderName())
                .senderPhone(order.getSenderPhone())
                .senderAddress(order.getSenderAddress())
                .senderProvinceName(senderProvName)
                .receiverName(order.getReceiverName())
                .receiverPhone(order.getReceiverPhone())
                .receiverAddress(order.getReceiverAddress())
                .receiverProvinceId(order.getReceiverProvinceId())
                .receiverProvinceName(provName)
                .receiverWardName(order.getReceiverWardName())
                .receiverLat(recLat)
                .receiverLng(recLng)
                .destinationPostOfficeId(destPostOffice != null ? destPostOffice.getId() : null)
                .destinationPostOfficeCode(destPostOffice != null ? destPostOffice.getCode() : null)
                .destinationPostOfficeName(destPostOffice != null ? destPostOffice.getName() : null)
                .destinationPostOfficeAddress(destPostOffice != null ? destPostOffice.getAddress() : null)
                .destinationPostOfficeLat(destPostOffice != null ? destPostOffice.getLatitude() : 21.0285)
                .destinationPostOfficeLng(destPostOffice != null ? destPostOffice.getLongitude() : 105.8542)
                .sortingZone(zoneName)
                .suggestedBinCode(binCode)
                .suggestedAction(suggestedAction)
                .build();

        log.info("Phân loại đơn hàng {} -> Đích phát: {} ({})", cleanCode, response.getDestinationPostOfficeName(), binCode);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    private Warehouse resolveDestinationPostOffice(Order order) {
        List<Warehouse> warehouses = warehouseRepository.findAll();

        // 1. Nếu địa chỉ nhận chứa từ khóa Hoài Đức
        String recAddr = (order.getReceiverAddress() != null ? order.getReceiverAddress() : "")
                + " " + (order.getReceiverWardName() != null ? order.getReceiverWardName() : "");
        String lowerAddr = recAddr.toLowerCase();

        if (lowerAddr.contains("hoài đức") || lowerAddr.contains("hoai duc")) {
            Warehouse hd = warehouses.stream()
                    .filter(w -> w.getCode() != null && w.getCode().toUpperCase().contains("HOAIDUC"))
                    .findFirst().orElse(null);
            if (hd != null) return hd;
        }

        if (lowerAddr.contains("hai bà trưng") || lowerAddr.contains("hai ba trung")) {
            Warehouse hbt = warehouses.stream()
                    .filter(w -> w.getCode() != null && w.getCode().toUpperCase().contains("HBT"))
                    .findFirst().orElse(null);
            if (hbt != null) return hbt;
        }

        if (lowerAddr.contains("cầu giấy") || lowerAddr.contains("cau giay") || lowerAddr.contains("duy tân") || lowerAddr.contains("dịch vọng")) {
            Warehouse cg = warehouses.stream()
                    .filter(w -> w.getCode() != null && (w.getCode().toUpperCase().contains("CG") || w.getName().toLowerCase().contains("cầu giấy")))
                    .findFirst().orElse(null);
            if (cg != null) return cg;
        }

        // 2. Nếu order có assignedPostOfficeId là bưu cục SPOKE_POST_OFFICE
        if (order.getAssignedPostOfficeId() != null) {
            Warehouse assignedWh = warehouseRepository.findById(order.getAssignedPostOfficeId()).orElse(null);
            if (assignedWh != null && "SPOKE_POST_OFFICE".equalsIgnoreCase(assignedWh.getType())) {
                return assignedWh;
            }
        }

        // 3. Lấy spoke warehouse theo tỉnh nhận
        if (order.getReceiverProvinceId() != null) {
            Warehouse provSpoke = warehouses.stream()
                    .filter(w -> order.getReceiverProvinceId().equals(w.getProvinceId()) && "SPOKE_POST_OFFICE".equalsIgnoreCase(w.getType()))
                    .findFirst().orElse(null);
            if (provSpoke != null) return provSpoke;
        }

        // 4. Default HUB hoặc kho đầu tiên
        return warehouses.stream()
                .filter(w -> "SPOKE_POST_OFFICE".equalsIgnoreCase(w.getType()))
                .findFirst()
                .orElse(warehouses.isEmpty() ? null : warehouses.get(0));
    }
}
