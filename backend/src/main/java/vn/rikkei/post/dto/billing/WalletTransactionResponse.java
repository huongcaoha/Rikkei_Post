package vn.rikkei.post.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WalletTransactionResponse {
    private Long id;
    private Long merchantId;
    private String transactionCode;
    private String transactionType;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private String status;
    private String referenceCode;
    private String description;
    private LocalDateTime createdAt;
}
