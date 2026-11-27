package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.dto.shipper.*;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.ShipperService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import vn.payos.model.webhooks.Webhook;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/shipper")
@RequiredArgsConstructor
public class ShipperController {

    private final ShipperService shipperService;

    @GetMapping("/tasks")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getMyTasks(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String taskType,
            @RequestParam(required = false) Long shipperId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long currentUserId = userDetails != null ? userDetails.getId() : 1L;
        String selectedCategory = (category != null && !category.isBlank()) ? category : taskType;
        List<OrderResponse> tasks = shipperService.getMyAssignedOrders(currentUserId, shipperId, selectedCategory, startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary(
            @RequestParam(required = false) Long shipperId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long currentUserId = userDetails != null ? userDetails.getId() : 1L;
        Map<String, Object> summary = shipperService.getShipperSummary(currentUserId, shipperId, startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(summary));
    }

    @GetMapping("/post-office-shippers")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getPostOfficeShippers(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long currentUserId = userDetails != null ? userDetails.getId() : 1L;
        List<Map<String, Object>> shippers = shipperService.getPostOfficeShippers(currentUserId);
        return ResponseEntity.ok(ApiResponse.success(shippers));
    }

    @PostMapping("/scan-pickup")
    public ResponseEntity<ApiResponse<OrderResponse>> scanPickup(
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        String trackingCode = payload.get("trackingCode");
        OrderResponse response = shipperService.scanPickupOrder(shipperId, trackingCode);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã quét nhận hàng tại Shop thành công!"));
    }

    @PostMapping("/scan-inbound")
    public ResponseEntity<ApiResponse<OrderResponse>> scanInbound(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        String trackingCode = (String) payload.get("trackingCode");
        Long warehouseId = payload.get("warehouseId") != null ? Long.valueOf(payload.get("warehouseId").toString()) : null;
        OrderResponse response = shipperService.scanInboundToPostOffice(shipperId, trackingCode, warehouseId);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã quét nhập kho bưu cục thành công!"));
    }

    @PostMapping("/scan-delivery")
    public ResponseEntity<ApiResponse<OrderResponse>> scanDelivery(
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        String trackingCode = payload.get("trackingCode");
        OrderResponse response = shipperService.scanOutForDelivery(shipperId, trackingCode);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã quét xuất kho lấy đơn hàng đi giao thành công!"));
    }

    @PostMapping("/update-status")
    public ResponseEntity<ApiResponse<OrderResponse>> updateStatus(
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        String trackingCode = payload.get("trackingCode");
        String status = payload.get("status");
        String note = payload.get("note");
        OrderResponse response = shipperService.updateDeliveryStatus(shipperId, trackingCode, status, note);
        return ResponseEntity.ok(ApiResponse.success(response, "Cập nhật trạng thái giao hàng thành công!"));
    }

    @PostMapping("/scan-return")
    public ResponseEntity<ApiResponse<OrderResponse>> scanReturn(
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long currentUserId = userDetails != null ? userDetails.getId() : 1L;
        String trackingCode = payload.get("trackingCode");
        String reason = payload.get("reason");
        String note = payload.get("note");
        OrderResponse response = shipperService.scanReturnToWarehouse(currentUserId, trackingCode, reason, note);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã quét thu hồi đơn hàng hoàn về kho thành công!"));
    }

    // ==========================================
    // SPRINT 3: VẬN TẢI TMS, BƯU TÁ & POD
    // ==========================================

    @PostMapping("/smart-dispatch")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<OrderResponse>> smartDispatch(
            @RequestBody SmartDispatchRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null) {
            throw new org.springframework.security.access.AccessDeniedException("Yêu cầu đăng nhập quản lý để điều phối bưu tá");
        }
        Long currentUserId = userDetails.getId();
        OrderResponse response = shipperService.smartDispatchOrder(request.getTrackingCode(), request.getShipperId(), currentUserId);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã điều phối bưu tá thành công!"));
    }

    @PostMapping("/smart-dispatch-batch")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> smartDispatchBatch(
            @RequestParam(required = false) Long postOfficeId,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null) {
            throw new org.springframework.security.access.AccessDeniedException("Yêu cầu đăng nhập quản lý để điều phối bưu tá");
        }
        Long currentUserId = userDetails.getId();
        Map<String, Object> result = shipperService.smartDispatchBatch(postOfficeId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(result, (String) result.get("message")));
    }

