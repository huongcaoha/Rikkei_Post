package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeliveryFailureRequest {
    private String trackingCode;
    private String reason;
    private String notes;
    private String failureProofPhotoUrl;
    private LocalDate rescheduledDate;
}
