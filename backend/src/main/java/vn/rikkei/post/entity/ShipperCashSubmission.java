package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "shipper_cash_submissions", indexes = {
        @Index(name = "idx_csub_shipper_id", columnList = "shipper_id"),
        @Index(name = "idx_csub_code", columnList = "submission_code", unique = true),
        @Index(name = "idx_csub_payos_code", columnList = "payos_order_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShipperCashSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "submission_code", nullable = false, unique = true, length = 50)
    private String submissionCode;

    @Column(name = "shipper_id", nullable = false)
    private Long shipperId;

    @Column(name = "shipper_name")
    private String shipperName;

    @Column(name = "shipper_phone", length = 20)
    private String shipperPhone;

    @Column(name = "post_office_id")
    private Long postOfficeId;

    @Column(name = "shift_date", nullable = false)
    private LocalDate shiftDate;

    @Column(name = "total_orders")
    private Integer totalOrders;

    @Column(name = "total_cod_amount", precision = 12, scale = 2)
    private BigDecimal totalCodAmount;

    @Column(name = "total_fee_amount", precision = 12, scale = 2)
    private BigDecimal totalFeeAmount;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "amount_paid", precision = 12, scale = 2)
    private BigDecimal amountPaid;

    /**
     * Phương thức nộp: "PAYOS" (VietQR chuyển khoản online) hoặc "CASH" (Nộp tiền mặt tại bưu cục)
     */
    @Column(name = "payment_method", nullable = false, length = 20)
    private String paymentMethod;

    /**
     * Trạng thái nộp: "PENDING", "COMPLETED", "CANCELLED", "REJECTED"
     */
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    // --- Thông tin tích hợp PayOS ---
    @Column(name = "payos_order_code")
    private Long payosOrderCode;

    @Column(name = "payos_payment_link_id", length = 100)
    private String payosPaymentLinkId;

    @Column(name = "checkout_url", length = 500)
    private String checkoutUrl;

    @Column(name = "qr_code", length = 500)
    private String qrCode;

    // --- Phê duyệt / Xác nhận nộp tiền mặt ---
    @Column(name = "approved_by")
    private Long approvedBy;

    @Column(name = "approved_by_name")
    private String approvedByName;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @Column(name = "notes", length = 500)
    private String notes;

    @Column(name = "order_codes_json", columnDefinition = "TEXT")
    private String orderCodesJson;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
