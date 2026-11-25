package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.payroll.*;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.PayrollService;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/payroll")
@RequiredArgsConstructor
public class PayrollController {

    private final PayrollService payrollService;

    @PostMapping("/generate")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<List<PayrollRecordResponse>>> generateMonthlyPayroll(
            @Valid @RequestBody GeneratePayrollRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<PayrollRecordResponse> list = payrollService.generateMonthlyPayroll(request, currentUser);
        return ResponseEntity.ok(ApiResponse.success(list, "AI và Hệ thống đã tính toán bảng lương 3P tháng " + request.getMonth() + "/" + request.getYear() + " thành công!"));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<List<PayrollRecordResponse>>> getPayrollList(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<PayrollRecordResponse> list = payrollService.getPayrollList(month, year, warehouseId, status, currentUser);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/my")
    public ResponseEntity<ApiResponse<PayrollRecordResponse>> getMyPayroll(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PayrollRecordResponse response = payrollService.getMyPayroll(month, year, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PutMapping("/{id}/manager-approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<PayrollRecordResponse>> managerApprovePayroll(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PayrollRecordResponse response = payrollService.managerApprovePayroll(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success(response, "Quản lý đã duyệt bảng lương và chuyển sang Kế toán xét duyệt chi trả!"));
    }

    @PutMapping("/{id}/accountant-approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<PayrollRecordResponse>> accountantApproveAndDisburse(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        PayrollRecordResponse response = payrollService.accountantApproveAndDisburse(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success(response, "Kế toán đã duyệt chi trả và giải ngân lương thành công!"));
    }

    @PostMapping("/batch-approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<PayrollRecordResponse>>> batchAccountantApprove(
            @RequestBody List<Long> payrollIds,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<PayrollRecordResponse> list = payrollService.batchAccountantApprove(payrollIds, currentUser);
        return ResponseEntity.ok(ApiResponse.success(list, "Đã duyệt và giải ngân hàng loạt " + list.size() + " bảng lương!"));
    }

    @GetMapping("/accountant/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<AccountantDashboardResponse>> getAccountantDashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        AccountantDashboardResponse response = payrollService.getAccountantDashboard(startDate, endDate, currentUser);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
