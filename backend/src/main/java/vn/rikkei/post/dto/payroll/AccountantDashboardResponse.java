package vn.rikkei.post.dto.payroll;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountantDashboardResponse {
    // 1. Tổng tiền COD thu hộ từ khách hàng
    private BigDecimal totalCodCollected;

    // 2. Tổng số tiền phải chi trả cho khách hàng (sau khi khấu trừ cước)
    private BigDecimal totalMerchantPayable;

    // 3. Tổng lợi nhuận / doanh thu tiền ship của toàn bộ đơn hàng
    private BigDecimal totalShippingRevenue;

    // 4. Tổng số tiền đã chi (Phiếu chi duyệt + Lương nhân viên đã giải ngân)
    private BigDecimal totalExpenses;

    // 5. Lợi nhuận ròng = Doanh thu ship - Tổng chi phí
    private BigDecimal netProfit;

    // 6. Số lượng chờ duyệt
    private long pendingVouchersCount;
    private long pendingPayrollCount;

    // 7. Tổng số phiếu thu & chi đã duyệt trong kỳ
    private BigDecimal approvedReceiptsAmount;
    private BigDecimal approvedPaymentsAmount;
    private BigDecimal paidSalariesAmount;

    // 8. Tóm tắt theo danh mục chi
    private Map<String, BigDecimal> expenseBreakdownByCategory;
}
