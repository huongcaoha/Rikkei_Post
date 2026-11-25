package vn.rikkei.post.dto.dispatch;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateDispatchOrderRequest {

    @NotNull(message = "Kho xuất phát không được để trống")
    private Long originWarehouseId;

    @NotNull(message = "Kho / Hub đích đến không được để trống")
    private Long destWarehouseId;

    @NotNull(message = "Tài xế nhận lệnh chuyến xe không được để trống")
    private Long driverId;

    private Long truckId;

    private String notes;

    private LocalDateTime departureTime;

    private List<String> bagCodes;
}
