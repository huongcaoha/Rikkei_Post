package vn.rikkei.post.service.backup;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

@Slf4j
@Service
public class DatabaseDumpService {

    @Autowired
    private DataSource dataSource;

    @Value("${spring.datasource.url:jdbc:postgresql://localhost:5433/rkp_logistics}")
    private String dbUrl;

    @Value("${spring.datasource.username:rkp_admin}")
    private String dbUser;

    @Value("${spring.datasource.password:rkp_password_2026}")
    private String dbPassword;

    @Value("${backup.dir:./backups/postgres}")
    private String backupDirConfig;

    private static final DateTimeFormatter FILE_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    public File dumpDatabase() throws Exception {
        File backupDir = resolveBackupDirectory();

        String timestamp = LocalDateTime.now().format(FILE_DATE_FORMAT);
        String baseFileName = "rkp_logistics_backup_" + timestamp;
        File sqlFile = new File(backupDir, baseFileName + ".sql");
        File gzFile = new File(backupDir, baseFileName + ".sql.gz");

        if (sqlFile.getParentFile() != null && !sqlFile.getParentFile().exists()) {
            sqlFile.getParentFile().mkdirs();
        }

        boolean pgDumpSuccess = false;
        try {
            log.info("Bắt đầu thử trích xuất database bằng lệnh pg_dump...");
            pgDumpSuccess = tryPgDump(sqlFile);
        } catch (Exception e) {
            log.warn("pg_dump không khả dụng trên hệ điều hành này: {}. Tự động chuyển sang Pure JDBC Dumper...", e.getMessage());
        }

        if (!pgDumpSuccess || !sqlFile.exists() || sqlFile.length() == 0) {
            log.info("Thực thi trích xuất database toàn diện bằng Pure JDBC Dumper...");
            exportViaJdbc(sqlFile);
        }

        log.info("Đang nén file SQL ({}) sang định dạng GZIP ({})", sqlFile.getName(), gzFile.getName());
        compressToGzip(sqlFile, gzFile);

        // Xóa file thô để tiết kiệm dung lượng
        if (sqlFile.exists()) {
            sqlFile.delete();
        }

        log.info("Trích xuất và nén database hoàn tất: {} (dung lượng: {} bytes)", gzFile.getName(), gzFile.length());
        return gzFile;
    }

    public void restoreDatabase(File gzFile) throws Exception {
        File backupDir = resolveBackupDirectory();
        File tempSqlFile = new File(backupDir, "temp_restore_" + System.currentTimeMillis() + ".sql");

        try {
            log.info("Đang giải nén file backup {}...", gzFile.getName());
            decompressGzip(gzFile, tempSqlFile);

            boolean psqlSuccess = false;
            try {
                log.info("Thử khôi phục qua lệnh psql...");
                psqlSuccess = tryPsqlRestore(tempSqlFile);
            } catch (Exception e) {
                log.warn("psql không khả dụng: {}. Chuyển sang nạp qua JDBC Driver...", e.getMessage());
            }

            if (!psqlSuccess) {
                log.info("Thực thi khôi phục database qua JDBC Connection...");
                executeSqlFileViaJdbc(tempSqlFile);
            }

            log.info("Khôi phục cơ sở dữ liệu thành công từ file {}", gzFile.getName());
        } finally {
            if (tempSqlFile.exists()) {
                tempSqlFile.delete();
            }
        }
    }

    public String computeSha256(File file) {
        try (InputStream fis = new FileInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            int n;
            while ((n = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, n);
            }
            byte[] hash = digest.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            log.error("Lỗi tính mã SHA-256 cho file {}: {}", file.getName(), e.getMessage());
            return "N/A";
        }
    }

