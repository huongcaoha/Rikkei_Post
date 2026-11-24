package vn.rikkei.post.dto.pricing;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
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
public class PricingPolicyRequest {

    @NotNull(message = "Cước lấy hàng tận nơi cơ sở không được để trống")
    @DecimalMin(value = "0.0", message = "Cước lấy hàng không được âm")
    private BigDecimal doorPickupBaseFee;

    @NotNull(message = "Ngưỡng số đơn miễn phí lấy hàng không được để trống")
    @Min(value = 0, message = "Ngưỡng số đơn không được âm")
    private Integer freePickupOrderThreshold;

    @NotNull(message = "Ngưỡng trọng lượng đơn nhỏ không được để trống")
    @Min(value = 100, message = "Ngưỡng trọng lượng tối thiểu 100g")
    private Integer bulkyWeightThresholdGram;

    @NotNull(message = "Chiều dài tối đa đơn nhỏ không được để trống")
    @Min(value = 5, message = "Chiều dài tối thiểu 5cm")
    private Integer bulkyMaxDimensionCm;

    @NotNull(message = "Tổng 3 chiều tối đa đơn nhỏ không được để trống")
    @Min(value = 10, message = "Tổng 3 chiều tối thiểu 10cm")
    private Integer bulkySumDimensionsCm;

    @NotNull(message = "Phụ phí mỗi kg vượt ngưỡng không được để trống")
    @DecimalMin(value = "0.0", message = "Phụ phí mỗi kg không được âm")
    private BigDecimal bulkyExtraPricePerKg;

    @NotNull(message = "Phụ phí quá khổ kích thước không được để trống")
    @DecimalMin(value = "0.0", message = "Phụ phí quá khổ không được âm")
    private BigDecimal oversizeDimensionFee;

    @NotNull(message = "Ngưỡng giá trị tính bảo hiểm không được để trống")
    @DecimalMin(value = "0.0", message = "Ngưỡng giá trị bảo hiểm không được âm")
    private BigDecimal insuranceValueThreshold;

    @NotNull(message = "Tỷ lệ % phí bảo hiểm không được để trống")
    @DecimalMin(value = "0.0", message = "Tỷ lệ phí bảo hiểm không được âm")
    private BigDecimal insurancePercentRate;
}
