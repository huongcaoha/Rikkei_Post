package vn.rikkei.post.dto.pricing;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CalculatePriceRequest {

    @NotNull(message = "Tỉnh gửi không được để trống")
    private Integer senderProvinceId;

    @NotNull(message = "Tỉnh nhận không được để trống")
    private Integer receiverProvinceId;

    @NotNull(message = "Trọng lượng thực tế không được để trống")
    private Integer actualWeightGram;

    @Builder.Default
    private Integer lengthCm = 10;

    @Builder.Default
    private Integer widthCm = 10;

    @Builder.Default
    private Integer heightCm = 10;

    @Builder.Default
    private BigDecimal itemValue = BigDecimal.ZERO;

    @Builder.Default
    private String serviceType = "STANDARD"; // "STANDARD", "EXPRESS", "ROAD_FREIGHT"

    @Builder.Default
    private String pickupType = "DROP_OFF"; // "DROP_OFF" hoặc "DOOR_PICKUP"

    private Long merchantId;

    private Integer merchantTotalOrders;
}
