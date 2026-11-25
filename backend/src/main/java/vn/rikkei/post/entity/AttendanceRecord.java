package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_records", indexes = {
    @Index(name = "idx_att_user_date", columnList = "user_id, work_date"),
    @Index(name = "idx_att_warehouse_date", columnList = "warehouse_id, work_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "employee_name", length = 100)
    private String employeeName;

    @Column(name = "role_name", length = 50)
    private String roleName;

    @Column(name = "warehouse_id", nullable = false)
    private Long warehouseId;

    @Column(name = "warehouse_name", length = 150)
    private String warehouseName;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "check_in_time")
    private LocalDateTime checkInTime;

    @Column(name = "check_out_time")
    private LocalDateTime checkOutTime;

    @Column(name = "check_in_photo_url", columnDefinition = "TEXT")
    private String checkInPhotoUrl;

    @Column(name = "check_out_photo_url", columnDefinition = "TEXT")
    private String checkOutPhotoUrl;

    @Column(name = "check_in_lat")
    private Double checkInLat;

    @Column(name = "check_in_lng")
    private Double checkInLng;

    @Column(name = "check_out_lat")
    private Double checkOutLat;

    @Column(name = "check_out_lng")
    private Double checkOutLng;

    @Column(name = "distance_from_warehouse_km")
    private Double distanceFromWarehouseKm;

    @Column(name = "is_location_valid")
    @Builder.Default
    private Boolean isLocationValid = false;

    @Column(name = "is_face_matched")
    @Builder.Default
    private Boolean isFaceMatched = false;

    @Column(name = "face_match_confidence")
    private Double faceMatchConfidence;

    @Column(name = "work_hours")
    @Builder.Default
    private Double workHours = 0.0;

    @Column(name = "status", length = 30, nullable = false)
    @Builder.Default
    private String status = "CHECKED_IN"; // "CHECKED_IN", "COMPLETED", "LATE", "EARLY_LEAVE", "INVALID_LOCATION", "INVALID_FACE"

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
