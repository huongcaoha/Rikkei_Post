package vn.rikkei.post.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictEtaRequest {
    private Integer senderProvinceId;
    private Integer receiverProvinceId;
    private String serviceType; // "EXPRESS", "STANDARD", "ROAD_FREIGHT"
    private Double distanceKm;
}
