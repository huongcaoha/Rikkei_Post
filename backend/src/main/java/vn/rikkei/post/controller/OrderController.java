package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.order.*;
import vn.rikkei.post.entity.MerchantAddress;
import vn.rikkei.post.entity.OrderTrackingLog;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.OrderService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<ApiResponse<OrderResponse>> createOrder(
            @Valid @RequestBody CreateOrderRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long merchantId = userDetails != null ? userDetails.getId() : 1L;
        OrderResponse response = orderService.createOrder(request, merchantId);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response, "Tạo đơn hàng thành công"));
    }

    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<BatchOrderResponse>> createBatchOrders(
            @Valid @RequestBody BatchOrderRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long merchantId = userDetails != null ? userDetails.getId() : 1L;
        BatchOrderResponse response = orderService.createBatchOrders(request, merchantId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Xử lý tạo lô đơn hàng hoàn tất"));
    }

    @GetMapping("/{trackingCode}")
    public ResponseEntity<ApiResponse<OrderResponse>> getOrder(@PathVariable String trackingCode) {
        OrderResponse response = orderService.getOrderByTrackingCode(trackingCode);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/merchant/my-orders")
    public ResponseEntity<ApiResponse<Page<OrderResponse>>> getMyOrders(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long merchantId = userDetails != null ? userDetails.getId() : 1L;
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<OrderResponse> orders = orderService.getMerchantOrders(merchantId, status, pageRequest);
        return ResponseEntity.ok(ApiResponse.success(orders));
    }

    @GetMapping("/merchant/dashboard-stats")
    public ResponseEntity<ApiResponse<DashboardStatsResponse>> getDashboardStats(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate startDate,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        DashboardStatsResponse stats = orderService.getDashboardStats(userDetails, startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    @GetMapping("/track/{trackingCode}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> publicTrackOrder(@PathVariable String trackingCode) {
        OrderResponse order = orderService.getOrderByTrackingCode(trackingCode);
        List<OrderTrackingLog> timeline = orderService.getOrderTimeline(trackingCode);

        Map<String, Object> data = new HashMap<>();
        data.put("order", order);
        data.put("timeline", timeline);

        return ResponseEntity.ok(ApiResponse.success(data, "Tra cứu hành trình thành công"));
    }

    @GetMapping("/default-sender-address")
    public ResponseEntity<ApiResponse<MerchantAddress>> getDefaultSenderAddress(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long merchantId = userDetails != null ? userDetails.getId() : 1L;
        MerchantAddress address = orderService.getDefaultSenderAddress(merchantId);
        return ResponseEntity.ok(ApiResponse.success(address));
    }

    @PostMapping("/default-sender-address")
    public ResponseEntity<ApiResponse<MerchantAddress>> saveDefaultSenderAddress(
            @RequestBody MerchantAddress address,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        Long merchantId = userDetails != null ? userDetails.getId() : 1L;
        MerchantAddress saved = orderService.saveDefaultSenderAddress(address, merchantId);
        return ResponseEntity.ok(ApiResponse.success(saved, "Lưu thông tin người gửi mặc định thành công"));
    }
}
