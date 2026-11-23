package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.UserRepository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service lập lịch dọn dẹp các tài khoản đăng ký chưa xác thực OTP qua email.
 * Chạy tự động mỗi 60 phút để xóa các tài khoản có is_active = false và created_at > 60 phút.
 * Tác giả: Nguyễn Công Hưởng
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserCleanupService {

    private final UserRepository userRepository;

    /**
     * Lập lịch định kỳ mỗi 60 phút (3600000 ms) hoặc vào đầu mỗi giờ.
     * Quét tất cả tài khoản có is_active = false, kiểm tra xem đã quá 60 phút tính từ created_at chưa,
     * nếu quá 60 phút thì xóa khỏi database để tránh rác dữ liệu.
     */
    @Scheduled(cron = "0 0 * * * *") // Chạy mỗi 60 phút (vào phút thứ 0 của mỗi giờ)
    @Transactional
    public void cleanupUnverifiedUsers() {
        log.info("[UserCleanupService] Bắt đầu quét kiểm tra danh sách tài khoản chưa kích hoạt...");
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(60);

        List<User> expiredUsers = userRepository.findByIsActiveFalseAndCreatedAtBefore(threshold);

        if (expiredUsers != null && !expiredUsers.isEmpty()) {
            log.warn("[UserCleanupService] Phát hiện {} tài khoản chưa kích hoạt OTP quá 60 phút. Tiến hành xóa dọn dẹp...", expiredUsers.size());
            for (User user : expiredUsers) {
                log.info("[UserCleanupService] Đang xóa tài khoản rác: ID={}, Username={}, Email={}, Ngày tạo={}",
                        user.getId(), user.getUsername(), user.getEmail(), user.getCreatedAt());
            }
            userRepository.deleteAll(expiredUsers);
            log.info("[UserCleanupService] Đã dọn dẹp thành công {} tài khoản rác khỏi hệ thống.", expiredUsers.size());
        } else {
            log.info("[UserCleanupService] Không có tài khoản chưa kích hoạt nào quá hạn 60 phút.");
        }
    }
}
