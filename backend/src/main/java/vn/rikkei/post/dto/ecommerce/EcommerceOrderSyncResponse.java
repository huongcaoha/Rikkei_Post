package vn.rikkei.post.dto.ecommerce;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EcommerceOrderSyncResponse {

    private boolean success;
    private String trackingCode;        // Mã vận đơn Rikkei Post (RKP...)
    private String ecommerceOrderId;    // Mã đơn sàn đối tác
    private String orderStatus;         // PENDING_PICKUP, IN_TRANSIT, v.v.
    private BigDecimal shippingFee;
    private BigDecimal codAmount;
    private String sortingHub;          // Hub bưu cục tiếp nhận gom đơn
    private String labelUrl;            // Link nhãn in vận đơn / mã vạch AWB
    private LocalDateTime createdAt;
    private String message;
}
