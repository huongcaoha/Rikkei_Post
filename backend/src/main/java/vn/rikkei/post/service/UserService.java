package vn.rikkei.post.service;

import vn.rikkei.post.dto.auth.AuthResponse;
import vn.rikkei.post.dto.user.ChangePasswordRequest;
import vn.rikkei.post.dto.user.UpdateProfileRequest;

public interface UserService {
    AuthResponse getProfile(Long userId);
    AuthResponse updateProfile(Long userId, UpdateProfileRequest request);
    void changePassword(Long userId, ChangePasswordRequest request);
}
