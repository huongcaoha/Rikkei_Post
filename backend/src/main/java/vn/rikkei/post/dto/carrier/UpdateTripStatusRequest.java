package vn.rikkei.post.dto.carrier;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTripStatusRequest {
    private String status; // "IN_TRANSIT", "COMPLETED_ON_TIME", "DELAYED"
    private LocalDateTime actualArrivalTime;
    private String notes;
}
