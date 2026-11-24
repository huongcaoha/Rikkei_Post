package vn.rikkei.post.dto.wms;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AddBagItemRequest {

    @NotBlank(message = "Mã vận đơn không được để trống")
    private String trackingCode;
}
