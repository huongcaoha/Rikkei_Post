# RIKKEI_POST FRONTEND APPLICATION

Ứng dụng Frontend được xây dựng bằng **ReactJS 18+**, **TypeScript**, **Tailwind CSS** và **Ant Design (AntD)**.

## 📱 CÁC PHÂN HỆ GIAO DIỆN
1. **Customer Portal (Cổng thông tin khách hàng / Chủ Shop)**:
   - Dashboard báo cáo trực quan, thống kê tỷ lệ giao thành công.
   - Form tạo đơn hàng đơn lẻ & Tạo đơn hàng loạt từ file Excel.
   - In tem nhãn nhiệt mã vạch Barcode Code 128 / QR Code chuẩn A6/A7.
   - Tra cứu hành trình bưu gửi tích hợp bản đồ Google Maps và cập nhật trạng thái thời gian thực qua WebSocket.
   - Quản lý ví tiền COD và lịch sử đối soát, yêu cầu rút tiền.

2. **WMS Hub Desktop (Giao diện Khai thác Kho tốc độ cao)**:
   - Tối ưu cho súng bắn mã vạch, tự động chuyển trường, âm thanh báo hiệu thành công/lỗi.
   - Đóng bao tải Master Bag, niêm phong kẹp chì seal.
   - Lập bảng kê xuất xe tải liên tỉnh.

3. **Shipper Mobile Web (Giao diện Di động cho Bưu tá)**:
   - Giao diện thân thiện cảm ứng di động (Mobile-First).
   - Danh sách đơn cần lấy, cần phát, gọi điện trực tiếp một chạm.
   - Chụp ảnh xác thực POD có Watermark GPS, ký tên điện tử, xác thực mã OTP.
   - Tạo mã VietQR động thu tiền COD không dùng tiền mặt.

4. **Trợ lý AI CSKH (Smart AI Chat Widget)**:
   - Widget trò chuyện thông minh với trợ lý AI hỗ trợ tra cứu hành trình tự nhiên.

## 🛠️ CÔNG NGHỆ CHÍNH
- **Core**: React 18, TypeScript, Vite
- **UI Components**: Ant Design (v5), Tailwind CSS, Lucide Icons
- **Bản đồ**: @react-google-maps/api
- **Real-time**: @stomp/stompjs, sockjs-client
- **In ấn & Mã vạch**: jsbarcode, qrcode.react, react-to-print
