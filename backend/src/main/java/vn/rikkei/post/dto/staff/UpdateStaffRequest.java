package vn.rikkei.post.dto.staff;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateStaffRequest {
    private String fullName;
    private String phoneNumber;
    private String email;
    private List<String> roles;
    private Integer managedProvinceId;
    private Long assignedPostOfficeId;
    private Boolean isActive;
    private String newPassword;
}
