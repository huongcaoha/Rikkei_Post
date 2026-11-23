package vn.rikkei.post.dto.staff;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

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

    @NotEmpty(message = "Phải chọn ít nhất một vai trò (Role)")
    private List<String> roles;

    private Integer managedProvinceId; // Dành cho ROLE_BRANCH_MANAGER
    private Long assignedPostOfficeId; // Dành cho ROLE_POST_OFFICE_MANAGER, ROLE_SHIPPER, ROLE_WAREHOUSE_STAFF
}
