package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "pricing_matrix")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PricingMatrix {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "service_type", nullable = false, length = 30)
    private String serviceType; // "STANDARD", "EXPRESS", "ROAD_FREIGHT"

    @Column(name = "zone_type", nullable = false, length = 30)
    private String zoneType; // "INTRA_PROVINCE", "INTRA_REGION", "INTER_REGION_NEAR", "INTER_REGION_FAR"

    @Column(name = "base_weight_gram", nullable = false)
    @Builder.Default
    private Integer baseWeightGram = 500;

    @Column(name = "base_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal basePrice;

    @Column(name = "step_weight_gram", nullable = false)
    @Builder.Default
    private Integer stepWeightGram = 500;

    @Column(name = "step_price", precision = 10, scale = 2, nullable = false)
    private BigDecimal stepPrice;

    @Column(name = "estimated_delivery_hours", nullable = false)
    private Integer estimatedDeliveryHours;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
