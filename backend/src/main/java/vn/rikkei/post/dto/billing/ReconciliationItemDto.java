package vn.rikkei.post.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReconciliationItemDto {
    private Long id;
    private Long orderId;
    private String trackingCode;
    private String receiverName;
    private BigDecimal codAmount;
    private BigDecimal shippingFee;
    private BigDecimal insuranceFee;
    private BigDecimal netAmount;
    private LocalDateTime deliveredAt;
}
