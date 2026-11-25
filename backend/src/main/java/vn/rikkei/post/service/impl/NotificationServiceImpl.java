package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.notification.NotificationResponse;
import vn.rikkei.post.entity.Notification;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.NotificationRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.service.NotificationService;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final WebSocketNotificationService webSocketNotificationService;

    @Override
    @Transactional
    public NotificationResponse createNotification(Long userId, String title, String content, String type, String linkUrl) {
        Notification notif = Notification.builder()
                .userId(userId)
                .title(title)
                .content(content)
                .type(type != null ? type : "SYSTEM")
                .linkUrl(linkUrl)
                .isRead(false)
                .build();
        Notification saved = notificationRepository.save(notif);

        NotificationResponse res = mapToResponse(saved);
        try {
            webSocketNotificationService.notifyGeneric("/topic/notifications/" + userId, res);
        } catch (Exception e) {
            log.warn("Không thể gửi thông báo WebSocket tới user #{}: {}", userId, e.getMessage());
        }
        return res;
    }

    @Override
    @Transactional
    public void notifyUsersByRole(String roleName, String title, String content, String type, String linkUrl) {
        List<User> targetUsers = userRepository.findAll().stream()
                .filter(u -> u.getRoles().stream().anyMatch(r -> r.getRoleName().equalsIgnoreCase(roleName)))
                .toList();

        for (User user : targetUsers) {
            try {
                createNotification(user.getId(), title, content, type, linkUrl);
            } catch (Exception e) {
                log.warn("Lỗi gửi thông báo cho user #{}: {}", user.getId(), e.getMessage());
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationResponse> getMyNotifications(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long getUnreadCount(Long userId) {
        return notificationRepository.countByUserIdAndIsReadFalse(userId);
    }

    @Override
    @Transactional
    public void markAsRead(Long notificationId, Long userId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            if (n.getUserId().equals(userId)) {
                n.setIsRead(true);
                notificationRepository.save(n);
            }
        });
    }

    @Override
    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);
        for (Notification n : unread) {
            n.setIsRead(true);
        }
        notificationRepository.saveAll(unread);
    }

    private NotificationResponse mapToResponse(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .userId(n.getUserId())
                .title(n.getTitle())
                .content(n.getContent())
                .type(n.getType())
                .isRead(n.getIsRead())
                .linkUrl(n.getLinkUrl())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
