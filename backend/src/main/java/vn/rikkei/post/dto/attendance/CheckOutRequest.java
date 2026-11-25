package vn.rikkei.post.dto.attendance;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckOutRequest {
    @NotNull(message = "Tọa độ vĩ độ (Latitude) không được để trống")
    private Double lat;

    @NotNull(message = "Tọa độ kinh độ (Longitude) không được để trống")
    private Double lng;

    private String photoBase64;
    private String notes;
}
