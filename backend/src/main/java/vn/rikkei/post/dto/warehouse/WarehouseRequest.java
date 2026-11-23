package vn.rikkei.post.dto.warehouse;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WarehouseRequest {

    @NotBlank(message = "Mã kho/bưu cục không được để trống")
    private String code; // Ví dụ: SPOKE_HN_CG, HUB_HN_NORTH

    @NotBlank(message = "Tên kho/bưu cục không được để trống")
    private String name;

    @NotBlank(message = "Loại kho không được để trống")
    private String type; // "HUB" hoặc "SPOKE_POST_OFFICE"

    @NotNull(message = "Tỉnh/Thành phố không được để trống")
    private Integer provinceId;

    private Integer districtId;

    @NotBlank(message = "Địa chỉ chi tiết không được để trống")
    private String address;

    @NotNull(message = "Vĩ độ (Latitude) không được để trống")
    private Double latitude;

    @NotNull(message = "Kinh độ (Longitude) không được để trống")
    private Double longitude;

    @Builder.Default
    private Integer capacityPackages = 50000;

    @Builder.Default
    private Boolean isActive = true;
}
