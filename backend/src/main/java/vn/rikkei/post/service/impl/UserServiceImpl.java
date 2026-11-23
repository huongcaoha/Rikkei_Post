package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.auth.AuthResponse;
import vn.rikkei.post.dto.user.ChangePasswordRequest;
import vn.rikkei.post.dto.user.UpdateProfileRequest;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.service.UserService;

import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public AuthResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản!"));
        return mapToAuthResponse(user);
    }

    @Override
    @Transactional
    public AuthResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản!"));

        String cleanPhone = request.getPhoneNumber().trim();
        String cleanEmail = request.getEmail().trim().toLowerCase();
        String cleanFullName = request.getFullName().trim();

        // Kiểm tra trùng số điện thoại với tài khoản khác
        if (!cleanPhone.equalsIgnoreCase(user.getPhoneNumber())) {
            userRepository.findByPhoneNumber(cleanPhone).ifPresent(other -> {
                if (!other.getId().equals(user.getId())) {
                    throw new IllegalArgumentException("Số điện thoại [" + cleanPhone + "] đã được sử dụng bởi tài khoản khác!");
                }
            });
            user.setPhoneNumber(cleanPhone);
        }

        // Kiểm tra trùng email với tài khoản khác
        if (!cleanEmail.equalsIgnoreCase(user.getEmail())) {
            userRepository.findByEmail(cleanEmail).ifPresent(other -> {
                if (!other.getId().equals(user.getId())) {
                    throw new IllegalArgumentException("Email [" + cleanEmail + "] đã được sử dụng bởi tài khoản khác!");
                }
            });
            user.setEmail(cleanEmail);
        }

        user.setFullName(cleanFullName);
        if (request.getAvatarUrl() != null && !request.getAvatarUrl().isBlank()) {
            user.setAvatarUrl(request.getAvatarUrl().trim());
        }

        User saved = userRepository.save(user);
        log.info("Người dùng [{}] đã cập nhật hồ sơ cá nhân thành công", user.getUsername());
        return mapToAuthResponse(saved);
    }

    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin tài khoản!"));

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new IllegalArgumentException("Mật khẩu mới và xác nhận mật khẩu không khớp!");
        }

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Mật khẩu hiện tại không chính xác! Vui lòng kiểm tra lại.");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Mật khẩu mới không được trùng với mật khẩu hiện tại!");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        log.info("Người dùng [{}] đã đổi mật khẩu thành công", user.getUsername());
    }

    private AuthResponse mapToAuthResponse(User user) {
        Set<String> roles = user.getRoles() != null
                ? user.getRoles().stream().map(Role::getRoleName).collect(Collectors.toSet())
                : Set.of();

        return AuthResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .managedProvinceId(user.getManagedProvinceId())
                .managedProvinceName(user.getManagedProvinceName())
                .assignedPostOfficeId(user.getAssignedPostOfficeId())
                .postOfficeName(user.getPostOfficeName())
                .roles(roles)
                .build();
    }
}
