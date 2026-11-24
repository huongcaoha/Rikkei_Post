package vn.rikkei.post.dto.carrier;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CarrierPartnerRequest {
    @NotBlank(message = "Mã đối tác không được để trống")
    private String partnerCode;

    @NotBlank(message = "Tên công ty đối tác không được để trống")
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
}
