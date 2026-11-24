package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.staff.CreateStaffRequest;
import vn.rikkei.post.dto.staff.StaffUserResponse;
import vn.rikkei.post.dto.staff.UpdateStaffRequest;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.StaffManagementService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/management/staff")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
public class StaffManagementController {

    private final StaffManagementService staffService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<StaffUserResponse>>> getStaffList(
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Integer provinceId,
            @RequestParam(required = false) Long postOfficeId,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<StaffUserResponse> list = staffService.getStaffList(currentUser, role, provinceId, postOfficeId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/assignable-roles")
    public ResponseEntity<ApiResponse<List<String>>> getAssignableRoles(
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<String> roles = staffService.getAssignableRoles(currentUser);
        return ResponseEntity.ok(ApiResponse.success(roles));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<StaffUserResponse>> getStaffById(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        StaffUserResponse staff = staffService.getStaffById(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success(staff));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<StaffUserResponse>> createStaff(
            @Valid @RequestBody CreateStaffRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        StaffUserResponse staff = staffService.createStaff(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(staff, "Tạo nhân viên thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<StaffUserResponse>> updateStaff(
            @PathVariable Long id,
            @RequestBody UpdateStaffRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        StaffUserResponse staff = staffService.updateStaff(id, request, currentUser);
        return ResponseEntity.ok(ApiResponse.success(staff, "Cập nhật nhân viên thành công"));
    }

    @PutMapping("/{id}/toggle-status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<StaffUserResponse>> toggleStaffStatus(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        StaffUserResponse staff = staffService.toggleStaffStatus(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success(staff, "Đổi trạng thái nhân viên thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteStaff(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        staffService.deleteStaff(id, currentUser);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa nhân viên thành công"));
    }
}
