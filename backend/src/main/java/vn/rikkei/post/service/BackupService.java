package vn.rikkei.post.service;

import org.springframework.web.multipart.MultipartFile;
import vn.rikkei.post.dto.backup.BackupHistoryResponse;
import vn.rikkei.post.dto.backup.BackupStatusResponse;

import java.io.File;
import java.util.List;

public interface BackupService {

    BackupHistoryResponse triggerBackup(String backupType);

    List<BackupHistoryResponse> getAllBackupHistory();

    BackupStatusResponse getBackupStatus();

    File getBackupFileById(Long id);

    void restoreFromHistory(Long id);

    void restoreFromFile(MultipartFile file);
}
