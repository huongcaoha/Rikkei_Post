package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "order_tracking_logs", indexes = {
    @Index(name = "idx_tracking_logs_code", columnList = "tracking_code, created_at"),
    @Index(name = "idx_tracking_logs_date", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderTrackingLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tracking_code", nullable = false, length = 30)
    private String trackingCode;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(name = "location_type", nullable = false, length = 30)
    private String locationType; // "POST_OFFICE", "HUB", "ON_ROAD", "CONSIGNEE_DOOR"

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "location_name", nullable = false, length = 150)
    private String locationName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "actor_id", nullable = false)
    private Long actorId;

    @Column(name = "actor_name", nullable = false, length = 100)
    private String actorName;

    @Column(name = "gps_lat")
    private Double gpsLat;

    @Column(name = "gps_lng")
    private Double gpsLng;

    @Column(name = "device_info", length = 100)
    private String deviceInfo;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
