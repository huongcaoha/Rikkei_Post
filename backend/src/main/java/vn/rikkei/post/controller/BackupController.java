package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.rikkei.post.dto.backup.BackupHistoryResponse;
import vn.rikkei.post.dto.backup.BackupStatusResponse;
import vn.rikkei.post.service.BackupService;

import java.io.File;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/backup")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class BackupController {

    private final BackupService backupService;

    @PostMapping("/trigger")
    public ResponseEntity<BackupHistoryResponse> triggerManualBackup() {
        BackupHistoryResponse response = backupService.triggerBackup("MANUAL");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    public ResponseEntity<List<BackupHistoryResponse>> getBackupHistory() {
        return ResponseEntity.ok(backupService.getAllBackupHistory());
    }

    @GetMapping("/status")
    public ResponseEntity<BackupStatusResponse> getBackupStatus() {
        return ResponseEntity.ok(backupService.getBackupStatus());
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<Resource> downloadBackupFile(@PathVariable Long id) {
        File file = backupService.getBackupFileById(id);
        Resource resource = new FileSystemResource(file);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getName() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(file.length())
                .body(resource);
    }

    @PostMapping("/restore/history/{id}")
    public ResponseEntity<Map<String, String>> restoreFromHistory(@PathVariable Long id) {
        backupService.restoreFromHistory(id);
        return ResponseEntity.ok(Map.of("message", "Khôi phục dữ liệu từ bản sao lưu #" + id + " thành công!"));
    }

    @PostMapping("/restore/upload")
    public ResponseEntity<Map<String, String>> restoreFromUpload(@RequestParam("file") MultipartFile file) {
        backupService.restoreFromFile(file);
        return ResponseEntity.ok(Map.of("message", "Khôi phục dữ liệu từ file " + file.getOriginalFilename() + " thành công!"));
    }
}
