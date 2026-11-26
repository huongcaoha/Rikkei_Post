package vn.rikkei.post.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Thực thể Tồn kho Vật tư / Trang thiết bị theo từng Kho Vật Tư
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "supply_inventories", indexes = {
    @Index(name = "idx_sinv_wh", columnList = "warehouse_id"),
    @Index(name = "idx_sinv_item", columnList = "item_id")
}, uniqueConstraints = {
    @UniqueConstraint(name = "uk_wh_item", columnNames = {"warehouse_id", "item_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SupplyInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private SupplyWarehouse warehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private SupplyItem item;

    /**
     * Số lượng tồn kho thực tế hiện có trong kho sẵn sàng cấp phát
     */
    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 0;

    /**
     * Số lượng thiết bị hỏng/lỗi đang lưu giữ tại kho chờ thanh lý hoặc bảo hành
     */
    @Column(name = "damaged_quantity", nullable = false)
    @Builder.Default
    private Integer damagedQuantity = 0;

    @Column(name = "last_restocked_at")
    private LocalDateTime lastRestockedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
