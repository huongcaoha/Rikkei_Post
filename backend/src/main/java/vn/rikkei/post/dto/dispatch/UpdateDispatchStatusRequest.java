package vn.rikkei.post.dto.dispatch;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateDispatchStatusRequest {

    @NotBlank(message = "Trạng thái không được để trống")
    private String status; // IN_TRANSIT, COMPLETED, CANCELLED

    private String notes;
}
