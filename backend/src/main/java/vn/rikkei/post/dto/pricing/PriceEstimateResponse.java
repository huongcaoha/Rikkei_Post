package vn.rikkei.post.dto.pricing;

import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceEstimateResponse {
    private Integer actualWeightGram;
    private Integer volumetricWeightGram;
    private Integer billableWeightGram;
    private String zoneType; // INTRA_PROVINCE, INTRA_REGION, INTER_REGION_NEAR, INTER_REGION_FAR
    private BigDecimal shippingFee;
    private BigDecimal insuranceFee;
    private String pickupType;
    private BigDecimal pickupFee;
    private Boolean isPickupFree;
    private String pickupFeeNote;
    private BigDecimal totalFee;
    private Integer estimatedDeliveryHours;
}
