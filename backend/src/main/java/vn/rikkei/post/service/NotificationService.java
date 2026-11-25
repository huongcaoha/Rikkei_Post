package vn.rikkei.post.service;

import vn.rikkei.post.dto.notification.NotificationResponse;

import java.util.List;

public interface NotificationService {
    NotificationResponse createNotification(Long userId, String title, String content, String type, String linkUrl);
    void notifyUsersByRole(String roleName, String title, String content, String type, String linkUrl);
    List<NotificationResponse> getMyNotifications(Long userId);
    long getUnreadCount(Long userId);
    void markAsRead(Long notificationId, Long userId);
    void markAllAsRead(Long userId);
}
