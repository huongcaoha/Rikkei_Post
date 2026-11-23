package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "merchant_wallets", indexes = {
    @Index(name = "idx_merchant_wallets_merchant", columnList = "merchant_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MerchantWallet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "merchant_id", unique = true, nullable = false)
    private Long merchantId;

    @Column(name = "available_balance", precision = 14, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal availableBalance = BigDecimal.ZERO;

    @Column(name = "holding_cod_balance", precision = 14, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal holdingCodBalance = BigDecimal.ZERO;

    @Column(name = "total_withdrawn", precision = 14, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalWithdrawn = BigDecimal.ZERO;

    @Column(name = "bank_name", nullable = false, length = 100)
    private String bankName;

    @Column(name = "bank_account_number", nullable = false, length = 50)
    private String bankAccountNumber;

    @Column(name = "bank_account_holder", nullable = false, length = 100)
    private String bankAccountHolder;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
