package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.dto.pricing.PricingMatrixRequest;
import vn.rikkei.post.dto.pricing.PricingPolicyRequest;
import vn.rikkei.post.entity.PricingMatrix;
import vn.rikkei.post.entity.PricingPolicy;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.PricingService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
public class PricingController {

    private final PricingService pricingService;

    @PostMapping("/calculate")
    public ResponseEntity<ApiResponse<PriceEstimateResponse>> calculatePrice(
            @Valid @RequestBody CalculatePriceRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails != null && request.getMerchantId() == null) {
            request.setMerchantId(userDetails.getId());
        }
        PriceEstimateResponse response = pricingService.calculatePrice(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Tính cước thành công"));
    }

    @GetMapping("/matrix")
    public ResponseEntity<ApiResponse<List<PricingMatrix>>> getActivePricing() {
        List<PricingMatrix> list = pricingService.getAllActivePricing();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/matrix/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<PricingMatrix>>> getAllPricing() {
        List<PricingMatrix> list = pricingService.getAllPricingMatrices();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PostMapping("/matrix")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PricingMatrix>> createPricingMatrix(
            @Valid @RequestBody PricingMatrixRequest request
    ) {
        PricingMatrix created = pricingService.createPricingMatrix(request);
        return ResponseEntity.ok(ApiResponse.success(created, "Thêm mới cấu hình bảng cước thành công"));
    }

    @PutMapping("/matrix/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PricingMatrix>> updatePricingMatrix(
            @PathVariable Long id,
            @Valid @RequestBody PricingMatrixRequest request
    ) {
        PricingMatrix updated = pricingService.updatePricingMatrix(id, request);
        return ResponseEntity.ok(ApiResponse.success(updated, "Cập nhật cấu hình bảng cước thành công"));
    }

    @DeleteMapping("/matrix/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deletePricingMatrix(@PathVariable Long id) {
        pricingService.deletePricingMatrix(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa cấu hình bảng cước thành công"));
    }

    @PatchMapping("/matrix/{id}/toggle-active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PricingMatrix>> togglePricingMatrixActive(@PathVariable Long id) {
        PricingMatrix updated = pricingService.togglePricingMatrixActive(id);
        return ResponseEntity.ok(ApiResponse.success(updated, "Đã thay đổi trạng thái áp dụng"));
    }

    @GetMapping("/policy")
    public ResponseEntity<ApiResponse<PricingPolicy>> getPricingPolicy() {
        PricingPolicy policy = pricingService.getPricingPolicy();
        return ResponseEntity.ok(ApiResponse.success(policy));
    }

    @PutMapping("/policy")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PricingPolicy>> updatePricingPolicy(
            @Valid @RequestBody PricingPolicyRequest request
    ) {
        PricingPolicy updated = pricingService.updatePricingPolicy(request);
        return ResponseEntity.ok(ApiResponse.success(updated, "Cập nhật chính sách phụ phí thành công"));
    }
}
