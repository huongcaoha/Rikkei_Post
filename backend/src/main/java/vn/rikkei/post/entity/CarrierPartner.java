package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Thực thể Đối tác Vận tải (3PL Carrier Partner)
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "carrier_partners", indexes = {
    @Index(name = "idx_carrier_code", columnList = "partner_code"),
    @Index(name = "idx_carrier_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CarrierPartner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "partner_code", unique = true, nullable = false, length = 30)
    private String partnerCode; // e.g. "3PL-BACNAM-01"

    @Column(name = "company_name", nullable = false, length = 150)
    private String companyName;

    @Column(name = "contact_person", length = 100)
    private String contactPerson;

    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "vehicle_fleet_count", nullable = false)
    @Builder.Default
    private Integer vehicleFleetCount = 5; // Số lượng đầu xe

    @Column(name = "routes_operated", length = 300)
    private String routesOperated; // e.g. "Hà Nội - Đà Nẵng - TP. Hồ Chí Minh"

    @Column(name = "contract_price_per_km", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal contractPricePerKm = new BigDecimal("12000.00");

    @Column(name = "on_time_delivery_rate")
    @Builder.Default
    private Double onTimeDeliveryRate = 98.0; // SLA On-time delivery %

    @Column(name = "sla_score")
    @Builder.Default
    private Double slaScore = 4.8; // Đánh giá sao (tối đa 5.0)

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE"; // "ACTIVE", "PAUSED", "TERMINATED"

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
