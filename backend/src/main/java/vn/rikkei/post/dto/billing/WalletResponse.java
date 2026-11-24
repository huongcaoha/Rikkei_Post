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
public class WalletResponse {
    private Long id;
    private Long merchantId;
    private String merchantName;
    private BigDecimal availableBalance;
    private BigDecimal holdingCodBalance;
    private BigDecimal totalWithdrawn;
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountHolder;
    private LocalDateTime updatedAt;
}
