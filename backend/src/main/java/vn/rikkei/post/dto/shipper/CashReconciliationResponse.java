package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.rikkei.post.dto.order.OrderResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashReconciliationResponse {
    private Long shipperId;
    private String shipperName;
    private String shipperPhone;
    private LocalDate shiftDate;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalOrdersDelivered;
    private BigDecimal totalCodCollected;
    private BigDecimal totalFeeCollected;
    /**
     * Tổng số tiền cần nộp hôm nay (chỉ tính các đơn CHƯA nộp: isCashSettled = false)
     */
    private BigDecimal totalCashToSubmit;
    /**
     * Số tiền nợ COD từ các ngày trước đó chưa nộp (nếu > 0 sẽ bị khóa xuất kho đi giao)
     */
    private BigDecimal pastUnsettledDebt;
    /**
     * Cờ đánh dấu có bị khóa nhận đơn giao tiếp theo do còn nợ tiền ngày trước hay không
     */
    private Boolean isBlockedFromDelivery;
    private Integer unsettledOrdersCount;
    private Integer settledOrdersCount;
    private List<OrderResponse> orders;
}
