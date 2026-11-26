package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.repository.RoleRepository;
import vn.rikkei.post.repository.UserRepository;

import java.util.List;

@RestController
@RequestMapping("/api/v1/roles")
@RequiredArgsConstructor
public class RoleController {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateRoleRequest {
        @NotBlank(message = "Mã vai trò không được để trống")
        private String roleName; // e.g. "ROLE_INVENTORY_MANAGER", "ROLE_SECURITY"

        @NotBlank(message = "Mô tả vai trò không được để trống")
        private String description;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UpdateRoleRequest {
        @NotBlank(message = "Mô tả vai trò không được để trống")
        private String description;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Role>>> getAllRoles() {
        List<Role> roles = roleRepository.findAll();
        return ResponseEntity.ok(ApiResponse.success(roles));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Role>> createRole(@Valid @RequestBody CreateRoleRequest request) {
        String cleanRoleName = request.getRoleName().trim().toUpperCase();
        if (!cleanRoleName.startsWith("ROLE_")) {
            cleanRoleName = "ROLE_" + cleanRoleName;
        }

        if (roleRepository.existsByRoleName(cleanRoleName)) {
            throw new IllegalArgumentException("Vai trò [" + cleanRoleName + "] đã tồn tại trong hệ thống!");
        }

        Role role = Role.builder()
                .roleName(cleanRoleName)
                .description(request.getDescription().trim())
                .build();

        Role saved = roleRepository.save(role);
        return ResponseEntity.ok(ApiResponse.success(saved, "Thêm vai trò mới thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Role>> updateRole(
            @PathVariable Long id,
            @Valid @RequestBody UpdateRoleRequest request
    ) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy vai trò ID: " + id));

        role.setDescription(request.getDescription().trim());
        Role saved = roleRepository.save(role);
        return ResponseEntity.ok(ApiResponse.success(saved, "Cập nhật vai trò thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteRole(@PathVariable Long id) {
        Role role = roleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy vai trò ID: " + id));

        if (List.of("ROLE_ADMIN", "ROLE_SHIPPER", "ROLE_MERCHANT").contains(role.getRoleName())) {
            throw new IllegalArgumentException("Không thể xóa các vai trò hệ thống mặc định!");
        }

        // Kiểm tra xem có user nào đang giữ role này không
        boolean isInUse = userRepository.findAll().stream()
                .anyMatch(u -> u.getRoles().stream().anyMatch(r -> r.getId().equals(id)));
        if (isInUse) {
            throw new IllegalStateException("Vai trò [" + role.getRoleName() + "] đang được phân công cho nhân viên, không thể xóa!");
        }

        roleRepository.delete(role);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa vai trò thành công"));
    }
}
