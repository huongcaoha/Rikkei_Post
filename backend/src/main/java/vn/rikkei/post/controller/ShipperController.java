package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.ShipperService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/shipper")
@RequiredArgsConstructor
public class ShipperController {

    private final ShipperService shipperService;

    @GetMapping("/tasks")
    public ResponseEntity<ApiResponse<List<OrderResponse>>> getMyTasks(
            @RequestParam(required = false) String taskType,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        List<OrderResponse> tasks = shipperService.getMyAssignedOrders(shipperId, taskType);
        return ResponseEntity.ok(ApiResponse.success(tasks));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSummary(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long shipperId = userDetails != null ? userDetails.getId() : 1L;
        Map<String, Object> summary = shipperService.getShipperSummary(shipperId);
        return ResponseEntity.ok(ApiResponse.success(summary));
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
}
