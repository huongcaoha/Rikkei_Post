package vn.rikkei.post.service.impl;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vn.rikkei.post.service.EmailService;

import java.io.File;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final JavaMailSender mailSender;

    @Async
    @Override
    public void sendWelcomeEmail(String toEmail, String fullName, String username) {
        String subject = "Chào mừng bạn đến với Rikkei_Post Logistics Platform";
        String content = "<h3>Xin chào " + fullName + ",</h3>"
                + "<p>Tài khoản của bạn (" + username + ") đã được tạo thành công trên hệ thống <b>Rikkei_Post</b>.</p>"
                + "<p>Chúc bạn có những trải nghiệm tuyệt vời cùng dịch vụ chuyển phát nhanh của chúng tôi!</p>";
        sendHtmlEmail(toEmail, subject, content, null);
    }

    @Async
    @Override
    public void sendOrderCreatedEmail(String toEmail, String trackingCode, String receiverName, Double totalFee) {
        String subject = "[Rikkei_Post] Đơn hàng " + trackingCode + " đã được tạo thành công";
        String content = "<h3>Thông báo tạo đơn thành công</h3>"
                + "<p>Mã vận đơn: <b>" + trackingCode + "</b></p>"
                + "<p>Người nhận: " + receiverName + "</p>"
                + "<p>Tổng cước phí: <b>" + String.format("%,.0f VNĐ", totalFee) + "</b></p>"
                + "<p>Hệ thống đang điều phối bưu tá đến lấy hàng trong thời gian sớm nhất.</p>";
        sendHtmlEmail(toEmail, subject, content, null);
    }

    @Async
    @Override
    public void sendDeliverySuccessEmail(String toEmail, String trackingCode, String podPhotoUrl) {
        String subject = "[Rikkei_Post] Đơn hàng " + trackingCode + " đã giao thành công";
        String content = "<h3>Bưu gửi đã được giao tận tay người nhận!</h3>"
                + "<p>Mã vận đơn: <b>" + trackingCode + "</b></p>"
                + "<p>Trạng thái: <span style='color: green; font-weight: bold;'>GIAO THÀNH CÔNG (DELIVERED)</span></p>"
                + (podPhotoUrl != null ? "<p>Ảnh bằng chứng giao hàng (POD): <a href='" + podPhotoUrl + "'>Xem ảnh</a></p>" : "");
        sendHtmlEmail(toEmail, subject, content, null);
    }

    @Async
    @Override
    public void sendCodReconciliationEmail(String toEmail, String sheetCode, Double netPayout, File attachment) {
        String subject = "[Rikkei_Post] Bảng kê đối soát tiền COD kỳ: " + sheetCode;
        String content = "<h3>Bảng kê đối soát doanh thu & COD</h3>"
                + "<p>Mã bảng kê: <b>" + sheetCode + "</b></p>"
                + "<p>Số tiền thực nhận (Net Payout): <b style='color: blue; font-size: 16px;'>" + String.format("%,.0f VNĐ", netPayout) + "</b></p>"
                + "<p>Chi tiết danh sách đơn hàng được đính kèm trong file bên dưới.</p>";
        sendHtmlEmail(toEmail, subject, content, attachment);
    }

    @Async
    @Override
    public void sendOtpEmail(String toEmail, String otpCode) {
        String subject = "[Rikkei_Post] Mã xác thực OTP giao hàng";
        String content = "<h3>Mã OTP giao hàng của bạn</h3>"
                + "<p>Mã xác thực bưu gửi: <b style='color: red; font-size: 24px; letter-spacing: 4px;'>" + otpCode + "</b></p>"
                + "<p>Mã này có hiệu lực trong vòng 5 phút. Vui lòng cung cấp cho bưu tá khi nhận hàng.</p>";
        sendHtmlEmail(toEmail, subject, content, null);
    }

    @Async
    @Override
    public void sendRegistrationOtpEmail(String toEmail, String fullName, String otpCode) {
        String subject = "[Rikkei_Post] Mã OTP xác thực kích hoạt tài khoản";
        String content = "<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;'>"
                + "<div style='text-align: center; margin-bottom: 20px;'>"
                + "<h2 style='color: #dc2626; margin: 0;'>RIKKEI_POST LOGISTICS</h2>"
                + "<p style='color: #6b7280; font-size: 14px;'>Nền tảng Quản trị Vận chuyển & Chuyển phát Thông minh</p>"
                + "</div>"
                + "<hr style='border: none; border-top: 1px solid #f3f4f6; margin: 15px 0;'/>"
                + "<h3 style='color: #1f2937;'>Xin chào " + fullName + ",</h3>"
                + "<p style='color: #4b5563; line-height: 1.6;'>Cảm ơn bạn đã đăng ký tài khoản trên nền tảng <b>Rikkei_Post</b>. Để hoàn tất kích hoạt tài khoản của bạn, vui lòng nhập mã OTP xác thực dưới đây:</p>"
                + "<div style='background: #fef2f2; border: 2px dashed #dc2626; border-radius: 8px; padding: 18px; text-align: center; margin: 25px 0;'>"
                + "<span style='font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #dc2626; font-family: Courier, monospace;'>" + otpCode + "</span>"
                + "</div>"
                + "<p style='color: #ef4444; font-size: 14px; font-weight: 500;'>* Mã xác thực có hiệu lực trong vòng 60 phút. Sau 60 phút nếu tài khoản chưa được kích hoạt, hệ thống sẽ tự động xóa để bảo mật dữ liệu.</p>"
                + "<p style='color: #9ca3af; font-size: 12px; margin-top: 25px;'>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>"
                + "<hr style='border: none; border-top: 1px solid #f3f4f6; margin: 20px 0;'/>"
                + "<p style='color: #6b7280; font-size: 12px; text-align: center;'>Hotline CSKH: 1900-RIKKEI | Email: cskh@rikkeipost.vn<br/>© 2026 Rikkei Post Logistics Platform - All rights reserved.</p>"
                + "</div>";
        sendHtmlEmail(toEmail, subject, content, null);
    }

    private void sendHtmlEmail(String toEmail, String subject, String htmlContent, File attachment) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom("no-reply@rikkeipost.vn");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            if (attachment != null && attachment.exists()) {
                helper.addAttachment(attachment.getName(), attachment);
            }

            mailSender.send(message);
            log.info("Email đã gửi thành công tới: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Lỗi khi gửi email tới {}: {}", toEmail, e.getMessage());
        }
    }
}
