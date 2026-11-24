package vn.rikkei.post.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PredictEtaResponse {
    private LocalDateTime estimatedDeliveryAt;
    private Integer minHours;
    private Integer maxHours;
    private String transitDescription;
    private String confidenceLevel; // "HIGH", "MEDIUM"
}
