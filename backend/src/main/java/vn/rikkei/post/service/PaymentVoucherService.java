package vn.rikkei.post.service;

import vn.rikkei.post.dto.voucher.*;
import vn.rikkei.post.security.CustomUserDetails;

import java.time.LocalDate;
import java.util.List;

public interface PaymentVoucherService {
    PaymentVoucherResponse createVoucher(CreateVoucherRequest request, CustomUserDetails currentUser);
    List<PaymentVoucherResponse> getMyVouchers(CustomUserDetails currentUser, String voucherType, String status, LocalDate startDate, LocalDate endDate);
    List<PaymentVoucherResponse> getAllVouchers(CustomUserDetails currentUser, String voucherType, String status, Long warehouseId, LocalDate startDate, LocalDate endDate);
    PaymentVoucherResponse approveVoucher(Long id, ApproveVoucherRequest request, CustomUserDetails currentUser);
    PaymentVoucherResponse rejectVoucher(Long id, RejectVoucherRequest request, CustomUserDetails currentUser);
    PaymentVoucherResponse getVoucherById(Long id, CustomUserDetails currentUser);
}
