package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.auth.AuthResponse;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.user.ChangePasswordRequest;
import vn.rikkei.post.dto.user.UpdateProfileRequest;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.UserService;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<AuthResponse>> getProfile(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            throw new AccessDeniedException("Vui lòng đăng nhập để xem thông tin cá nhân!");
        }
        AuthResponse response = userService.getProfile(userDetails.getId());
        return ResponseEntity.ok(ApiResponse.success(response, "Lấy thông tin cá nhân thành công"));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<AuthResponse>> updateProfile(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody UpdateProfileRequest request) {
        if (userDetails == null) {
            throw new AccessDeniedException("Vui lòng đăng nhập để cập nhật thông tin!");
        }
        AuthResponse response = userService.updateProfile(userDetails.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(response, "Cập nhật hồ sơ cá nhân thành công!"));
    }

    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ChangePasswordRequest request) {
        if (userDetails == null) {
            throw new AccessDeniedException("Vui lòng đăng nhập để đổi mật khẩu!");
        }
        userService.changePassword(userDetails.getId(), request);
        return ResponseEntity.ok(ApiResponse.success(null, "Đổi mật khẩu thành công!"));
    }
}
