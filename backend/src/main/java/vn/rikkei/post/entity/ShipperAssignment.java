package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "shipper_assignments", indexes = {
    @Index(name = "idx_shipper_assign_shipper", columnList = "shipper_id, status"),
    @Index(name = "idx_shipper_assign_tracking", columnList = "tracking_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShipperAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "shipper_id", nullable = false)
    private Long shipperId;

    @Column(name = "tracking_code", nullable = false, length = 30)
    private String trackingCode;

    @Column(name = "task_type", nullable = false, length = 20)
    private String taskType; // "PICKUP", "DELIVERY"

    @Column(name = "sequence_order", nullable = false)
    @Builder.Default
    private Integer sequenceOrder = 1;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "ASSIGNED"; // "ASSIGNED", "IN_PROGRESS", "SUCCESS", "FAILED"

    @Column(name = "fail_reason", length = 100)
    private String failReason;

    @Column(name = "pod_photo_url", length = 500)
    private String podPhotoUrl;

    @Column(name = "pod_signature_url", length = 500)
    private String podSignatureUrl;

    @Column(name = "pod_latitude")
    private Double podLatitude;

    @Column(name = "pod_longitude")
    private Double podLongitude;

    @Column(name = "otp_code", length = 10)
    private String otpCode;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @CreationTimestamp
    @Column(name = "assigned_at", updatable = false)
    private LocalDateTime assignedAt;
}
