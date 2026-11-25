package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "backup_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BackupHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String fileName;

    @Column(length = 500)
    private String filePath;

    private Long fileSize;

    @Column(length = 50)
    private String backupType; // SCHEDULED, MANUAL

    @Column(nullable = false, length = 50)
    private String status; // SUCCESS, FAILED, IN_PROGRESS

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    private Long durationMs;

    @Column(length = 100)
    private String sha256Checksum;

    @Column(nullable = false)
    private LocalDateTime createdAt;
}
