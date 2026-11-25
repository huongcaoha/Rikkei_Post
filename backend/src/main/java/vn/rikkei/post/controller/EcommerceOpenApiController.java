package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.ecommerce.*;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.service.EcommerceIntegrationService;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ecommerce/open")
@CrossOrigin(origins = "*", allowedHeaders = "*")
@RequiredArgsConstructor
public class EcommerceOpenApiController {

    private final EcommerceIntegrationService ecommerceService;

    @GetMapping("/ping")
    public ResponseEntity<ApiResponse<Map<String, Object>>> ping() {
        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "status", "UP",
                "carrier", "Rikkei Post Smart Express Logistics",
                "version", "2.0-OpenAPI",
                "timestamp", LocalDateTime.now()
        ), "Kết nối Rikkei Post Open API sẵn sàng"));
    }

    @PostMapping("/orders/create")
    public ResponseEntity<ApiResponse<EcommerceOrderSyncResponse>> syncOrder(
            @RequestHeader(value = "X-API-KEY", required = false) String apiKey,
            @Valid @RequestBody EcommerceOrderSyncRequest request
    ) {
        EcommerceOrderSyncResponse response = ecommerceService.syncOrderFromPlatform(apiKey, request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Đã tạo vận đơn Rikkei Post thành công"));
    }

    @PostMapping("/shipping-rate")
    public ResponseEntity<ApiResponse<EcommerceShippingRateResponse>> calculateRate(
            @Valid @RequestBody EcommerceShippingRateRequest request
    ) {
        EcommerceShippingRateResponse response = ecommerceService.calculateShippingRate(request);
        return ResponseEntity.ok(ApiResponse.success(response, "Tính cước thành công"));
    }

    @GetMapping("/tracking/{trackingCode}")
    public ResponseEntity<ApiResponse<OrderResponse>> getTracking(
            @RequestHeader(value = "X-API-KEY", required = false) String apiKey,
            @PathVariable String trackingCode
    ) {
        OrderResponse response = ecommerceService.getTrackingForPlatform(apiKey, trackingCode);
        return ResponseEntity.ok(ApiResponse.success(response, "Lấy thông tin hành trình thành công"));
    }

    @PostMapping("/orders/{trackingCode}/cancel")
    public ResponseEntity<ApiResponse<Boolean>> cancelOrder(
            @RequestHeader(value = "X-API-KEY", required = false) String apiKey,
            @PathVariable String trackingCode,
            @RequestParam(required = false, defaultValue = "Sàn TMĐT hủy đơn") String reason
    ) {
        boolean cancelled = ecommerceService.cancelOrderForPlatform(apiKey, trackingCode, reason);
        return ResponseEntity.ok(ApiResponse.success(cancelled, "Đã hủy đơn vận chuyển thành công"));
    }
}
