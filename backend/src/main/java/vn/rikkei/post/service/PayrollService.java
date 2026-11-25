package vn.rikkei.post.service;

import vn.rikkei.post.dto.payroll.*;
import vn.rikkei.post.security.CustomUserDetails;

import java.time.LocalDate;
import java.util.List;

public interface PayrollService {
    List<PayrollRecordResponse> generateMonthlyPayroll(GeneratePayrollRequest request, CustomUserDetails currentUser);
    PayrollRecordResponse managerApprovePayroll(Long payrollId, CustomUserDetails currentUser);
    PayrollRecordResponse accountantApproveAndDisburse(Long payrollId, CustomUserDetails currentUser);
    List<PayrollRecordResponse> batchAccountantApprove(List<Long> payrollIds, CustomUserDetails currentUser);
    List<PayrollRecordResponse> getPayrollList(Integer month, Integer year, Long warehouseId, String status, CustomUserDetails currentUser);
    PayrollRecordResponse getMyPayroll(Integer month, Integer year, Long userId);
    AccountantDashboardResponse getAccountantDashboard(LocalDate startDate, LocalDate endDate, CustomUserDetails currentUser);
}
