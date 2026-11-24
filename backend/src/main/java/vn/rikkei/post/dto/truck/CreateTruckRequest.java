package vn.rikkei.post.dto.truck;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateTruckRequest {

    @NotBlank(message = "Loại xe tải không được để trống")
    private String truckType; // e.g. "Xe tải 1.25 tấn", "Xe tải 2.5 tấn", "Xe tải 5 tấn", "Container 40 feet"

    @NotNull(message = "Tải trọng không được để trống")
    @Positive(message = "Tải trọng phải lớn hơn 0")
    private Double payloadKg; // e.g. 2500.0

    @NotBlank(message = "Biển số xe không được để trống")
    private String licensePlate; // e.g. "29C-888.99"

    @NotNull(message = "Kho trung chuyển (HUB) không được để trống")
    private Long currentWarehouseId;

    private String status; // Default "AT_WAREHOUSE"

    private Long currentDriverId;

    private String notes;
}
