#!/bin/bash
# =============================================================================
# KỊCH BẢN PHỤC HỒI DỮ LIỆU AN TOÀN - RIKKEI POST LOGISTICS
# Tác giả: Nguyễn Công Hưởng
# Chức năng:
#   1. Kiểm tra tính toàn vẹn file backup bằng mã SHA-256
#   2. Cảnh báo và yêu cầu xác nhận trước khi ghi đè CSDL
#   3. Phục hồi toàn vẹn cấu trúc và dữ liệu vào PostgreSQL Docker
# =============================================================================

set -e

CONTAINER_NAME="rkp-postgres"
DB_NAME="rkp_logistics"
DB_USER="rkp_admin"
BACKUP_DIR="/root/rkp_project/backups/postgres"

echo "=================================================================="
echo "    CÔNG CỤ PHỤC HỒI CƠ SỞ DỮ LIỆU - RIKKEI POST LOGISTICS"
echo "=================================================================="

# 1. Kiểm tra tham số file phục hồi
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Danh sách các bản sao lưu có sẵn trong ${BACKUP_DIR}:"
    ls -lht "${BACKUP_DIR}"/backup_*.sql.gz 2>/dev/null || echo "Không có bản backup nào!"
    echo ""
    echo "Cách sử dụng:"
    echo "  ./restore-db.sh <đường_dẫn_tới_file_backup.sql.gz>"
    echo "Ví dụ:"
    echo "  ./restore-db.sh ${BACKUP_DIR}/backup_rkp_logistics_20261125_010000.sql.gz"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ LỖI: Tệp $BACKUP_FILE không tồn tại!"
    exit 1
fi

# 2. Kiểm tra tính toàn vẹn mã SHA-256 nếu có file checksum đi kèm
SHA_FILE="${BACKUP_FILE}.sha256"
if [ -f "$SHA_FILE" ]; then
    echo "Đang kiểm tra tính toàn vẹn file backup..."
    if sha256sum -c "$SHA_FILE"; then
        echo "✅ Mã xác thực SHA-256 hoàn toàn hợp lệ! Tệp không bị lỗi hay sửa đổi."
    else
        echo "❌ CẢNH BÁO NGUY HIỂM: Tệp sao lưu bị lỗi dữ liệu hoặc sai lệch mã SHA-256!"
        read -p "Bạn có muốn tiếp tục bất chấp rủi ro? (yes/NO): " FORCE_RESTORE
        if [ "$FORCE_RESTORE" != "yes" ]; then
            echo "Đã hủy tiến trình phục hồi."
            exit 1
        fi
    fi
fi

# 3. Cảnh báo ghi đè CSDL
echo ""
echo "⚠️  CẢNH BÁO QUAN TRỌNG:"
echo "Thao tác này sẽ XÓA và GHI ĐÈ toàn bộ cơ sở dữ liệu [${DB_NAME}] hiện tại"
echo "trên container [${CONTAINER_NAME}] bằng dữ liệu từ:"
echo "-> $BACKUP_FILE"
echo ""
read -p "Bạn có chắc chắn 100% muốn phục hồi CSDL? Gõ 'CONFIRM' để thực hiện: " CONFIRMATION

if [ "$CONFIRMATION" != "CONFIRM" ]; then
    echo "Đã hủy bỏ thao tác phục hồi dữ liệu."
    exit 0
fi

# 4. Thực hiện phục hồi
echo "==> Đang giải nén và nạp dữ liệu vào cơ sở dữ liệu ${DB_NAME}..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo ""
echo "=================================================================="
echo "✅ PHỤC HỒI CƠ SỞ DỮ LIỆU THÀNH CÔNG!"
echo "Thời gian hoàn tất: $(date +'%Y-%m-%d %H:%M:%S')"
echo "=================================================================="
