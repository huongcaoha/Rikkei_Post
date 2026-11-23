package vn.rikkei.post.dto.order;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardStatsResponse {
    private long totalOrders;
    private long createdOrders;
    private long inTransitOrders;
    private long deliveringOrders;
    private long deliveredOrders;
    private long failedOrders;
    private BigDecimal totalCodCollected;
    private BigDecimal totalShippingFee;
    private double successRate;
}
