# CHIẾN LƯỢC SAO LƯU & PHỤC HỒI THẢM HỌA DỮ LIỆU (BACKUP & DISASTER RECOVERY)
**Hệ thống Quản lý Vận tải & Bưu chính Thông minh Rikkei Post**

---

## 1. Mục tiêu Khôi phục (RPO & RTO)

| Chỉ số | Mục tiêu | Giải pháp áp dụng |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | < 1 giờ | Sao lưu CSDL hàng đêm + WAL Log streaming hoặc snapshot |
| **RTO (Recovery Time Objective)** | < 15 phút | Script khôi phục tự động 1 lệnh `restore-db.sh` |
| **Chi phí hạ tầng** | **0 VNĐ / tháng** | Tận dụng Cloudflare R2 (Free tier 10GB, 0đ phí tải ra) & Rclone |

---

## 2. So sánh các Phương án Sao lưu Tối ưu

### Phương án 1: Automated Daily Logical Backup (`pg_dump` + `rclone` R2) ⭐ *(KHUYẾN NGHỊ TRIỂN KHAI NGAY)*
- **Cơ chế**:
  - Mỗi ngày vào lúc **01:00 AM** (giờ thấp điểm), script `scripts/backup-db.sh` tự động dump toàn bộ CSDL PostgreSQL qua `docker exec`.
  - Nén mức cao nhất `gzip -9` (giúp giảm dung lượng từ 500MB xuống ~50MB).
  - Tạo mã kiểm tra toàn vẹn SHA-256.
  - Tự động đẩy file nén lên **Cloudflare R2** hoặc **Google Drive** bằng `rclone`.
  - Giữ lại 14 ngày gần nhất trên VPS và tự động xóa các bản cũ hơn.
- **Ưu điểm**:
  - Cực kỳ đơn giản, tin cậy 100%, độc lập với phiên bản PostgreSQL.
  - File `.sql.gz` có thể mang sang bất kỳ máy chủ nào khác để dựng lại hệ thống trong vài phút.
  - Chi phí hoàn toàn miễn phí.

### Phương án 2: Continuous Archiving & Point-In-Time-Recovery (PITR với WAL-G / pgBackRest)
- **Cơ chế**:
  - Ghi streaming từng transaction log (WAL) liên tục lên Cloud Object Storage trong vòng 1-5 giây.
- **Ưu điểm**:
  - **Zero Data Loss**: Khi xảy ra sự cố (ví dụ admin lỡ xóa nhầm dữ liệu lúc 14:32:15), hệ thống có thể tua ngược thời gian về đúng 14:32:14.
- **Nhược điểm**:
  - Cần cấu hình postgresql.conf (`archive_mode = on`, `archive_command`). Thích hợp nâng cấp khi lượng đơn đạt hàng trăm nghìn đơn/ngày.

### Phương án 3: Sao lưu Dữ liệu Tệp Đa phương tiện POD (MinIO / Cloudflare R2)
- **Cơ chế**:
  - Ảnh bằng chứng giao hàng (POD), chữ ký điện tử khách hàng được lưu trữ tại Cloudflare R2 hoặc MinIO Volume.
  - Đồng bộ định kỳ thư mục `/var/lib/docker/volumes/rkp_minio_data` lên cloud storage.

---

## 3. Hướng dẫn Triển khai Sao lưu Tự động trên VPS

### Bước 1: Phân quyền thực thi cho các script
Tại thư mục dự án trên VPS:
```bash
chmod +x scripts/backup-db.sh scripts/restore-db.sh scripts/install-cron-backup.sh
```

### Bước 2: Thiết lập Cron Job tự động chạy lúc 01:00 AM hàng ngày
Chạy script cài đặt tự động:
```bash
./scripts/install-cron-backup.sh
```
Kiểm tra lại cron job:
```bash
crontab -l
# Kết quả hiển thị:
# 0 1 * * * /root/rkp_project/scripts/backup-db.sh >/dev/null 2>&1
```

### Bước 3: Cấu hình đồng bộ lên Cloudflare R2 qua Rclone (Miễn phí 100%)
1. Cài đặt rclone trên VPS:
   ```bash
   curl https://rclone.org/install.sh | sudo bash
   ```
2. Cấu hình rclone kết nối Cloudflare R2:
   ```bash
   rclone config
   # Chọn New remote -> đặt tên: r2
   # Chọn loại lưu trữ: s3 (Amazon S3 Compliant)
   # Chọn provider: Cloudflare
   # Nhập access_key_id và secret_access_key từ Cloudflare R2 dashboard
   # Nhập endpoint: https://<account_id>.r2.cloudflarestorage.com
   ```
3. Kích hoạt trong `scripts/backup-db.sh`:
   - Đổi `ENABLE_OFFSITE_BACKUP=true`
   - Đổi `RCLONE_REMOTE="r2:rikkei-post-backup"`

---

## 4. Quy trình Phục hồi Dữ liệu khi gặp Sự cố (Disaster Recovery Runbook)

Khi cần khôi phục lại dữ liệu CSDL:

1. **Xem danh sách các bản backup có sẵn**:
   ```bash
   ./scripts/restore-db.sh
   ```
2. **Khôi phục bản backup mong muốn**:
   ```bash
   ./scripts/restore-db.sh /root/rkp_project/backups/postgres/backup_rkp_logistics_20261125_010000.sql.gz
   ```
3. Hệ thống sẽ:
   - Tự động kiểm tra mã hash SHA-256 xác thực file không bị lỗi/sửa đổi.
   - Yêu cầu người quản trị gõ `CONFIRM` để xác nhận.
   - Bơm toàn bộ dữ liệu trở lại PostgreSQL container `rkp-postgres`.
