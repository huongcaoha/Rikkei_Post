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
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
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
}
