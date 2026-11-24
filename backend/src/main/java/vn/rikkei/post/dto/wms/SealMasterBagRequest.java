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
public class SealMasterBagRequest {

    @NotBlank(message = "Mã kẹp chì (Seal) không được để trống")
    private String sealNumber;
}
