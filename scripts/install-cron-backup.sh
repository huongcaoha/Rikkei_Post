#!/bin/bash
# =============================================================================
# KỊCH BẢN THIẾT LẬP CRON JOB TỰ ĐỘNG SAO LƯU HÀNG ĐÊM TRÊN VPS
# Chạy lúc 01:00 AM mỗi ngày (giờ thấp điểm của hệ thống)
# =============================================================================

set -e

BACKUP_SCRIPT="/root/rkp_project/scripts/backup-db.sh"

if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo "❌ Không tìm thấy script tại $BACKUP_SCRIPT"
    echo "Vui lòng đặt file backup-db.sh vào thư mục /root/rkp_project/scripts/ trước."
    exit 1
fi

chmod +x "$BACKUP_SCRIPT"

# Kiểm tra xem cron job đã tồn tại chưa
CRON_JOB="0 1 * * * $BACKUP_SCRIPT >/dev/null 2>&1"

(crontab -l 2>/dev/null | grep -F "$BACKUP_SCRIPT") && {
    echo "✅ Cron job backup đã được cài đặt trước đó:"
    crontab -l | grep -F "$BACKUP_SCRIPT"
    exit 0
}

# Thêm vào crontab
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Đã thiết lập Cron Job tự động sao lưu dữ liệu mỗi đêm lúc 01:00 AM thành công!"
echo "Lịch chạy:"
crontab -l | grep -F "$BACKUP_SCRIPT"
