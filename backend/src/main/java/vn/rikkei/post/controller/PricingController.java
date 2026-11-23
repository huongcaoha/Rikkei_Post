package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.entity.PricingMatrix;
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
    public ResponseEntity<ApiResponse<List<PricingMatrix>>> getAllPricing() {
        List<PricingMatrix> list = pricingService.getAllActivePricing();
        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
