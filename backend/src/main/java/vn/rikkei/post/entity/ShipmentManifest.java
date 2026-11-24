package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "shipment_manifests", indexes = {
    @Index(name = "idx_manifest_code", columnList = "manifest_code"),
    @Index(name = "idx_manifest_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShipmentManifest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "manifest_code", unique = true, nullable = false, length = 30)
    private String manifestCode;

    @Column(name = "trip_code", nullable = false, length = 30)
    private String tripCode;

    @Column(name = "vehicle_plate", nullable = false, length = 20)
    private String vehiclePlate;

    @Column(name = "driver_name", nullable = false, length = 100)
    private String driverName;

    @Column(name = "driver_phone", nullable = false, length = 15)
    private String driverPhone;

    @Column(name = "origin_hub_id", nullable = false)
    private Long originHubId;

    @Column(name = "origin_hub_name")
    private String originHubName;

    @Column(name = "dest_hub_id", nullable = false)
    private Long destHubId;

    @Column(name = "dest_hub_name")
    private String destHubName;

    @Column(name = "truck_seal_number", nullable = false, length = 50)
    private String truckSealNumber;

    @Column(name = "departure_scheduled_at", nullable = false)
    private LocalDateTime departureScheduledAt;

    @Column(name = "departure_actual_at")
    private LocalDateTime departureActualAt;

    @Column(name = "arrival_estimated_at", nullable = false)
    private LocalDateTime arrivalEstimatedAt;

    @Column(name = "arrival_actual_at")
    private LocalDateTime arrivalActualAt;

    @Column(name = "total_bags", nullable = false)
    @Builder.Default
    private Integer totalBags = 0;

    @Column(name = "total_packages", nullable = false)
    @Builder.Default
    private Integer totalPackages = 0;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "SCHEDULED"; // "SCHEDULED", "LOADING", "DISPATCHED", "ARRIVED", "COMPLETED"

    @Column(name = "notes")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