    private File resolveBackupDirectory() {
        File dir = new File(backupDirConfig);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private boolean tryPgDump(File outputFile) {
        String host = extractHost(dbUrl);
        String port = extractPort(dbUrl);
        String dbName = extractDbName(dbUrl);

        List<String> command = new ArrayList<>();
        command.add("pg_dump");
        command.add("-h"); command.add(host);
        command.add("-p"); command.add(port);
        command.add("-U"); command.add(dbUser);
        command.add("-d"); command.add(dbName);
        command.add("--clean");
        command.add("--if-exists");
        command.add("--no-owner");
        command.add("--no-privileges");
        command.add("-f"); command.add(outputFile.getAbsolutePath());

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.environment().put("PGPASSWORD", dbPassword);
        pb.redirectErrorStream(true);

        try {
            Process process = pb.start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("[pg_dump] {}", line);
                }
            }
            int exitCode = process.waitFor();
            return exitCode == 0 && outputFile.exists() && outputFile.length() > 0;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean tryPsqlRestore(File sqlFile) {
        String host = extractHost(dbUrl);
        String port = extractPort(dbUrl);
        String dbName = extractDbName(dbUrl);

        List<String> command = new ArrayList<>();
        command.add("psql");
        command.add("-h"); command.add(host);
        command.add("-p"); command.add(port);
        command.add("-U"); command.add(dbUser);
        command.add("-d"); command.add(dbName);
        command.add("-f"); command.add(sqlFile.getAbsolutePath());

        ProcessBuilder pb = new ProcessBuilder(command);
        pb.environment().put("PGPASSWORD", dbPassword);
        pb.redirectErrorStream(true);

        try {
            Process process = pb.start();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    log.debug("[psql] {}", line);
                }
            }
            int exitCode = process.waitFor();
            return exitCode == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private void exportViaJdbc(File sqlFile) throws Exception {
        try (Connection conn = dataSource.getConnection();
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(sqlFile), StandardCharsets.UTF_8))) {

            writer.write("-- ========================================================\n");
            writer.write("-- RIKKEI POST LOGISTICS - PURE JDBC DATABASE DUMP\n");
            writer.write("-- Created at: " + LocalDateTime.now() + "\n");
            writer.write("-- ========================================================\n\n");
            writer.write("SET statement_timeout = 0;\n");
            writer.write("SET client_encoding = 'UTF8';\n\n");

            DatabaseMetaData metaData = conn.getMetaData();
            List<String> tables = new ArrayList<>();
            try (ResultSet rs = metaData.getTables(null, "public", "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    String tableName = rs.getString("TABLE_NAME");
                    if (!tableName.equalsIgnoreCase("backup_history")) {
                        tables.add(tableName);
                    }
                }
            }

            for (String table : tables) {
                log.debug("Trích xuất bảng {}", table);
                exportTableData(conn, table, writer);
            }
        }
    }

    private void exportTableData(Connection conn, String table, BufferedWriter writer) throws Exception {
        writer.write("-- Table data for " + table + "\n");
        String query = "SELECT * FROM \"" + table + "\"";

        try (Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(query)) {

            ResultSetMetaData rsmd = rs.getMetaData();
            int columnCount = rsmd.getColumnCount();

            StringBuilder insertPrefix = new StringBuilder("INSERT INTO \"" + table + "\" (");
            for (int i = 1; i <= columnCount; i++) {
                insertPrefix.append("\"").append(rsmd.getColumnName(i)).append("\"");
                if (i < columnCount) insertPrefix.append(", ");
            }
            insertPrefix.append(") VALUES (");

            while (rs.next()) {
                StringBuilder rowValues = new StringBuilder(insertPrefix);
                for (int i = 1; i <= columnCount; i++) {
                    Object val = rs.getObject(i);
                    if (val == null) {
                        rowValues.append("NULL");
                    } else if (val instanceof Number || val instanceof Boolean) {
                        rowValues.append(val);
                    } else {
                        String s = val.toString().replace("'", "''");
                        rowValues.append("'").append(s).append("'");
                    }
                    if (i < columnCount) rowValues.append(", ");
                }
                rowValues.append(");\n");
                writer.write(rowValues.toString());
            }
            writer.write("\n");
        }
    }

    private void executeSqlFileViaJdbc(File sqlFile) throws Exception {
        try (Connection conn = dataSource.getConnection();
             BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(sqlFile), StandardCharsets.UTF_8));
             Statement stmt = conn.createStatement()) {

            conn.setAutoCommit(false);
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.startsWith("--") || trimmed.isEmpty()) continue;

                sb.append(line).append("\n");
                if (trimmed.endsWith(";")) {
                    try {
                        stmt.execute(sb.toString());
                    } catch (Exception e) {
                        log.warn("Lỗi thực thi dòng SQL: {} - {}", e.getMessage(), sb.toString().substring(0, Math.min(60, sb.length())));
                    }
                    sb.setLength(0);
                }
            }
            conn.commit();
        }
    }

    private void compressToGzip(File source, File target) throws IOException {
        try (FileInputStream fis = new FileInputStream(source);
             FileOutputStream fos = new FileOutputStream(target);
             GZIPOutputStream gzos = new GZIPOutputStream(fos)) {
            byte[] buffer = new byte[8192];
            int len;
            while ((len = fis.read(buffer)) > 0) {
                gzos.write(buffer, 0, len);
            }
        }
    }

    private void decompressGzip(File source, File target) throws IOException {
        try (FileInputStream fis = new FileInputStream(source);
             GZIPInputStream gzis = new GZIPInputStream(fis);
             FileOutputStream fos = new FileOutputStream(target)) {
            byte[] buffer = new byte[8192];
            int len;
            while ((len = gzis.read(buffer)) > 0) {
                fos.write(buffer, 0, len);
            }
        }
    }

    private String extractHost(String url) {
        Matcher m = Pattern.compile("jdbc:postgresql://([^:/]+)").matcher(url);
        return m.find() ? m.group(1) : "localhost";
    }

    private String extractPort(String url) {
        Matcher m = Pattern.compile("jdbc:postgresql://[^:/]+:(\\d+)").matcher(url);
        return m.find() ? m.group(1) : "5432";
    }

    private String extractDbName(String url) {
        Matcher m = Pattern.compile("jdbc:postgresql://[^/]+/([^?]+)").matcher(url);
        return m.find() ? m.group(1) : "rkp_logistics";
    }
}
