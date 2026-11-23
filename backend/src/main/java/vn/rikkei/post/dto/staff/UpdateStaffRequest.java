package vn.rikkei.post.dto.staff;

import lombok.*;

import java.util.ArrayList;
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
    private String role;
    private Integer managedProvinceId;
    private Long assignedPostOfficeId;
    private Boolean isActive;
    private String newPassword;
    private String password;

    public List<String> getRoles() {
        if (roles == null) {
            roles = new ArrayList<>();
        }
        if (roles.isEmpty() && role != null && !role.isBlank()) {
            roles.add(role.trim());
        }
        return roles;
    }

    public void setRole(String role) {
        this.role = role;
        if (role != null && !role.isBlank()) {
            if (this.roles == null) {
                this.roles = new ArrayList<>();
            }
            if (!this.roles.contains(role.trim())) {
                this.roles.add(role.trim());
            }
        }
    }

    public String getEffectivePassword() {
        if (newPassword != null && !newPassword.isBlank()) {
            return newPassword;
        }
        return password;
    }
}