    @PostMapping("/send-otp")
    public ResponseEntity<ApiResponse<Map<String, Object>>> sendDeliveryOtp(
            @RequestBody SendOtpRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long currentUserId = userDetails != null ? userDetails.getId() : 1L;
        Map<String, Object> result = shipperService.sendDeliveryOtp(request.getTrackingCode(), currentUserId);
        return ResponseEntity.ok(ApiResponse.success(result, (String) result.get("message")));
    }

    @PostMapping("/complete-delivery")
    public ResponseEntity<ApiResponse<OrderResponse>> completeDelivery(
            @RequestBody CompleteDeliveryRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        OrderResponse response = shipperService.completeDelivery(shipperId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Giao hàng thành công! Đã lưu bằng chứng POD an toàn."));
    }

    @PostMapping("/report-failure")
    public ResponseEntity<ApiResponse<OrderResponse>> reportFailure(
            @RequestBody DeliveryFailureRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        OrderResponse response = shipperService.reportDeliveryFailure(shipperId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã ghi nhận báo cáo giao thất bại."));
    }

    @PostMapping("/scan-outbound-return")
    public ResponseEntity<ApiResponse<OrderResponse>> scanOutboundReturn(
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        String trackingCode = payload.get("trackingCode");
        OrderResponse response = shipperService.scanOutboundForReturn(shipperId, trackingCode);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã quét xuất kho lấy đơn hàng chuyển hoàn đi trả Shop thành công!"));
    }

    @PostMapping("/complete-return")
    public ResponseEntity<ApiResponse<OrderResponse>> completeReturn(
            @RequestBody CompleteReturnRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        OrderResponse response = shipperService.completeReturn(shipperId, request);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã xác nhận hoàn trả hàng cho Shop thành công! Đã lưu ảnh chụp bằng chứng."));
    }

    @GetMapping("/cash-reconciliation")
    public ResponseEntity<ApiResponse<CashReconciliationResponse>> getCashReconciliation(
            @RequestParam(required = false) Long shipperId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long currentUserId = userDetails != null ? userDetails.getId() : 1L;
        LocalDate effectiveStart = startDate != null ? startDate : date;
        LocalDate effectiveEnd = endDate != null ? endDate : date;
        CashReconciliationResponse response = shipperService.getCashReconciliation(currentUserId, shipperId, effectiveStart, effectiveEnd);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/submit-cash")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitCash(
            @RequestBody CashSubmitRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        Map<String, Object> result = shipperService.submitCashReconciliation(shipperId, request);
        return ResponseEntity.ok(ApiResponse.success(result, (String) result.get("message")));
    }

    @GetMapping("/cash-submissions")
    public ResponseEntity<ApiResponse<Page<CashSubmissionResponse>>> getCashSubmissions(
            @RequestParam(required = false) Long shipperId,
            @RequestParam(required = false) Long postOfficeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Pageable pageable = PageRequest.of(page, size);
        Page<CashSubmissionResponse> result = shipperService.getCashSubmissions(shipperId, postOfficeId, startDate, endDate, pageable);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/cash-submissions/check/{submissionCode}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> checkSubmissionStatus(
            @PathVariable String submissionCode
    ) {
        Map<String, Object> result = shipperService.checkSubmissionPaymentStatus(submissionCode);
        return ResponseEntity.ok(ApiResponse.success(result, (String) result.get("message")));
    }

    @PostMapping("/cash-submissions/approve/{submissionCode}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> approveCashSubmission(
            @PathVariable String submissionCode,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails == null) {
            throw new org.springframework.security.access.AccessDeniedException("Yêu cầu đăng nhập cấp quản lý để duyệt nộp tiền");
        }
        Long managerId = userDetails.getId();
        Map<String, Object> result = shipperService.approveCashSubmission(submissionCode, managerId);
        return ResponseEntity.ok(ApiResponse.success(result, (String) result.get("message")));
    }

    @PostMapping("/payos-webhook")
    public ResponseEntity<String> handlePayOsWebhook(@RequestBody Webhook webhook) {
        try {
            shipperService.handlePayOsWebhook(webhook);
            return ResponseEntity.ok("OK");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Webhook Error: " + e.getMessage());
        }
    }
}
