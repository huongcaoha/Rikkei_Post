package vn.rikkei.post.service.backup;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vn.rikkei.post.service.BackupService;

@Slf4j
@Component
@RequiredArgsConstructor
public class BackupScheduler {

    private final BackupService backupService;

    @Value("${backup.enabled:true}")
    private boolean backupEnabled;

    /**
     * Tự động kích hoạt sao lưu cơ sở dữ liệu định kỳ vào lúc 01:00 AM hàng ngày
     * Cron expression: 0 0 1 * * ? (Cấu hình qua backup.cron)
     */
    @Scheduled(cron = "${backup.cron:0 0 1 * * ?}")
    public void scheduleDailyMidnightBackup() {
        if (!backupEnabled) {
            log.info("[BackupScheduler] Tính năng tự động sao lưu định kỳ đang bị tắt theo cấu hình backup.enabled=false.");
            return;
        }

        log.info("[BackupScheduler] Bắt đầu tiến trình tự động sao lưu dữ liệu CSDL hàng ngày (01:00 AM)...");
        try {
            backupService.triggerBackup("AUTOMATIC");
            log.info("[BackupScheduler] Tiến trình tự động sao lưu CSDL hoàn tất thành công.");
        } catch (Exception e) {
            log.error("[BackupScheduler] Lỗi khi chạy sao lưu tự động định kỳ: {}", e.getMessage(), e);
        }
    }
}
