package vn.rikkei.post.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VrpStopDto {
    private Integer stopNumber; // 1, 2, 3...
    private String trackingCode;
    private String receiverName;
    private String receiverPhone;
    private String receiverAddress;
    private Double lat;
    private Double lng;
    private Double distanceFromPrevKm;
    private Integer estimatedTravelMinutes;
    private BigDecimal codAmount;
    private String currentStatus;
}
