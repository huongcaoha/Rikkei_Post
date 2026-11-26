package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.dispatch.*;
import vn.rikkei.post.dto.wms.MasterBagResponse;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.DispatchService;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/v1/dispatch-orders")
@RequiredArgsConstructor
@Slf4j
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF', 'TRUCK_DRIVER')")
public class DispatchOrderController {

    private final DispatchService dispatchService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DispatchOrderResponse>>> getDispatchOrders(
            @RequestParam(required = false) Long originWarehouseId,
            @RequestParam(required = false) Long destWarehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        LocalDateTime start = startDate != null ? startDate.atStartOfDay() : null;
        LocalDateTime end = endDate != null ? endDate.atTime(LocalTime.MAX) : null;
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        List<String> roles = userDetails != null
                ? userDetails.getAuthorities().stream().map(a -> a.getAuthority()).toList()
                : List.of("ROLE_ADMIN");

        List<DispatchOrderResponse> list = dispatchService.getDispatchOrders(
                originWarehouseId, destWarehouseId, status, start, end, userId, roles
        );
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DispatchOrderResponse>> getDispatchById(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        List<String> roles = userDetails != null
                ? userDetails.getAuthorities().stream().map(a -> a.getAuthority()).toList()
                : List.of("ROLE_ADMIN");
        DispatchOrderResponse res = dispatchService.getDispatchById(id, userId, roles);
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<ApiResponse<DispatchOrderResponse>> getDispatchByCode(
            @PathVariable String code,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        List<String> roles = userDetails != null
                ? userDetails.getAuthorities().stream().map(a -> a.getAuthority()).toList()
                : List.of("ROLE_ADMIN");
        DispatchOrderResponse res = dispatchService.getDispatchByCode(code, userId, roles);
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<DispatchOrderResponse>> createDispatchOrder(
            @Valid @RequestBody CreateDispatchOrderRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        List<String> roles = userDetails != null
                ? userDetails.getAuthorities().stream().map(a -> a.getAuthority()).toList()
                : List.of("ROLE_ADMIN");
        DispatchOrderResponse res = dispatchService.createDispatchOrder(request, userId, roles);
        return ResponseEntity.ok(ApiResponse.success(res, "Khởi tạo lệnh điều vận chuyến xe thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<DispatchOrderResponse>> updateDispatchOrder(
            @PathVariable Long id,
            @RequestBody UpdateDispatchOrderRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        DispatchOrderResponse res = dispatchService.updateDispatchOrder(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Cập nhật lệnh điều vận thành công"));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<DispatchOrderResponse>> updateDispatchStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateDispatchStatusRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        List<String> roles = userDetails != null
                ? userDetails.getAuthorities().stream().map(a -> a.getAuthority()).toList()
                : List.of("ROLE_ADMIN");
        DispatchOrderResponse res = dispatchService.updateDispatchStatus(id, request, userId, roles);
        return ResponseEntity.ok(ApiResponse.success(res, "Cập nhật trạng thái chuyến xe điều vận thành công"));
    }

    @PostMapping("/{id}/load-bag")
    public ResponseEntity<ApiResponse<DispatchOrderResponse>> driverLoadBag(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        List<String> roles = userDetails != null
                ? userDetails.getAuthorities().stream().map(a -> a.getAuthority()).toList()
                : List.of("ROLE_ADMIN");
        String bagCode = payload.get("bagCode");
        DispatchOrderResponse res = dispatchService.driverLoadBag(id, bagCode, userId, roles);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã nạp bao tải lên chuyến xe điều vận thành công"));
    }

    @PostMapping("/{id}/scan-bag")
    public ResponseEntity<ApiResponse<DispatchOrderResponse>> scanBagInbound(
            @PathVariable Long id,
            @Valid @RequestBody DispatchScanInboundRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        Long warehouseId = userDetails != null ? userDetails.getAssignedPostOfficeId() : null;
        DispatchOrderResponse res = dispatchService.scanBagInbound(id, request.getBagCode(), warehouseId, userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Quét nhập kho bao tải thành công"));
    }

    @GetMapping("/available-bags")
    public ResponseEntity<ApiResponse<List<MasterBagResponse>>> getAvailableBags(
            @RequestParam Long originWarehouseId,
            @RequestParam(required = false) Long destWarehouseId
    ) {
        List<MasterBagResponse> bags = dispatchService.getAvailableBagsForDispatch(originWarehouseId, destWarehouseId);
        return ResponseEntity.ok(ApiResponse.success(bags));
    }
}
