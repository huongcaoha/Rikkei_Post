package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.carrier.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.service.CarrierService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/carriers")
@RequiredArgsConstructor
public class CarrierController {

    private final CarrierService carrierService;

    @GetMapping("/partners")
    public ResponseEntity<ApiResponse<List<CarrierPartnerResponse>>> getAllPartners(
            @RequestParam(required = false) String status
    ) {
        List<CarrierPartnerResponse> res = carrierService.getAllPartners(status);
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách đối tác vận tải 3PL thành công", res));
    }

    @PostMapping("/partners")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<CarrierPartnerResponse>> createPartner(
            @RequestBody @Valid CarrierPartnerRequest request
    ) {
        CarrierPartnerResponse res = carrierService.createPartner(request);
        return ResponseEntity.ok(ApiResponse.ok("Thêm đối tác vận tải thành công", res));
    }

    @GetMapping("/partners/{id}")
    public ResponseEntity<ApiResponse<CarrierPartnerResponse>> getPartnerById(@PathVariable Long id) {
        CarrierPartnerResponse res = carrierService.getPartnerById(id);
        return ResponseEntity.ok(ApiResponse.ok("Lấy thông tin đối tác thành công", res));
    }

    @PutMapping("/partners/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<ApiResponse<CarrierPartnerResponse>> updatePartner(
            @PathVariable Long id,
            @RequestBody @Valid CarrierPartnerRequest request
    ) {
        CarrierPartnerResponse res = carrierService.updatePartner(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật đối tác vận tải thành công", res));
    }

    @DeleteMapping("/partners/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deletePartner(@PathVariable Long id) {
        carrierService.deletePartner(id);
        return ResponseEntity.ok(ApiResponse.ok("Xóa đối tác thành công", null));
    }

    @PostMapping("/trips")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<CarrierTripResponse>> createTrip(
            @RequestBody @Valid CarrierTripRequest request
    ) {
        CarrierTripResponse res = carrierService.createTrip(request);
        return ResponseEntity.ok(ApiResponse.ok("Khởi tạo chuyến xe vận chuyển 3PL thành công", res));
    }

    @PutMapping("/trips/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<CarrierTripResponse>> updateTripStatus(
            @PathVariable Long id,
            @RequestBody @Valid UpdateTripStatusRequest request
    ) {
        CarrierTripResponse res = carrierService.updateTripStatus(id, request);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật trạng thái chuyến xe & đánh giá SLA thành công", res));
    }

    @GetMapping("/trips")
    public ResponseEntity<ApiResponse<Page<CarrierTripResponse>>> getTrips(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "15") int size
    ) {
        Page<CarrierTripResponse> res = carrierService.getTrips(status, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách chuyến xe thành công", res));
    }

    @GetMapping("/partners/{id}/trips")
    public ResponseEntity<ApiResponse<List<CarrierTripResponse>>> getTripsByCarrier(@PathVariable Long id) {
        List<CarrierTripResponse> res = carrierService.getTripsByCarrier(id);
        return ResponseEntity.ok(ApiResponse.ok("Lấy lịch sử chuyến xe của đối tác thành công", res));
    }
}
