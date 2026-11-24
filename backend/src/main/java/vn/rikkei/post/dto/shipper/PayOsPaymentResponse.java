package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PayOsPaymentResponse {
    private String submissionCode;
    private Long orderCode;
    private BigDecimal amount;
    private String description;
    private String checkoutUrl;
    private String qrCode;
    private String accountName;
    private String accountNumber;
    private String bin;
    private String status;
}
