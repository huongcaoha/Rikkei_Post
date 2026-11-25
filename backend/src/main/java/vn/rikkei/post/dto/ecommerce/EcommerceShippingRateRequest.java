package vn.rikkei.post.dto.ecommerce;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EcommerceShippingRateRequest {

    @NotNull(message = "Mã tỉnh xuất phát không được để trống")
    private Integer fromProvinceId;

    @NotNull(message = "Mã tỉnh đích đến không được để trống")
    private Integer toProvinceId;

    @NotNull(message = "Trọng lượng (gram) không được để trống")
    private Integer weightGram;

    @Builder.Default
    private BigDecimal codAmount = BigDecimal.ZERO;

    @Builder.Default
    private String serviceType = "STANDARD";
}
