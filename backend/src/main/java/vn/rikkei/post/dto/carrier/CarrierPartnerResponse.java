package vn.rikkei.post.dto.carrier;

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
public class CarrierPartnerResponse {
    private Long id;
    private String partnerCode;
    private String companyName;
    private String contactPerson;
    private String contactPhone;
    private String email;
    private Integer vehicleFleetCount;
    private String routesOperated;
    private BigDecimal contractPricePerKm;
    private Double onTimeDeliveryRate;
    private Double slaScore;
    private String status;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
