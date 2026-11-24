package vn.rikkei.post.dto.tms;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateManifestRequest {

    @NotBlank(message = "Mã tuyến / chuyến xe không được để trống")
    private String tripCode;

    @NotBlank(message = "Biển số xe tải không được để trống")
    private String vehiclePlate;

    @NotBlank(message = "Tên tài xế không được để trống")
    private String driverName;

    @NotBlank(message = "Số điện thoại tài xế không được để trống")
    private String driverPhone;

    @NotNull(message = "Hub xuất phát không được để trống")
    private Long originHubId;

    @NotNull(message = "Hub đích đến không được để trống")
    private Long destHubId;

    @NotBlank(message = "Mã niêm phong kẹp chì xe tải không được để trống")
    private String truckSealNumber;

    @NotNull(message = "Thời gian xuất bến dự kiến không được để trống")
    private LocalDateTime departureScheduledAt;

    @NotNull(message = "Thời gian đến dự kiến không được để trống")
    private LocalDateTime arrivalEstimatedAt;

    private String notes;

    private List<String> bagCodes;
}
