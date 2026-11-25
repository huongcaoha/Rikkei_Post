package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_vouchers", indexes = {
    @Index(name = "idx_voucher_code", columnList = "voucher_code"),
    @Index(name = "idx_voucher_warehouse", columnList = "warehouse_id"),
    @Index(name = "idx_voucher_status", columnList = "status"),
    @Index(name = "idx_voucher_type", columnList = "voucher_type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentVoucher {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "voucher_code", unique = true, nullable = false, length = 40)
    private String voucherCode; // e.g. "PT-202611-0001", "PC-202611-0001"

    @Column(name = "voucher_type", nullable = false, length = 20)
    private String voucherType; // "RECEIPT" (Thu), "PAYMENT" (Chi)

    @Column(name = "category", nullable = false, length = 50)
    private String category; // "OPERATING_EXPENSE", "OFFICE_SUPPLIES", "VEHICLE_MAINTENANCE", "FUEL_ALLOWANCE", "RENTAL", "SALARY_ADVANCE", "COD_SETTLEMENT", "OTHER"

    @Column(name = "amount", precision = 14, scale = 2, nullable = false)
    private BigDecimal amount;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "proof_attachment_url", columnDefinition = "TEXT")
    private String proofAttachmentUrl;

    @Column(name = "created_by_user_id", nullable = false)
    private Long createdByUserId;

    @Column(name = "created_by_user_name", length = 100)
    private String createdByUserName;

    @Column(name = "created_by_user_role", length = 50)
    private String createdByUserRole;

    @Column(name = "warehouse_id")
    private Long warehouseId;

    @Column(name = "warehouse_name", length = 150)
    private String warehouseName;

    @Column(name = "province_id")
    private Integer provinceId;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "PENDING"; // "PENDING", "APPROVED", "REJECTED"

    @Column(name = "approved_by_user_id")
    private Long approvedByUserId;

    @Column(name = "approved_by_user_name", length = 100)
    private String approvedByUserName;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    @Column(name = "disbursement_method", length = 30)
    @Builder.Default
    private String disbursementMethod = "INTERNAL_WALLET"; // "INTERNAL_WALLET", "BANK_TRANSFER", "CASH"

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
