# RIKKEI_POST - HỆ THỐNG QUẢN LÝ BƯU CHÍNH & CHUYỂN PHÁT NHANH THÔNG MINH

> **Hệ sinh thái Logistics & E-Commerce Express Delivery chuẩn mô hình Hub-and-Spoke (Viettel Post)**  
> Ứng dụng Kiến trúc **Code-First Microservices** (**Java 21**, **Spring Boot 4.1.x / 3.3.x**, **Spring Data JPA/Hibernate ORM**, **Gradle**, **WebSocket**, **Kafka KRaft**, **Redis**) & Frontend Hiện đại (**ReactJS**, **Tailwind CSS**, **Ant Design**).

---

## 👤 TÁC GIẢ & NHÀ PHÁT TRIỂN DỰ ÁN
- **Nguyễn Công Hưởng** (Solo Fullstack Lead, Microservices & AI Architect) đảm nhiệm toàn diện:
  - Thiết kế kiến trúc, mô hình nghiệp vụ E-Logistics Hub-and-Spoke.
  - Xây dựng Backend Code-First ORM, Security JWT, WebSocket real-time, Email Service.
  - Quản lý build thuần **Gradle** (không dùng Maven).
  - Tối ưu hóa hạ tầng Docker: Sử dụng **Apache Kafka KRaft** (bỏ Zookeeper), sẵn sàng tích hợp **Cloudflare R2** và SMTP thật.
  - Xây dựng Frontend Cổng khách hàng, WMS Hub Desktop & Shipper Mobile Web.

---

## 📂 DANH MỤC TÀI LIỆU DỰ ÁN (DOCUMENTATION)

Tất cả tài liệu kỹ thuật chuẩn quốc tế đã được biên soạn đầy đủ tại thư mục [documents/](file:///d:/My_Project/Logistics_research_project/documents):

1. 📄 **[Tài liệu Đặc tả Yêu cầu Phần mềm (SRS v2.0)](file:///d:/My_Project/Logistics_research_project/documents/SRS_Rikkei_Post.md)**
2. 📅 **[Kế hoạch Triển khai Dự án 4 Sprints (Solo Developer Roadmap)](file:///d:/My_Project/Logistics_research_project/documents/Sprint_Plan_Rikkei_Post.md)**
3. 🏛️ **[Tài liệu Thiết kế Kiến trúc Hệ thống (Architecture Design)](file:///d:/My_Project/Logistics_research_project/documents/Architecture_Design_Rikkei_Post.md)**
4. 🗄️ **[Thiết kế Cơ sở Dữ liệu Code-First & ORM Entity (Data Model)](file:///d:/My_Project/Logistics_research_project/documents/Data_Model_ERD_Rikkei_Post.md)**

---

## ⚡ HẠ TẦNG DOCKER COMPOSE TINH GỌN (KAFKA KRAFT - ZERO ZOOKEEPER)

File [docker-compose.yml](file:///d:/My_Project/Logistics_research_project/docker-compose.yml) được tối ưu hóa tối đa:
- **PostgreSQL 15**: Cổng `5432` *(DB: `rkp_logistics`)*
- **Redis 7**: Cổng `6379` *(Cache & Distributed Lock)*
- **Apache Kafka 7.6.0 (KRaft Mode)**: Cổng `9092` *(Chạy độc lập, không cần Zookeeper)*
- **Kafka UI**: Cổng `http://localhost:8089` *(Giao diện quản lý Topic & Message trực quan)*

> 💡 **Về MinIO và MailHog**:
> - Khi deploy lên **VPS & Cloudflare**, bạn dùng **Cloudflare R2** (tương thích 100% chuẩn S3 API, hoàn toàn miễn phí băng thông truyền ra / zero egress fees) và **Java Mail** kết nối máy chủ SMTP thật (Gmail, SendGrid, Amazon SES, VPS mail). 
> - Vì vậy, MinIO và MailHog **HOÀN TOÀN KHÔNG CẦN THIẾT** và đã được loại bỏ khỏi `docker-compose.yml` giúp tiết kiệm ~1.5 GB RAM cho máy của bạn!

---

## 🚀 HƯỚNG DẪN KHỞI CHẠY NHANH BẰNG GRADLE

```bash
# 1. Khởi động hạ tầng tinh gọn (Postgres, Redis, Kafka KRaft)
docker-compose up -d

# 2. Khởi chạy Backend bằng Gradle Wrapper (Java 21)
cd backend
./gradlew bootRun

# 3. Khởi chạy Frontend ReactJS
cd ../frontend
npm run dev
```

### Các dịch vụ sẵn sàng truy cập:
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: `http://localhost:8080`
- **WebSocket STOMP Endpoint**: `ws://localhost:8080/ws-logistics`
- **Kafka Web UI**: [http://localhost:8089](http://localhost:8089)
- **PostgreSQL 15**: `localhost:5432` *(User: `rkp_admin` / Pass: `rkp_password_2026`)*
