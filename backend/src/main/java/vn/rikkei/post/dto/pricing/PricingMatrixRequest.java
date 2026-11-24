package vn.rikkei.post.dto.pricing;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PricingMatrixRequest {

    @NotBlank(message = "Loại dịch vụ không được để trống")
    private String serviceType; // STANDARD, EXPRESS, ROAD_FREIGHT, SAME_DAY...

    @NotBlank(message = "Vùng cước không được để trống")
    private String zoneType; // INTRA_PROVINCE, INTRA_REGION, INTER_REGION_NEAR, INTER_REGION_FAR

    @NotNull(message = "Khối lượng cơ bản không được để trống")
    @Min(value = 1, message = "Khối lượng cơ bản phải lớn hơn 0")
    private Integer baseWeightGram;

    @NotNull(message = "Cước phí cơ bản không được để trống")
    @DecimalMin(value = "0.0", message = "Cước phí cơ bản không được âm")
    private BigDecimal basePrice;

    @NotNull(message = "Nấc khối lượng tăng thêm không được để trống")
    @Min(value = 1, message = "Nấc khối lượng tăng thêm phải lớn hơn 0")
    private Integer stepWeightGram;

    @NotNull(message = "Cước phí mỗi nấc tăng không được để trống")
    @DecimalMin(value = "0.0", message = "Cước phí mỗi nấc tăng không được âm")
    private BigDecimal stepPrice;

    @NotNull(message = "Thời gian giao dự kiến không được để trống")
    @Min(value = 1, message = "Thời gian giao dự kiến phải tối thiểu 1 giờ")
    private Integer estimatedDeliveryHours;

    private Boolean isActive;
}
