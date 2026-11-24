package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.wms.AddBagItemRequest;
import vn.rikkei.post.dto.wms.CreateMasterBagRequest;
import vn.rikkei.post.dto.wms.MasterBagResponse;
import vn.rikkei.post.dto.wms.SealMasterBagRequest;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.MasterBagService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/wms/bags")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF', 'TRUCK_DRIVER')")
public class MasterBagController {

    private final MasterBagService masterBagService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<MasterBagResponse>>> getAllBags() {
        List<MasterBagResponse> list = masterBagService.getAllBags();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/warehouse/{warehouseId}")
    public ResponseEntity<ApiResponse<List<MasterBagResponse>>> getBagsByWarehouse(@PathVariable Long warehouseId) {
        List<MasterBagResponse> list = masterBagService.getBagsByWarehouse(warehouseId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MasterBagResponse>> getBagById(@PathVariable Long id) {
        MasterBagResponse res = masterBagService.getBagById(id);
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @GetMapping("/code/{bagCode}")
    public ResponseEntity<ApiResponse<MasterBagResponse>> getBagByCode(@PathVariable String bagCode) {
        MasterBagResponse res = masterBagService.getBagByCode(bagCode);
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<MasterBagResponse>> createBag(
            @Valid @RequestBody CreateMasterBagRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        MasterBagResponse created = masterBagService.createBag(request, userId);
        return ResponseEntity.ok(ApiResponse.success(created, "Khởi tạo bao tải gom hàng thành công"));
    }

    @PostMapping("/{id}/items")
    public ResponseEntity<ApiResponse<MasterBagResponse>> addItem(
            @PathVariable Long id,
            @Valid @RequestBody AddBagItemRequest request
    ) {
        MasterBagResponse res = masterBagService.addItemToBag(id, request);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã nạp kiện hàng vào bao"));
    }

    @DeleteMapping("/{id}/items/{trackingCode}")
    public ResponseEntity<ApiResponse<MasterBagResponse>> removeItem(
            @PathVariable Long id,
            @PathVariable String trackingCode
    ) {
        MasterBagResponse res = masterBagService.removeItemFromBag(id, trackingCode);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã gỡ kiện hàng ra khỏi bao"));
    }

    @PostMapping("/{id}/seal")
    public ResponseEntity<ApiResponse<MasterBagResponse>> sealBag(
            @PathVariable Long id,
            @Valid @RequestBody SealMasterBagRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        MasterBagResponse res = masterBagService.sealBag(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Niêm phong kẹp chì bao tải thành công"));
    }

    @PostMapping("/{id}/unseal")
    public ResponseEntity<ApiResponse<MasterBagResponse>> unsealBag(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        MasterBagResponse res = masterBagService.unsealBag(id, userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Cắt chì mở bao và nhập kho thành công"));
    }

    @PostMapping("/{id}/assign-driver")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<MasterBagResponse>> assignDriver(
            @PathVariable Long id,
            @Valid @RequestBody vn.rikkei.post.dto.wms.AssignBagDriverRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        MasterBagResponse res = masterBagService.assignDriver(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Gán tài xế xe tải nhận bao thành công"));
    }

    @PostMapping("/driver-scan-transit")
    public ResponseEntity<ApiResponse<MasterBagResponse>> driverScanTransit(
            @RequestBody java.util.Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long driverId = userDetails != null ? userDetails.getId() : 1L;
        String bagCode = payload.get("bagCode");
        MasterBagResponse res = masterBagService.driverScanTransit(bagCode, driverId);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã quét nhận bao tải lên xe! Toàn bộ đơn hàng đã chuyển sang trạng thái đang trung chuyển qua Kafka."));
    }

    @PostMapping("/hub-scan-inbound")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<MasterBagResponse>> hubScanInbound(
            @RequestBody java.util.Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long operatorId = userDetails != null ? userDetails.getId() : 1L;
        String bagCode = (String) payload.get("bagCode");
        Long hubWarehouseId = payload.get("hubWarehouseId") != null
                ? Long.valueOf(payload.get("hubWarehouseId").toString())
                : (userDetails != null && userDetails.getAssignedPostOfficeId() != null ? userDetails.getAssignedPostOfficeId() : 1L);

        MasterBagResponse res = masterBagService.hubScanInbound(bagCode, hubWarehouseId, operatorId);
        return ResponseEntity.ok(ApiResponse.success(res, "Kho Hub đã quét tiếp nhận bao tải thành công! Toàn bộ đơn hàng đã chuyển về trạng thái đang ở kho Hub qua Kafka."));
    }

    @GetMapping("/driver-tasks")
    public ResponseEntity<ApiResponse<List<MasterBagResponse>>> getDriverTasks(
            @RequestParam(required = false) Long driverId,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long effectiveDriverId = driverId != null ? driverId : (userDetails != null ? userDetails.getId() : 1L);
        List<MasterBagResponse> list = masterBagService.getDriverBags(effectiveDriverId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/hub/{hubId}/incoming")
    public ResponseEntity<ApiResponse<List<MasterBagResponse>>> getIncomingBagsForHub(@PathVariable Long hubId) {
        List<MasterBagResponse> list = masterBagService.getIncomingBagsForHub(hubId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
