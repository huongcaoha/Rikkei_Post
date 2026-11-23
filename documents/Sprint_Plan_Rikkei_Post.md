# KẾ HOẠCH TRIỂN KHAI DỰ ÁN 4 SPRINTS (SOLO DEVELOPER ROADMAP)
## HỆ THỐNG QUẢN LÝ BƯU CHÍNH & CHUYỂN PHÁT NHANH RIKKEI_POST

---

| **Thuộc tính** | **Nội dung** |
| :--- | :--- |
| **Dự án** | **Rikkei_Post** - Smart Express Logistics Platform |
| **Mô hình triển khai** | **Solo Fullstack Developer** - **Nguyễn Công Hưởng** đảm nhiệm 100% các phân hệ |
| **Công nghệ nền tảng** | **Java 21**, **Spring Boot 4.1.x**, **Spring AI 2.0**, **Spring Data JPA (Code-First ORM)**, **WebSocket**, **Spring Mail**, **ReactJS**, **Tailwind CSS**, **AntD** |
| **Thời lượng chu kỳ** | 4 Sprints (2 tuần/sprint – Tổng cộng 8 tuần / 2 tháng triển khai MVP) |
| **Tổng số User Stories** | 25 Stories (Tổng 175 Story Points) |
| **Mục tiêu dự án** | Xây dựng sản phẩm mẫu (MVP) hoàn chỉnh, tự động sinh CSDL qua Code-First, cập nhật trạng thái thời gian thực qua WebSocket, gửi email thông báo và sẵn sàng chạy trên Docker container. |

---

## 1. PHÂN BỔ TRỌNG TÂM 4 SPRINTS (SOLO DEVELOPER VELOCITY)

Vì dự án do một mình **Nguyễn Công Hưởng** phát triển trọn gói từ Backend, Database, AI đến Frontend và DevOps, mỗi sprint được thiết kế cân bằng giữa việc xây dựng API Backend, Entity Code-First và giao diện Frontend ReactJS tương ứng:

```
[Sprint 1: Nền tảng, Code-First & Đơn hàng] (42 SP)
  ├── Backend: Khởi tạo Docker, Base Config, Code-First User-Role Many-to-Many, Order Entity, Dynamic Pricing
  └── Frontend: Layout Customer Portal, Form tạo đơn lẻ/lô, In tem nhãn nhiệt mã vạch Code 128 / QR Code

[Sprint 2: Kho WMS, WebSocket & Tracking] (40 SP)
  ├── Backend: WMS Entity & Quét Inbound/Outbound, Đóng bao Master Bag, Kafka & WebSocket real-time config
  └── Frontend: WMS Hub Desktop (tối ưu súng bắn barcode), Màn hình đóng bao, Bản đồ Google Maps Tracking

[Sprint 3: Vận tải TMS, Bưu tá & POD] (45 SP)
  ├── Backend: TMS Entity, Điều phối lấy hàng, Bằng chứng giao hàng POD (MinIO), Xác thực OTP, Thu COD
  └── Frontend: Shipper Mobile Web (chỉ đường Google Maps, chụp ảnh có Watermark GPS, tạo mã VietQR thu COD)

[Sprint 4: Đối soát COD, Spring AI & Email] (48 SP)
  ├── Backend: Billing Entity & Đối soát ví Shop, Spring AI 2.0 (LLM Chatbot & VRP Solver), Spring Mail tự động
  └── Frontend: Dashboard Đối soát COD, Giao diện quản lý đối tác, Widget Chatbot AI, Kiểm thử E2E & Docker
```

---

## 2. BẢNG CHI TIẾT 25 USER STORIES (ĐẢM NHIỆM BỞI NGUYỄN CÔNG HƯỞNG)

