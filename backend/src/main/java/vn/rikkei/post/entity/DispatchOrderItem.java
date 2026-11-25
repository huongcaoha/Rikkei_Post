package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "dispatch_order_items", indexes = {
    @Index(name = "idx_doi_order", columnList = "dispatch_order_id"),
    @Index(name = "idx_doi_bag", columnList = "master_bag_id"),
    @Index(name = "idx_doi_bag_code", columnList = "bag_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dispatch_order_id", nullable = false)
    private DispatchOrder dispatchOrder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "master_bag_id", nullable = false)
    private MasterBag masterBag;

    @Column(name = "bag_code", nullable = false, length = 40)
    private String bagCode;

    @Column(name = "seal_number", length = 50)
    private String sealNumber;

    @Column(name = "total_items", nullable = false)
    @Builder.Default
    private Integer totalItems = 0;

    @Column(name = "weight_kg", precision = 8, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal weightKg = BigDecimal.ZERO;

    @Column(name = "is_received_at_dest", nullable = false)
    @Builder.Default
    private Boolean isReceivedAtDest = false;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Column(name = "receiver_user_id")
    private Long receiverUserId;

    @Column(name = "receiver_user_name", length = 100)
    private String receiverUserName;

    @CreationTimestamp
    @Column(name = "scanned_at", updatable = false)
    private LocalDateTime scannedAt;
}
