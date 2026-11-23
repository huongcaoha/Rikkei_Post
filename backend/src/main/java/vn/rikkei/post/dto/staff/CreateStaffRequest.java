package vn.rikkei.post.dto.staff;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateStaffRequest {

    @NotBlank(message = "Tên đăng nhập không được để trống")
    private String username;

    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;

    @NotBlank(message = "Họ tên không được để trống")
    private String fullName;

    @NotBlank(message = "Số điện thoại không được để trống")
    private String phoneNumber;

    @Email(message = "Email không hợp lệ")
    @NotBlank(message = "Email không được để trống")
    private String email;

    // Hỗ trợ cả roles (danh sách) hoặc role (chuỗi đơn lẻ)
    private List<String> roles;
    private String role;

    private Integer managedProvinceId; // Dành cho ROLE_BRANCH_MANAGER
    private Long assignedPostOfficeId; // Dành cho ROLE_POST_OFFICE_MANAGER, ROLE_SHIPPER, ROLE_WAREHOUSE_STAFF

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

    @AssertTrue(message = "Phải chọn ít nhất một vai trò (Role)")
    public boolean isValidRole() {
        return (roles != null && !roles.isEmpty()) || (role != null && !role.isBlank());
    }
}