| Mã Story | Tên User Story | Trọng tâm Phân hệ | Story Points | Chi tiết công việc cần làm |
| :---: | :--- | :---: | :---: | :--- |
| **US-01** | Khởi tạo Hạ tầng Docker & Base Project | DevOps & Infra | **8 SP** | Cấu hình `docker-compose.yml` (Postgres, Redis, Kafka, Zookeeper, MinIO, MailHog), tạo Base Spring Boot 4.1.x Java 21 và ReactJS Vite. |
| **US-02** | Mô hình Code-First User & Role (Many-to-Many) | Auth & Security | **8 SP** | Tạo class `Role` (id, roleName, description), class `User`, cấu hình `@ManyToMany` sinh bảng `user_role`, cấu hình Spring Security & JWT. |
| **US-03** | Động cơ Định giá Cước động (Dynamic Pricing) | Order Service | **8 SP** | Entity `PricingMatrix`, thuật toán so sánh khối lượng thực vs khối lượng thể tích $(D \times R \times C) / 6000$, Redis cache ma trận cước. |
| **US-04** | Giao diện Khung ứng dụng & Dashboard Cổng khách hàng | Frontend Portal | **5 SP** | Xây dựng Layout ReactJS, Tailwind CSS, Ant Design (Sidebar, Navbar, Theme, Thẻ thống kê số lượng đơn hàng). |
| **US-05** | Form Tạo đơn hàng lẻ & Tạo đơn lô từ Excel | Order Module | **8 SP** | Tạo form 2 cột tính cước real-time, tích hợp địa chỉ hành chính 3 cấp, module đọc file Excel nhiều đơn hàng. |
| **US-06** | Sinh mã vận đơn & In tem nhãn nhiệt mã vạch | Utility Module | **5 SP** | Thuật toán sinh mã `RKP...`, render mã vạch Code 128 và QR Code, thiết kế template in nhiệt khổ A6/A7. |
| **US-07** | Phân hệ Quét mã Nhập kho tốc độ cao (Inbound) | WMS Service | **8 SP** | Giao diện tối ưu súng quét mã vạch (Auto-focus, Enter trigger, âm thanh beep), API tiếp nhận quét $< 80ms$. |
| **US-08** | Cơ chế Tính Routing Code & Phân loại cửa xuất | WMS Hub | **5 SP** | Tự động sinh Routing Code dựa trên Tỉnh/Huyện/Xã nhận, gán số hiệu cửa Chute/Gate cho nhân viên chia chọn. |
| **US-09** | Quy trình Đóng bao tải Master Bag & Kẹp chì Seal | WMS Hub | **8 SP** | Entity `MasterBag` và `BagItem`, giao diện gom kiện vào bao, niêm phong mã Seal chì và in nhãn dán bao tải. |
| **US-10** | Quản lý Xuất kho & Bảng kê chuyến xe tải | TMS Linehaul | **8 SP** | Entity `ShipmentManifest`, quét bao xuất kho lên xe liên tỉnh, phát hiện cảnh báo chênh lệch kiện hàng. |
| **US-11** | Cấu hình WebSocket STOMP Real-time & Tracking Service | Real-time & Event | **5 SP** | Cấu hình `WebSocketConfig`, Kafka Consumer lắng nghe `tracking-events`, bắn cập nhật real-time tới `/topic/orders/{code}`. |
| **US-12** | Màn hình Tra cứu hành trình tích hợp Google Maps | Tracking Portal | **6 SP** | Trang tra cứu công khai, Timeline trạng thái bưu gửi, bản đồ Google Maps vẽ sơ đồ luân chuyển qua các Hub. |
| **US-13** | Thuật toán Tự động Điều phối lấy hàng (Smart Dispatch) | TMS Service | **8 SP** | Tự động quét bưu tá hoạt động trong khu vực địa bàn (Geofence) và gán đơn lấy hàng theo tải trọng xe. |
| **US-14** | Giao diện Di động Web Responsive cho Bưu tá | Shipper Mobile | **8 SP** | Giao diện Mobile-first chia 3 tab [Cần lấy] - [Đang giao] - [Đã xong], 1-chạm gọi điện, 1-chạm mở Google Maps chỉ đường. |
| **US-15** | Bằng chứng Giao hàng POD (Watermark GPS + Ký tên) | Last-Mile Delivery | **8 SP** | Chụp ảnh hiện trường, đóng dấu Watermark (Tọa độ GPS + Dấu thời gian + Mã bưu gửi), upload MinIO, khung ký tên cảm ứng. |
| **US-16** | Xác thực Giao hàng bằng mã OTP với Đơn giá trị cao | Security Delivery | **5 SP** | Tự động sinh OTP 6 số gửi tin nhắn cho người nhận với đơn > 2 triệu VNĐ; bưu tá nhập đúng mã mới hoàn tất đơn. |
| **US-17** | Quản lý Thu hộ COD & Tạo mã VietQR động | Payment & Delivery | **8 SP** | Tạo mã VietQR động chứa đúng số tiền COD và mã bưu gửi để khách quét chuyển khoản, quản lý tiền mặt nộp cuối ca. |
| **US-18** | Xử lý Ngoại lệ Giao không thành công & Phát lại | Exception Delivery | **8 SP** | Báo cáo lý do giao thất bại kèm ảnh chứng minh, tự động lên lịch phát lại (tối đa 3 lần) hoặc kích hoạt quy trình Hàng hoàn. |
| **US-19** | Hệ thống Đối soát Tự động COD & Quản lý Ví Shop | Billing Service | **8 SP** | Entity `MerchantWallet`, tự động cấn trừ cước vận chuyển/bảo hiểm vào tiền COD thu hộ, sinh bảng kê đối soát PDF/Excel. |
| **US-20** | Quản lý Đối tác Vận tải & Đánh giá Hiệu suất SLA | Carrier Module | **5 SP** | Quản lý danh sách nhà xe thuê ngoài (3PL, xe tải), theo dõi tỷ lệ giao đúng giờ (OTP), tính cước thanh toán nhà xe. |
| **US-21** | Thuật toán Phân cụm & Tối ưu Tuyến đường (VRP Solver) | AI & Optimization | **8 SP** | Phân cụm đơn hàng theo địa lý, giải bài toán TSP/VRP sắp xếp thứ tự điểm dừng tối ưu giúp tiết kiệm 20-30% quãng đường. |
| **US-22** | Trợ lý AI CSKH Tra cứu Thông minh (Spring AI 2.0) | Spring AI Module | **8 SP** | Tích hợp Spring AI 2.0 (LLM) và Tool Calling; khách chat tự nhiên hỏi tiến độ bưu gửi, AI tự gọi API tra cứu và trả lời. |
| **US-23** | Mô hình AI Dự báo Thời gian Giao hàng (Predictive ETA) | Spring AI Module | **5 SP** | Dự báo thời gian giao hàng chính xác dựa trên lịch sử chuyển phát và điều kiện thời tiết, hiển thị trên tem nhãn. |
| **US-24** | Động cơ Gửi Email Tự động với Spring Mail | Email Notification | **6 SP** | Tích hợp `JavaMailSender`, gửi email kích hoạt tài khoản, email xác nhận đơn hàng, email bảng kê đối soát COD (MailHog). |
| **US-25** | Kiểm thử E2E Toàn diện & Đóng gói Docker Compose | DevOps & Testing | **8 SP** | Chạy kịch bản xuyên suốt từ tạo đơn $\rightarrow$ kho $\rightarrow$ xe tải $\rightarrow$ bưu tá $\rightarrow$ đối soát ví; đóng gói Docker toàn dự án. |

---

## 3. TIÊU CHUẨN HOÀN THÀNH (DEFINITION OF DONE - DOD)
Mỗi User Story được coi là hoàn thành khi:
1. **Mã nguồn**: Viết chuẩn Clean Code trên **Java 21**, không có cảnh báo nghiêm trọng từ SonarLint.
2. **Code-First ORM**: Entity Java khởi chạy tạo bảng, quan hệ Many-to-Many (`user_role`), khóa chính, khóa ngoại thành công trên PostgreSQL mà không cần chạy SQL thủ công.
3. **API & Real-time**: RESTful API phản hồi đúng chuẩn JSON; sự kiện cập nhật đơn hàng kích hoạt được WebSocket broadcast tới client.
4. **Email**: Các luồng nghiệp vụ quan trọng kích hoạt gửi email qua MailHog thành công.
5. **Giao diện**: Hoạt động mượt mà trên trình duyệt, không có lỗi console.

---

| **Người lập kế hoạch & Triển khai duy nhất** |
| :---: |
| **Nguyễn Công Hưởng** |
| *(Solo Fullstack Lead, Microservices & AI Architect)* |
