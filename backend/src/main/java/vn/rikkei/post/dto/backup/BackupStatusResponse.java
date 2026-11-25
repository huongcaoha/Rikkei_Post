package vn.rikkei.post.dto.backup;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BackupStatusResponse {
    private boolean enabled;
    private String cronExpression;
    private LocalDateTime lastBackupTime;
    private String lastBackupStatus;
    private Long totalBackups;
    private Long totalStorageBytes;
    private String totalStorageFormatted;
}
