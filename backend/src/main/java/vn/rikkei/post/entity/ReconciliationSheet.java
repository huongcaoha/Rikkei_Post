package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "reconciliation_sheets", indexes = {
    @Index(name = "idx_reconcile_sheet_code", columnList = "sheet_code"),
    @Index(name = "idx_reconcile_merchant_status", columnList = "merchant_id, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReconciliationSheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sheet_code", unique = true, nullable = false, length = 30)
    private String sheetCode;

    @Column(name = "merchant_id", nullable = false)
    private Long merchantId;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "total_orders", nullable = false)
    private Integer totalOrders;

    @Column(name = "total_cod", precision = 14, scale = 2, nullable = false)
    private BigDecimal totalCod;

    @Column(name = "total_shipping_fee", precision = 14, scale = 2, nullable = false)
    private BigDecimal totalShippingFee;

    @Column(name = "total_insurance_fee", precision = 14, scale = 2, nullable = false)
    private BigDecimal totalInsuranceFee;

    @Column(name = "net_payout", precision = 14, scale = 2, nullable = false)
    private BigDecimal netPayout;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING"; // "PENDING", "APPROVED", "TRANSFERRED", "REJECTED"

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "bank_transaction_code", length = 100)
    private String bankTransactionCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
