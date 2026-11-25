package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.voucher.*;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.PaymentVoucherService;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/vouchers")
@RequiredArgsConstructor
public class PaymentVoucherController {

    private final PaymentVoucherService voucherService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<PaymentVoucherResponse>> createVoucher(
            @Valid @RequestBody CreateVoucherRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentVoucherResponse response = voucherService.createVoucher(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response, "Khởi tạo phiếu thu/chi thành công, đã gửi yêu cầu tới Kế toán!"));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<PaymentVoucherResponse>>> getMyVouchers(
            @RequestParam(required = false) String voucherType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<PaymentVoucherResponse> list = voucherService.getMyVouchers(currentUser, voucherType, status, startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<List<PaymentVoucherResponse>>> getAllVouchers(
            @RequestParam(required = false) String voucherType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<PaymentVoucherResponse> list = voucherService.getAllVouchers(currentUser, voucherType, status, warehouseId, startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PaymentVoucherResponse>> getVoucherById(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentVoucherResponse response = voucherService.getVoucherById(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PaymentVoucherResponse>> approveVoucher(
            @PathVariable Long id,
            @RequestBody(required = false) ApproveVoucherRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentVoucherResponse response = voucherService.approveVoucher(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã phê duyệt và giải ngân phiếu thành công!"));
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PaymentVoucherResponse>> rejectVoucher(
            @PathVariable Long id,
            @Valid @RequestBody RejectVoucherRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PaymentVoucherResponse response = voucherService.rejectVoucher(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã từ chối phiếu thu/chi!"));
    }
}
