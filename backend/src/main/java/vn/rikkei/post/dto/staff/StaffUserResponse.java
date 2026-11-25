package vn.rikkei.post.dto.staff;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StaffUserResponse {
    private Long id;
    private String username;
    private String fullName;
    private String phoneNumber;
    private String email;
    private List<String> roles;
    private Integer managedProvinceId;
    private String managedProvinceName;
    private Long assignedPostOfficeId;
    private String postOfficeName;
    private Boolean isActive;
    private Boolean isFaceEnrolled;
    private String facePhotoUrl;
    private LocalDateTime createdAt;
}
