package vn.rikkei.post.dto.attendance;

import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceResponse {
    private Long id;
    private Long userId;
    private String employeeName;
    private String roleName;
    private Long warehouseId;
    private String warehouseName;
    private LocalDate workDate;
    private LocalDateTime checkInTime;
    private LocalDateTime checkOutTime;
    private String checkInPhotoUrl;
    private String checkOutPhotoUrl;
    private Double checkInLat;
    private Double checkInLng;
    private Double checkOutLat;
    private Double checkOutLng;
    private Double distanceFromWarehouseKm;
    private Boolean isLocationValid;
    private Boolean isFaceMatched;
    private Double faceMatchConfidence;
    private Double workHours;
    private String status;
    private String notes;
    private LocalDateTime createdAt;
}
