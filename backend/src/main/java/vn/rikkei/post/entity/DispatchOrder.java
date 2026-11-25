package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "dispatch_orders", indexes = {
    @Index(name = "idx_dispatch_code", columnList = "dispatch_code"),
    @Index(name = "idx_dispatch_status", columnList = "status"),
    @Index(name = "idx_dispatch_origin", columnList = "origin_warehouse_id"),
    @Index(name = "idx_dispatch_dest", columnList = "dest_warehouse_id"),
    @Index(name = "idx_dispatch_driver", columnList = "driver_id"),
    @Index(name = "idx_dispatch_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dispatch_code", unique = true, nullable = false, length = 40)
    private String dispatchCode; // VD: DO261125-1001

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origin_warehouse_id", nullable = false)
    private Warehouse originWarehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dest_warehouse_id", nullable = false)
    private Warehouse destWarehouse;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "driver_id", nullable = false)
    private User driver;

    @Column(name = "driver_name", nullable = false, length = 100)
    private String driverName;

    @Column(name = "driver_phone", length = 30)
    private String driverPhone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "truck_id")
    private Truck truck;

    @Column(name = "truck_plate", length = 30)
    private String truckPlate;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "PICKED_UP"; // PICKED_UP, IN_TRANSIT, COMPLETED, CANCELLED

    @Column(name = "total_bags", nullable = false)
    @Builder.Default
    private Integer totalBags = 0;

    @Column(name = "total_weight_kg", precision = 10, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalWeightKg = BigDecimal.ZERO;

    @Column(name = "total_items", nullable = false)
    @Builder.Default
    private Integer totalItems = 0;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "departure_time")
    private LocalDateTime departureTime;

    @Column(name = "completed_time")
    private LocalDateTime completedTime;

    @Column(name = "created_user_id")
    private Long createdUserId;

    @Column(name = "created_user_name", length = 100)
    private String createdUserName;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "dispatchOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DispatchOrderItem> items = new ArrayList<>();
}
