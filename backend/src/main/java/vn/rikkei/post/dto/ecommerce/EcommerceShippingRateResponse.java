package vn.rikkei.post.dto.ecommerce;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EcommerceShippingRateResponse {

    private BigDecimal shippingFee;
    private BigDecimal codFee;
    private BigDecimal insuranceFee;
    private BigDecimal totalAmount;
    private Integer estimatedDays;
    private String serviceType;
    private String carrierName; // "Rikkei Post Express"
}
