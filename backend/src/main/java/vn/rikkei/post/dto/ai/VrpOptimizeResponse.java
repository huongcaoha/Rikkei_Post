package vn.rikkei.post.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VrpOptimizeResponse {
    private Integer totalStops;
    private Double totalDistanceKm;
    private Integer totalEstimatedMinutes;
    private Double originalDistanceKm;
    private Double distanceSavedKm;
    private Double savingsPercent;
    private List<VrpStopDto> stops;
    private String algorithmUsed; // "Nearest Neighbor + 2-Opt Heuristic"
    private String polylineSummary;
}
