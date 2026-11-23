package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "master_bags", indexes = {
    @Index(name = "idx_master_bags_code", columnList = "bag_code"),
    @Index(name = "idx_master_bags_seal", columnList = "seal_number"),
    @Index(name = "idx_master_bags_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterBag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "bag_code", unique = true, nullable = false, length = 30)
    private String bagCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origin_warehouse_id", nullable = false)
    private Warehouse originWarehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dest_warehouse_id", nullable = false)
    private Warehouse destWarehouse;

    @Column(name = "seal_number", unique = true, nullable = false, length = 50)
    private String sealNumber;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "OPEN"; // "OPEN", "SEALED", "MANIFESTED", "DISPATCHED", "RECEIVED", "UNSEALED"

    @Column(name = "total_items", nullable = false)
    @Builder.Default
    private Integer totalItems = 0;

    @Column(name = "total_weight_kg", precision = 8, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalWeightKg = BigDecimal.ZERO;

    @Column(name = "sealed_by_user_id", nullable = false)
    private Long sealedByUserId;

    @Column(name = "sealed_at")
    private LocalDateTime sealedAt;

    @OneToMany(mappedBy = "masterBag", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BagItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
