package vn.rikkei.post.dto.tms;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoadBagToManifestRequest {

    @NotBlank(message = "Mã bao tải không được để trống")
    private String bagCode;
}
