package vn.rikkei.post.dto.backup;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BackupHistoryResponse {
    private Long id;
    private String fileName;
    private Long fileSize;
    private String fileSizeFormatted;
    private String backupType;
    private String status;
    private String errorMessage;
    private Long durationMs;
    private String sha256Checksum;
    private LocalDateTime createdAt;
}
