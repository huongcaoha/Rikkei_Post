package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.billing.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.BillingService;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/v1/billing")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService billingService;

    @GetMapping("/wallet")
    public ResponseEntity<ApiResponse<WalletResponse>> getWallet(
            @RequestParam(required = false) Long merchantId,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long targetId = null;
        if (isAdminOrStaff(userDetails) && merchantId != null) {
            targetId = merchantId;
        } else if (userDetails != null) {
            targetId = userDetails.getId();
        } else {
            targetId = 1L;
        }
        WalletResponse res = billingService.getMerchantWallet(targetId);
        return ResponseEntity.ok(ApiResponse.ok("Lấy thông tin ví Shop thành công", res));
    }

    @PutMapping("/wallet/bank")
    public ResponseEntity<ApiResponse<WalletResponse>> updateWalletBank(
            @RequestParam String bankName,
            @RequestParam String bankAccountNumber,
            @RequestParam String bankAccountHolder,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long targetId = userDetails != null ? userDetails.getId() : 1L;
        WalletResponse res = billingService.updateWalletBank(targetId, bankName, bankAccountNumber, bankAccountHolder);
        return ResponseEntity.ok(ApiResponse.ok("Cập nhật thông tin tài khoản ngân hàng thành công", res));
    }

    @PostMapping("/reconciliations")
    public ResponseEntity<ApiResponse<ReconciliationSheetResponse>> createReconciliationSheet(
            @RequestBody @Valid CreateReconciliationRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long targetId = userDetails != null ? userDetails.getId() : 1L;
        ReconciliationSheetResponse res = billingService.createReconciliationSheet(request, targetId);
        return ResponseEntity.ok(ApiResponse.ok("Tạo Bảng kê Đối soát COD thành công", res));
    }

    @GetMapping("/reconciliations")
    public ResponseEntity<ApiResponse<Page<ReconciliationSheetResponse>>> getReconciliationSheets(
            @RequestParam(required = false) Long merchantId,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long targetId = null;
        if (isAdminOrStaff(userDetails)) {
            targetId = merchantId;
        } else if (userDetails != null) {
            targetId = userDetails.getId();
        }
        Page<ReconciliationSheetResponse> res = billingService.getReconciliationSheets(targetId, status, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok("Lấy danh sách bảng kê đối soát thành công", res));
    }

    @GetMapping("/reconciliations/{id}")
    public ResponseEntity<ApiResponse<ReconciliationDetailResponse>> getSheetDetail(@PathVariable Long id) {
        ReconciliationDetailResponse res = billingService.getSheetDetail(id);
        return ResponseEntity.ok(ApiResponse.ok("Lấy chi tiết bảng kê đối soát thành công", res));
    }

    @GetMapping("/reconciliations/code/{code}")
    public ResponseEntity<ApiResponse<ReconciliationDetailResponse>> getSheetDetailByCode(@PathVariable String code) {
        ReconciliationDetailResponse res = billingService.getSheetDetailByCode(code);
        return ResponseEntity.ok(ApiResponse.ok("Lấy chi tiết bảng kê đối soát thành công", res));
    }

    @PostMapping("/reconciliations/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER')")
    public ResponseEntity<ApiResponse<ReconciliationSheetResponse>> approveAndPayout(
            @PathVariable Long id,
            @RequestBody(required = false) ApprovePayoutRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long targetId = userDetails != null ? userDetails.getId() : 1L;
        ReconciliationSheetResponse res = billingService.approveAndPayout(id, request, targetId);
        return ResponseEntity.ok(ApiResponse.ok("Duyệt thanh toán bảng kê COD và cộng tiền vào ví Shop thành công", res));
    }

    @PostMapping("/wallet/withdraw")
    public ResponseEntity<ApiResponse<WalletTransactionResponse>> withdraw(
            @RequestBody @Valid WithdrawalRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long targetId = userDetails != null ? userDetails.getId() : 1L;
        WalletTransactionResponse res = billingService.requestWithdrawal(request, targetId);
        return ResponseEntity.ok(ApiResponse.ok("Yêu cầu rút tiền thành công", res));
    }

    @GetMapping("/wallet/transactions")
    public ResponseEntity<ApiResponse<Page<WalletTransactionResponse>>> getTransactions(
            @RequestParam(required = false) Long merchantId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long targetId = null;
        if (isAdminOrStaff(userDetails)) {
            targetId = merchantId;
        } else if (userDetails != null) {
            targetId = userDetails.getId();
        }
        Page<WalletTransactionResponse> res = billingService.getWalletTransactions(targetId, PageRequest.of(page, size));
        return ResponseEntity.ok(ApiResponse.ok("Lấy lịch sử giao dịch ví thành công", res));
    }

    @GetMapping("/reconciliations/{id}/export-csv")
    public ResponseEntity<byte[]> exportCsv(@PathVariable Long id) {
        String csv = billingService.exportReconciliationCsv(id);
        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=reconciliation-" + id + ".csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    private boolean isAdminOrStaff(CustomUserDetails userDetails) {
        if (userDetails == null || userDetails.getAuthorities() == null) return false;
        return userDetails.getAuthorities().stream().anyMatch(a ->
                "ROLE_ADMIN".equalsIgnoreCase(a.getAuthority()) ||
                "ROLE_BRANCH_MANAGER".equalsIgnoreCase(a.getAuthority()) ||
                "ROLE_WAREHOUSE_STAFF".equalsIgnoreCase(a.getAuthority()) ||
                "ROLE_ACCOUNTANT".equalsIgnoreCase(a.getAuthority())
        );
    }
}
