package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Thực thể Biến động Số dư Ví Shop (Wallet Transaction)
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "wallet_transactions", indexes = {
    @Index(name = "idx_wallet_tx_merchant", columnList = "merchant_id"),
    @Index(name = "idx_wallet_tx_wallet", columnList = "wallet_id"),
    @Index(name = "idx_wallet_tx_code", columnList = "transaction_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WalletTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "merchant_id", nullable = false)
    private Long merchantId;

    @Column(name = "wallet_id", nullable = false)
    private Long walletId;

    @Column(name = "transaction_code", unique = true, nullable = false, length = 40)
    private String transactionCode;

    @Column(name = "transaction_type", nullable = false, length = 30)
    private String transactionType; // "COD_PAYOUT", "FEE_DEDUCTION", "WITHDRAWAL", "DEPOSIT"

    @Column(name = "amount", precision = 14, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "balance_after", precision = 14, scale = 2, nullable = false)
    private BigDecimal balanceAfter;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "COMPLETED"; // "COMPLETED", "PENDING", "FAILED"

    @Column(name = "reference_code", length = 50)
    private String referenceCode; // Mã bảng kê hoặc mã chuyển khoản ngân hàng

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
