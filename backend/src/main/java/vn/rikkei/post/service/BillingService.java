package vn.rikkei.post.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.rikkei.post.dto.billing.*;

public interface BillingService {

    WalletResponse getMerchantWallet(Long merchantId);

    WalletResponse updateWalletBank(Long merchantId, String bankName, String bankAccountNumber, String bankAccountHolder);

    ReconciliationSheetResponse createReconciliationSheet(CreateReconciliationRequest request, Long currentUserId);

    ReconciliationDetailResponse getSheetDetail(Long sheetId);

    ReconciliationDetailResponse getSheetDetailByCode(String sheetCode);

    Page<ReconciliationSheetResponse> getReconciliationSheets(Long merchantId, String status, Pageable pageable);

    ReconciliationSheetResponse approveAndPayout(Long sheetId, ApprovePayoutRequest request, Long currentUserId);

    WalletTransactionResponse requestWithdrawal(WithdrawalRequest request, Long merchantId);

    Page<WalletTransactionResponse> getWalletTransactions(Long merchantId, Pageable pageable);

    String exportReconciliationCsv(Long sheetId);
}
