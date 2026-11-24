package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Thực thể Chuyến xe vận chuyển của Đối tác Vận tải (Carrier Trip)
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "carrier_trips", indexes = {
    @Index(name = "idx_carrier_trip_code", columnList = "trip_code"),
    @Index(name = "idx_carrier_trip_carrier", columnList = "carrier_id"),
    @Index(name = "idx_carrier_trip_manifest", columnList = "manifest_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CarrierTrip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trip_code", unique = true, nullable = false, length = 40)
    private String tripCode;

    @Column(name = "carrier_id", nullable = false)
    private Long carrierId;

    @Column(name = "carrier_name", length = 150)
    private String carrierName;

    @Column(name = "manifest_code", length = 40)
    private String manifestCode;

    @Column(name = "source_hub_id", nullable = false)
    private Long sourceHubId;

    @Column(name = "source_hub_name", length = 100)
    private String sourceHubName;

    @Column(name = "destination_hub_id", nullable = false)
    private Long destinationHubId;

    @Column(name = "destination_hub_name", length = 100)
    private String destinationHubName;

    @Column(name = "driver_name", length = 100)
    private String driverName;

    @Column(name = "driver_phone", length = 20)
    private String driverPhone;

    @Column(name = "license_plate", length = 30)
    private String licensePlate;

    @Column(name = "distance_km")
    private Double distanceKm;

    @Column(name = "trip_cost", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal tripCost = BigDecimal.ZERO;

    @Column(name = "departure_time")
    private LocalDateTime departureTime;

    @Column(name = "estimated_arrival_time")
    private LocalDateTime estimatedArrivalTime;

    @Column(name = "actual_arrival_time")
    private LocalDateTime actualArrivalTime;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "SCHEDULED"; // "SCHEDULED", "IN_TRANSIT", "COMPLETED_ON_TIME", "DELAYED"

    @Column(name = "sla_compliant")
    @Builder.Default
    private Boolean slaCompliant = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
