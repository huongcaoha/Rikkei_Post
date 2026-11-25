package vn.rikkei.post.dto.voucher;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApproveVoucherRequest {
    private String disbursementMethod; // "INTERNAL_WALLET", "BANK_TRANSFER", "CASH"
    private String notes;
}
