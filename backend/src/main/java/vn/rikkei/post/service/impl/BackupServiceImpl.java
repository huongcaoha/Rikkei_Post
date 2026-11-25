package vn.rikkei.post.service.impl;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.rikkei.post.dto.backup.BackupHistoryResponse;
import vn.rikkei.post.dto.backup.BackupStatusResponse;
import vn.rikkei.post.entity.BackupHistory;
import vn.rikkei.post.repository.BackupHistoryRepository;
import vn.rikkei.post.service.BackupService;
import vn.rikkei.post.service.RedisService;
import vn.rikkei.post.service.backup.DatabaseDumpService;

import java.io.File;
import java.io.FileOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class BackupServiceImpl implements BackupService {

    private final BackupHistoryRepository backupHistoryRepository;
    private final DatabaseDumpService databaseDumpService;

    @Autowired(required = false)
    private RedisService redisService;

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${backup.cron:0 0 1 * * ?}")
    private String backupCron;

    @Value("${backup.enabled:true}")
    private boolean backupEnabled;

    @Value("${backup.email.enabled:true}")
    private boolean emailBackupEnabled;

    @Value("${backup.email.recipient:${SPRING_MAIL_USERNAME:huongcaoha1994@gmail.com}}")
    private String emailRecipient;

    @Value("${backup.retention-days:14}")
    private int retentionDays;

    @Override
    @Transactional
    public BackupHistoryResponse triggerBackup(String backupType) {
        log.info("Bắt đầu tiến trình sao lưu database (loại: {})...", backupType);

        String lockKey = "backup:lock";
        String lockValue = UUID.randomUUID().toString();
        boolean hasLock = false;

        if (redisService != null) {
            hasLock = redisService.acquireLock(lockKey, lockValue, 1800); // Khóa phân tán 30 phút
            if (!hasLock) {
                throw new IllegalStateException("Hệ thống đang có một tiến trình sao lưu database khác đang chạy. Vui lòng chờ hoàn tất!");
            }
        }

        long startTime = System.currentTimeMillis();
        BackupHistory history = BackupHistory.builder()
                .fileName("pending")
                .backupType(backupType != null ? backupType.toUpperCase() : "MANUAL")
                .status("IN_PROGRESS")
                .createdAt(LocalDateTime.now())
                .build();
        history = backupHistoryRepository.save(history);

        try {
            File backupFile = databaseDumpService.dumpDatabase();
            long duration = System.currentTimeMillis() - startTime;
            String sha256 = databaseDumpService.computeSha256(backupFile);

            history.setFileName(backupFile.getName());
            history.setFilePath(backupFile.getAbsolutePath());
            history.setFileSize(backupFile.length());
            history.setStatus("SUCCESS");
            history.setDurationMs(duration);
            history.setSha256Checksum(sha256);
            history = backupHistoryRepository.save(history);

            log.info("✅ Sao lưu thành công file {} ({} bytes, {} ms)", backupFile.getName(), backupFile.length(), duration);

            // Gửi email đính kèm bản backup tới quản trị viên (miễn phí lưu trữ 15GB an toàn trên Gmail)
            sendBackupEmailIfConfigured(backupFile, history);

            // Dọn dẹp bản backup cũ quá hạn
            rotateOldBackups();

            return mapToResponse(history);
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            history.setStatus("FAILED");
            history.setErrorMessage(e.getMessage());
            history.setDurationMs(duration);
            backupHistoryRepository.save(history);
            log.error("❌ Sao lưu database thất bại: {}", e.getMessage(), e);
            throw new RuntimeException("Tiến trình sao lưu thất bại: " + e.getMessage(), e);
        } finally {
            if (redisService != null && hasLock) {
                redisService.releaseLock(lockKey, lockValue);
            }
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<BackupHistoryResponse> getAllBackupHistory() {
        return backupHistoryRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BackupStatusResponse getBackupStatus() {
        List<BackupHistory> all = backupHistoryRepository.findAllByOrderByCreatedAtDesc();
        BackupHistory last = all.isEmpty() ? null : all.get(0);

        long totalBytes = all.stream()
                .filter(b -> "SUCCESS".equalsIgnoreCase(b.getStatus()) && b.getFileSize() != null)
                .mapToLong(BackupHistory::getFileSize)
                .sum();

        return BackupStatusResponse.builder()
                .enabled(backupEnabled)
                .cronExpression(backupCron)
                .lastBackupTime(last != null ? last.getCreatedAt() : null)
                .lastBackupStatus(last != null ? last.getStatus() : "NONE")
                .totalBackups((long) all.size())
                .totalStorageBytes(totalBytes)
                .totalStorageFormatted(formatBytes(totalBytes))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public File getBackupFileById(Long id) {
        BackupHistory history = backupHistoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bản sao lưu ID: " + id));

        File file = new File(history.getFilePath());
        if (!file.exists()) {
            throw new IllegalArgumentException("Tệp sao lưu vật lý không còn tồn tại trên máy chủ: " + history.getFileName());
        }
        return file;
    }

    @Override
    @Transactional
    public void restoreFromHistory(Long id) {
        File file = getBackupFileById(id);
        log.warn("🚨 Bắt đầu khôi phục CSDL từ bản sao lưu lịch sử #{} ({})", id, file.getName());
        try {
            databaseDumpService.restoreDatabase(file);
        } catch (Exception e) {
            log.error("❌ Lỗi khôi phục CSDL từ backup #{}: {}", id, e.getMessage(), e);
            throw new RuntimeException("Khôi phục CSDL thất bại: " + e.getMessage(), e);
        }
    }

    @Override
    @Transactional
    public void restoreFromFile(MultipartFile multipartFile) {
        if (multipartFile.isEmpty()) {
            throw new IllegalArgumentException("File tải lên trống!");
        }

        String originalName = multipartFile.getOriginalFilename();
        log.warn("🚨 Bắt đầu khôi phục CSDL từ file tải lên: {}", originalName);

        File tempFile = null;
        try {
            tempFile = File.createTempFile("restore_", originalName != null && originalName.endsWith(".gz") ? ".sql.gz" : ".sql");
            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                fos.write(multipartFile.getBytes());
            }

            databaseDumpService.restoreDatabase(tempFile);
            log.info("✅ Khôi phục thành công từ file {}", originalName);
        } catch (Exception e) {
            log.error("❌ Lỗi khôi phục CSDL từ file tải lên: {}", e.getMessage(), e);
            throw new RuntimeException("Khôi phục CSDL từ file thất bại: " + e.getMessage(), e);
        } finally {
            if (tempFile != null && tempFile.exists()) {
                tempFile.delete();
            }
        }
    }

    private void sendBackupEmailIfConfigured(File backupFile, BackupHistory history) {
        if (!emailBackupEnabled || mailSender == null || emailRecipient == null || emailRecipient.isBlank()) {
            return;
        }

        // Nếu file nhỏ hơn 24MB thì đính kèm trực tiếp (giới hạn của Gmail)
        if (backupFile.length() > 24 * 1024 * 1024) {
            log.info("Bản sao lưu lớn hơn 24MB, chỉ gửi thông báo trạng thái qua email.");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setTo(emailRecipient);
            helper.setSubject("[Rikkei Post] Bản sao lưu cơ sở dữ liệu định kỳ - " + backupFile.getName());

            String text = "<h3>Thông báo Sao lưu Cơ sở dữ liệu Tự động (Rikkei Post Logistics)</h3>"
                    + "<p>Bản sao lưu cơ sở dữ liệu đã được tạo thành công lúc: <b>"
                    + history.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")) + "</b></p>"
                    + "<ul>"
                    + "<li>Tên tệp: <code>" + history.getFileName() + "</code></li>"
                    + "<li>Dung lượng: <b>" + formatBytes(history.getFileSize()) + "</b></li>"
                    + "<li>Thời gian thực thi: " + history.getDurationMs() + " ms</li>"
                    + "<li>Mã băm toàn vẹn SHA-256: <code>" + history.getSha256Checksum() + "</code></li>"
                    + "</ul>"
                    + "<p><i>Tệp đính kèm nén .sql.gz có thể dùng để khôi phục trực tiếp qua trang quản trị hoặc lệnh restore-db.sh.</i></p>";

            helper.setText(text, true);

            if (backupFile.length() <= 24 * 1024 * 1024) {
                helper.addAttachment(backupFile.getName(), backupFile);
            }

            mailSender.send(message);
            log.info("✅ Đã gửi bản sao lưu CSDL thành công đến email: {}", emailRecipient);
        } catch (Exception e) {
            log.warn("Không thể gửi email đính kèm bản backup: {}", e.getMessage());
        }
    }

    private void rotateOldBackups() {
        try {
            LocalDateTime threshold = LocalDateTime.now().minusDays(retentionDays);
            List<BackupHistory> oldList = backupHistoryRepository.findAllByOrderByCreatedAtDesc().stream()
                    .filter(b -> b.getCreatedAt().isBefore(threshold))
                    .toList();

            for (BackupHistory old : oldList) {
                if (old.getFilePath() != null) {
                    File f = new File(old.getFilePath());
                    if (f.exists()) {
                        f.delete();
                        log.info("Đã xóa file backup cũ quá hạn: {}", old.getFileName());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Lỗi trong quá trình dọn dẹp backup cũ: {}", e.getMessage());
        }
    }

    private BackupHistoryResponse mapToResponse(BackupHistory b) {
        return BackupHistoryResponse.builder()
                .id(b.getId())
                .fileName(b.getFileName())
                .fileSize(b.getFileSize())
                .fileSizeFormatted(formatBytes(b.getFileSize()))
                .backupType(b.getBackupType())
                .status(b.getStatus())
                .errorMessage(b.getErrorMessage())
                .durationMs(b.getDurationMs())
                .sha256Checksum(b.getSha256Checksum())
                .createdAt(b.getCreatedAt())
                .build();
    }

    private String formatBytes(Long bytes) {
        if (bytes == null || bytes == 0) return "0 B";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return String.format("%.2f KB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.2f MB", bytes / (1024.0 * 1024.0));
        return String.format("%.2f GB", bytes / (1024.0 * 1024.0 * 1024.0));
    }
}
