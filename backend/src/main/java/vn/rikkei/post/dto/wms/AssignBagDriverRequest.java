package vn.rikkei.post.dto.wms;

import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignBagDriverRequest {

    @NotNull(message = "Vui lòng chọn tài xế xe tải")
    private Long driverId;

    private Long truckId;

    private String notes;
}
