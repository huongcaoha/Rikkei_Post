package vn.rikkei.post.service;

import java.io.File;

/**
 * Service gửi Email tự động trong hệ sinh thái Rikkei_Post
 * Tác giả: Nguyễn Công Hưởng
 */
public interface EmailService {

    void sendWelcomeEmail(String toEmail, String fullName, String username);

    void sendOrderCreatedEmail(String toEmail, String trackingCode, String receiverName, Double totalFee);

    void sendDeliverySuccessEmail(String toEmail, String trackingCode, String podPhotoUrl);

    void sendCodReconciliationEmail(String toEmail, String sheetCode, Double netPayout, File attachment);

    void sendOtpEmail(String toEmail, String otpCode);

    void sendRegistrationOtpEmail(String toEmail, String fullName, String otpCode);
}
