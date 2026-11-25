package vn.rikkei.post.dto.dispatch;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchScanInboundRequest {

    @NotBlank(message = "Mã bao tải hoặc mã seal không được để trống")
    private String bagCode;
}
