package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.ai.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.AiCustomerSupportService;
import vn.rikkei.post.service.VrpSolverService;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiCustomerSupportService aiService;
    private final VrpSolverService vrpService;

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<AiChatResponse>> chat(
            @RequestBody @Valid AiChatRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails != null && request.getUserId() == null) {
            request.setUserId(userDetails.getId());
        }
        AiChatResponse res = aiService.chat(request);
        return ResponseEntity.ok(ApiResponse.ok("Trợ lý AI phản hồi thành công", res));
    }

    @PostMapping("/vrp/optimize")
    public ResponseEntity<ApiResponse<VrpOptimizeResponse>> optimizeRoute(
            @RequestBody @Valid VrpOptimizeRequest request
    ) {
        VrpOptimizeResponse res = vrpService.optimizeRoute(request);
        return ResponseEntity.ok(ApiResponse.ok("Tối ưu hóa tuyến đường VRP thành công", res));
    }

    @PostMapping("/vrp/shipper/{shipperId}/optimize")
    public ResponseEntity<ApiResponse<VrpOptimizeResponse>> optimizeShipperRoute(
            @PathVariable Long shipperId,
            @RequestParam(required = false, defaultValue = "21.0285") Double lat,
            @RequestParam(required = false, defaultValue = "105.8542") Double lng,
            @RequestParam(required = false, defaultValue = "true") boolean applySequence
    ) {
        VrpOptimizeResponse res = vrpService.optimizeShipperActiveOrders(shipperId, lat, lng, applySequence);
        return ResponseEntity.ok(ApiResponse.ok("Tối ưu hóa hành trình giao hàng cho Shipper thành công", res));
    }

    @PostMapping("/predict-eta")
    public ResponseEntity<ApiResponse<PredictEtaResponse>> predictEta(
            @RequestBody @Valid PredictEtaRequest request
    ) {
        PredictEtaResponse res = aiService.predictEta(request);
        return ResponseEntity.ok(ApiResponse.ok("Dự báo thời gian giao hàng ETA thành công", res));
    }
}
