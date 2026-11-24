package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Chi tiết từng đơn hàng trong một Bảng kê Đối soát COD
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "reconciliation_items", indexes = {
    @Index(name = "idx_recon_item_sheet", columnList = "sheet_id"),
    @Index(name = "idx_recon_item_tracking", columnList = "tracking_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReconciliationItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sheet_id", nullable = false)
    private Long sheetId;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "tracking_code", nullable = false, length = 30)
    private String trackingCode;

    @Column(name = "receiver_name", length = 100)
    private String receiverName;

    @Column(name = "cod_amount", precision = 14, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal codAmount = BigDecimal.ZERO;

    @Column(name = "shipping_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(name = "insurance_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal insuranceFee = BigDecimal.ZERO;

    @Column(name = "net_amount", precision = 14, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal netAmount = BigDecimal.ZERO;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
