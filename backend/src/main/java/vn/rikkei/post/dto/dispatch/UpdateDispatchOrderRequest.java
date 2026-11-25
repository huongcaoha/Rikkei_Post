package vn.rikkei.post.dto.dispatch;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateDispatchOrderRequest {
    private Long driverId;
    private Long truckId;
    private Long destWarehouseId;
    private String notes;
    private LocalDateTime departureTime;
    private List<String> bagCodes;
}
