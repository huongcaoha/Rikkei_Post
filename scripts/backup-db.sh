#!/bin/bash
# =============================================================================
# KỊCH BẢN BACKUP DỮ LIỆU TỰ ĐỘNG - RIKKEI POST LOGISTICS
# Tác giả: Nguyễn Công Hưởng
# Chức năng:
#   1. Tạo bản sao lưu toàn vẹn CSDL PostgreSQL từ Docker container
#   2. Nén định dạng .sql.gz tối ưu dung lượng (tiết kiệm 85% dung lượng)
#   3. Tạo mã kiểm tra tính toàn vẹn SHA-256
#   4. Tự động đẩy lên Cloud Storage (Cloudflare R2 / S3 / Google Drive qua rclone)
#   5. Tự động xoay vòng xóa các bản backup cũ quá 14 ngày để chống tràn đĩa VPS
#   6. Gửi thông báo kết quả qua Telegram Webhook (tùy chọn)
# =============================================================================

set -e

# ----------------- CẤU HÌNH HỆ THỐNG -----------------
CONTAINER_NAME="rkp-postgres"
DB_NAME="rkp_logistics"
DB_USER="rkp_admin"

BACKUP_DIR="/root/rkp_project/backups/postgres"
RETENTION_DAYS=14 # Số ngày lưu trữ trên VPS

# Cấu hình rclone (nếu muốn đồng bộ lên Cloudflare R2 / S3 / Google Drive)
# Cài rclone: curl https://rclone.org/install.sh | sudo bash
RCLONE_REMOTE="r2:rikkei-post-backup" # Thay bằng remote rclone của bạn (ví dụ r2, gdrive, s3)
ENABLE_OFFSITE_BACKUP=false           # Đổi thành true khi đã cấu hình rclone

# Cấu hình thông báo Telegram (tùy chọn)
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# ----------------- KHỞI TẠO THƯ MỤC -----------------
DATE_STR=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="backup_${DB_NAME}_${DATE_STR}.sql.gz"
BACKUP_FILEPATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
LOG_FILE="${BACKUP_DIR}/backup.log"

mkdir -p "$BACKUP_DIR"

log() {
    local msg="[$(date +'%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

send_telegram() {
    local msg="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "parse_mode=HTML" \
            -d "text=${msg}" > /dev/null 2>&1 || true
    fi
}

log "=================================================================="
log "Bắt đầu tiến trình sao lưu cơ sở dữ liệu: ${DB_NAME}"

# 1. Kiểm tra container PostgreSQL có đang chạy không
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "❌ LỖI: Container ${CONTAINER_NAME} không hoạt động! Hủy tiến trình backup."
    send_telegram "❌ <b>Rikkei Post Backup FAILED</b>%0AContainer <code>${CONTAINER_NAME}</code> không hoạt động!"
    exit 1
fi

# 2. Thực hiện pg_dump và nén gzip trực tiếp
START_TIME=$(date +%s)
log "Đang trích xuất dữ liệu từ container sang ${BACKUP_FILENAME}..."

docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    | gzip -9 > "$BACKUP_FILEPATH"

FILE_SIZE=$(du -h "$BACKUP_FILEPATH" | cut -f1)
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "✅ Sao lưu thành công! Dung lượng: ${FILE_SIZE} (Thời gian thực hiện: ${DURATION}s)"

# 3. Tạo mã kiểm tra tính toàn vẹn SHA-256
sha256sum "$BACKUP_FILEPATH" > "${BACKUP_FILEPATH}.sha256"
log "Đã tạo mã xác thực SHA-256: ${BACKUP_FILEPATH}.sha256"

# 4. Đẩy bản sao lưu lên Offsite Cloud Storage (Cloudflare R2 / S3 / Google Drive)
if [ "$ENABLE_OFFSITE_BACKUP" = true ]; then
    log "Đang tải bản backup lên Cloud Storage qua rclone: ${RCLONE_REMOTE}..."
    if command -v rclone >/dev/null 2>&1; then
        rclone copy "$BACKUP_FILEPATH" "$RCLONE_REMOTE" --log-file="$LOG_FILE" --log-level NOTICE
        log "✅ Đã đồng bộ bản backup lên đám mây an toàn!"
    else
        log "⚠️ Cảnh báo: rclone chưa được cài đặt. Bỏ qua bước đồng bộ đám mây."
    fi
fi

# 5. Dọn dẹp các bản backup cũ trên VPS quá RETENTION_DAYS
log "Dọn dẹp các bản sao lưu cũ quá ${RETENTION_DAYS} ngày..."
DELETED_COUNT=0
while IFS= read -r old_file; do
    if [ -n "$old_file" ]; then
        rm -f "$old_file" "${old_file}.sha256"
        log "Đã xóa file backup cũ: $(basename "$old_file")"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done < <(find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -type f -mtime +"$RETENTION_DAYS")

log "Đã dọn dẹp ${DELETED_COUNT} bản sao lưu cũ."

# 6. Thông báo hoàn tất
MSG="✅ <b>Rikkei Post Backup Thành Công</b>%0A• Database: <code>${DB_NAME}</code>%0A• File: <code>${BACKUP_FILENAME}</code>%0A• Dung lượng: <b>${FILE_SIZE}</b>%0A• Thời gian: ${DURATION} giây"
send_telegram "$MSG"

log "Tiến trình backup hoàn thành xuất sắc!"
log "=================================================================="
