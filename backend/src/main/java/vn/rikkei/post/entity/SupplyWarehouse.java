package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Thực thể Kho Vật Tư, Trang Thiết Bị của công ty
 * Thông tin: id, code, name, address, googleMapsUrl, managerId, managerName
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "supply_warehouses", indexes = {
    @Index(name = "idx_sw_code", columnList = "code"),
    @Index(name = "idx_sw_manager", columnList = "manager_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupplyWarehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "code", unique = true, nullable = false, length = 50)
    private String code; // e.g. "KVT_HN_01", "KVT_HCM_01"

    @Column(name = "name", nullable = false, length = 150)
    private String name; // e.g. "Kho Vật Tư & Thiết Bị Tổng Miền Bắc"

    @Column(name = "address", nullable = false, columnDefinition = "TEXT")
    private String address;

    @Column(name = "google_maps_url", columnDefinition = "TEXT")
    private String googleMapsUrl; // Link vị trí Google Maps

    @Column(name = "latitude")
    private Double latitude;

    @Column(name = "longitude")
    private Double longitude;

    @Column(name = "manager_id")
    private Long managerId; // ID người quản lý kho

    @Column(name = "manager_name", length = 100)
    private String managerName; // Tên người quản lý kho

    @Column(name = "manager_phone", length = 20)
    private String managerPhone;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, MAINTENANCE, CLOSED

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
