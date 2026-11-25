package vn.rikkei.post.dto.voucher;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RejectVoucherRequest {
    @NotBlank(message = "Lý do từ chối không được để trống")
    private String rejectionReason;
}
