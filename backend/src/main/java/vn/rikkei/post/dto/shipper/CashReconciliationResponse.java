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
    private Integer totalOrdersDelivered;
    private BigDecimal totalCodCollected;
    private BigDecimal totalFeeCollected;
    private BigDecimal totalCashToSubmit;
    private List<OrderResponse> orders;
}
