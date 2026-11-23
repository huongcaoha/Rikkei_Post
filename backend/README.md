# RIKKEI_POST BACKEND SERVICES

Dự án Backend được thiết kế và triển khai bởi **Nguyễn Công Hưởng** (Solo Fullstack Lead, Microservices & AI Architect) dựa trên nền tảng **Java 21**, **Spring Boot 4.1.x / 3.3.x**, **Spring Data JPA (Code-First ORM)**, **Spring AI 2.0 GA**, **WebSocket** và **Spring Mail**.

---

## 🚀 ĐẶC ĐIỂM KỸ THUẬT NỔI BẬT

### 1. Kiến trúc Database Code-First với JPA / Hibernate
- Toàn bộ cơ sở dữ liệu được định nghĩa trực tiếp bằng các **Class Entity Java** trong package `vn.rikkei.post.entity`.
- Cấu hình `spring.jpa.hibernate.ddl-auto=update` cho phép Hibernate tự động sinh và cập nhật bảng, khóa chính, khóa ngoại, chỉ mục bên PostgreSQL khi chạy ứng dụng mà không cần viết file SQL thủ công.

### 2. Mô hình Người dùng Đa Vai trò (Many-to-Many User & Role)
- Thực thể `Role`:
  - `id` (Long, PK)
  - `roleName` (String, Unique)
  - `description` (String)
- Thực thể `User`:
  - `id` (Long, PK), `username`, `password`, `fullName`, `phoneNumber`, `email`, `isActive`
  - Quan hệ `@ManyToMany` tự động tạo ra bảng trung gian **`user_role`** gồm `user_id` và `role_id`.

### 3. Cập nhật Trạng thái Thời gian thực (WebSocket STOMP)
- Cấu hình WebSocket tại `vn.rikkei.post.config.WebSocketConfig`.
- Endpoint kết nối: `/ws-logistics`.
- Broadcast sự kiện thay đổi trạng thái bưu gửi tới `/topic/orders/{trackingCode}` và thông báo riêng cho bưu tá tại `/user/queue/notifications`.

### 4. Động cơ Gửi Email Tự động (Spring Mail)
- Tích hợp `JavaMailSender` tại `vn.rikkei.post.service.EmailService`.
- Tự động gửi email bất đồng bộ (`@Async`): Chào mừng đăng ký tài khoản, xác nhận đơn hàng thành công, thông báo giao thành công có link ảnh POD, mã OTP xác thực và bảng kê đối soát COD đính kèm file Excel.
- Tích hợp MailHog server tại cổng `localhost:1025` (Xem email tại `http://localhost:8025`).

### 5. Trí tuệ Nhân tạo với Spring AI 2.0 (Bản GA)
- Chatbot thông minh hỗ trợ khách hàng tra cứu hành trình bằng ngôn ngữ tự nhiên.
- Tích hợp Tool/Function Calling gọi trực tiếp `OrderRepository` để trả lời chính xác, chống bịa đặt (Anti-hallucination).

---

## 📂 DANH MỤC THỰC THỂ CODE-FIRST ĐÃ TẠO
- `Role.java`: Định nghĩa vai trò người dùng
- `User.java`: Người dùng hệ thống (kết nối N-N với Role qua `user_role`)
- `MerchantAddress.java`: Sổ địa chỉ kho của Shop
- `Order.java`: Bưu gửi, cước phí, định tuyến và trạng thái
- `PricingMatrix.java`: Ma trận giá cước động
- `Warehouse.java`: Bưu cục và Hub chia chọn trung chuyển
- `MasterBag.java` & `BagItem.java`: Bao tải gom hàng lớn & các kiện bên trong
- `ShipmentManifest.java`: Bảng kê chuyến xe tải liên tỉnh
- `ShipperAssignment.java`: Phân công bưu tá lấy/giao hàng và bằng chứng POD
- `OrderTrackingLog.java`: Nhật ký hành trình chi tiết (Event Sourcing)
- `MerchantWallet.java`: Ví tiền COD của chủ shop
- `ReconciliationSheet.java`: Bảng kê đối soát tài chính
