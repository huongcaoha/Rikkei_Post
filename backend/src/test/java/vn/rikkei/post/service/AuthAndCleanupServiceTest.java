package vn.rikkei.post.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.service.impl.UserCleanupService;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthAndCleanupServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserCleanupService userCleanupService;

    private User expiredUser;

    @BeforeEach
    void setUp() {
        expiredUser = User.builder()
                .id(999L)
                .username("unverified_junk_user")
                .email("junk@test.com")
                .isActive(false)
                .otp("123456")
                .createdAt(LocalDateTime.now().minusMinutes(75))
                .build();
    }

    @Test
    @DisplayName("Kiểm tra UserCleanupService tự động tìm và xóa tài khoản chưa kích hoạt quá 60 phút")
    void testCleanupUnverifiedUsers() {
        when(userRepository.findByIsActiveFalseAndCreatedAtBefore(any(LocalDateTime.class)))
                .thenReturn(List.of(expiredUser));

        userCleanupService.cleanupUnverifiedUsers();

        verify(userRepository, times(1)).findByIsActiveFalseAndCreatedAtBefore(any(LocalDateTime.class));
        verify(userRepository, times(1)).deleteAll(List.of(expiredUser));
    }

    @Test
    @DisplayName("Kiểm tra UserCleanupService không xóa khi không có tài khoản quá hạn 60 phút")
    void testCleanupWhenNoExpiredUsers() {
        when(userRepository.findByIsActiveFalseAndCreatedAtBefore(any(LocalDateTime.class)))
                .thenReturn(List.of());

        userCleanupService.cleanupUnverifiedUsers();

        verify(userRepository, times(1)).findByIsActiveFalseAndCreatedAtBefore(any(LocalDateTime.class));
        verify(userRepository, never()).deleteAll(any());
    }
}
