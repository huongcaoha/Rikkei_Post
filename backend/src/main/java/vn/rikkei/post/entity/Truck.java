package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Thực thể Đội xe ô tô tải (Truck Fleet) phục vụ vận chuyển trung chuyển đường trục và liên bưu cục/Hub.
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "trucks", indexes = {
    @Index(name = "idx_trucks_plate", columnList = "license_plate"),
    @Index(name = "idx_trucks_warehouse", columnList = "current_warehouse_id"),
    @Index(name = "idx_trucks_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Truck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Loại xe tải (vd: "Xe tải 1.25 tấn", "Xe tải 2.5 tấn", "Xe tải 5 tấn", "Container 40 feet")
     */
    @Column(name = "truck_type", nullable = false, length = 100)
    private String truckType;

    /**
     * Tải trọng tối đa tính theo kg (vd: 2500 kg)
     */
    @Column(name = "payload_kg", nullable = false)
    private Double payloadKg;

    /**
     * Biển số xe (vd: "29C-888.99")
     */
    @Column(name = "license_plate", unique = true, nullable = false, length = 30)
    private String licensePlate;

    /**
     * Thuộc kho trung chuyển (HUB) / Bưu cục nào
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_warehouse_id", nullable = false)
    private Warehouse currentWarehouse;

    /**
     * Trạng thái xe tải:
     * - AT_WAREHOUSE: Đang ở kho
     * - IN_TRANSIT: Đang đi trung chuyển đơn hàng
     * - MAINTENANCE: Đang bảo dưỡng
     */
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "AT_WAREHOUSE";

    /**
     * Tài xế xe tải đang được gán phụ trách xe (nếu có)
     */
    @Column(name = "current_driver_id")
    private Long currentDriverId;

    @Column(name = "current_driver_name", length = 100)
    private String currentDriverName;

    @Column(name = "current_driver_phone", length = 20)
    private String currentDriverPhone;

    @Column(name = "notes")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
