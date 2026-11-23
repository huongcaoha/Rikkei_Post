# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)
## HỆ THỐNG QUẢN LÝ BƯU CHÍNH & CHUYỂN PHÁT NHANH THÔNG MINH - RIKKEI_POST

---

| **Thuộc tính** | **Nội dung** |
| :--- | :--- |
| **Tên dự án** | **Rikkei_Post** - Smart Express Logistics & Supply Chain Platform |
| **Mô hình nghiên cứu** | Logistics & E-Commerce Express Delivery (Chuẩn mô hình Hub-and-Spoke Viettel Post) |
| **Tác giả & Nhà phát triển** | **Nguyễn Công Hưởng** (Solo Fullstack Lead, Microservices & AI Architect) |
| **Ngôn ngữ & Nền tảng** | **Java 21 LTS**, **Spring Boot 4.1.x**, **Spring AI 2.0 (GA)**, **ReactJS 18+**, **Tailwind CSS**, **Ant Design** |
| **Cơ chế CSDL & ORM** | **Code-First** với **Spring Data JPA & Hibernate ORM** (Tự động sinh bảng, quan hệ & khóa ngoại) |
| **Real-time & Thông báo**| **WebSocket (STOMP over SockJS)** cập nhật trạng thái thời gian thực & **Spring Mail** gửi email tự động |
| **Phiên bản tài liệu** | 2.0.0 (Updated: Solo Developer & Code-First ORM Architecture) |
| **Ngày cập nhật** | 20/11/2026 |
| **Tiêu chuẩn tài liệu** | IEEE Std 830-1998 / ISO/IEC/IEEE 29148:2018 |

---

## MỤC LỤC TỔNG QUAN

1. [GIỚI THIỆU TỔNG QUAN (INTRODUCTION)](#1-giới-thiệu-tổng-quan-introduction)
   - 1.1. Mục đích tài liệu (Purpose)
   - 1.2. Phạm vi hệ thống (System Scope)
   - 1.3. Định nghĩa, Thuật ngữ & Từ viết tắt (Definitions & Acronyms)
   - 1.4. Tài liệu tham chiếu (References)
2. [MÔ HÌNH VẬN HÀNH LOGISTICS CHUYỂN PHÁT (OPERATIONAL MODEL)](#2-mô-hình-vận-hành-logistics-chuyển-phát-operational-model)
   - 2.1. Mô hình Hub-and-Spoke 3 chặng (First-Mile, Middle-Mile, Last-Mile)
   - 2.2. Phân tích 5 nhóm nghiệp vụ cốt lõi
   - 2.3. Các tác nhân trong hệ thống (Actors & Multiple Roles)
   - 2.4. Giả định và ràng buộc phụ thuộc (Assumptions & Dependencies)
3. [YÊU CẦU CHỨC NĂNG HỆ THỐNG - 5 PHÂN HỆ MVP (FUNCTIONAL REQUIREMENTS)](#3-yêu-cầu-chức-năng-hệ-thống---5-phân-hệ-mvp-functional-requirements)
   - 3.1. Phân hệ 1: Customer Portal & Order Management (Tạo đơn, Tính cước & Tra cứu hành trình)
   - 3.2. Phân hệ 2: WMS Hub & Spoke Management (Quản lý kho & Trung tâm chia chọn)
   - 3.3. Phân hệ 3: TMS & Last-Mile Delivery (Điều phối vận tải, Shipper App & Bằng chứng giao hàng POD)
   - 3.4. Phân hệ 4: Đối soát COD & Quản lý Tài chính, Đối tác (COD Reconciliation & Carrier Settlement)
   - 3.5. Phân hệ 5: Tối ưu tuyến đường, Gom tải & Ứng dụng AI (Route & Cost Optimization with Spring AI 2.0)
4. [MÔ HÌNH THỰC THỂ CODE-FIRST & QUAN HỆ ĐA VAI TRÒ (ORM ENTITY MODEL)](#4-mô-hình-thực-thể-code-first--quan-hệ-đa-vai-trò-orm-entity-model)
   - 4.1. Thiết kế Many-to-Many giữa User và Role qua bảng trung gian `user_role`
   - 4.2. Danh mục các Entity Code-First cốt lõi (JPA Annotations)
   - 4.3. Cấu hình Hibernate DDL-Auto (`update`) & Migration
5. [HỆ THỐNG REAL-TIME WEBSOCKET & EMAIL THÔNG BÁO (WEBSOCKET & EMAIL ENGINE)](#5-hệ-thống-real-time-websocket--email-thông-báo-websocket--email-engine)
   - 5.1. Kiến trúc WebSocket STOMP real-time cho tiến trình giao hàng
   - 5.2. Động cơ gửi Email tự động với Spring Mail & MailHog / SMTP
6. [YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS - NFR)](#6-yêu-cầu-phi-chức-năng-non-functional-requirements---nfr)
7. [THIẾT KẾ KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE DESIGN)](#7-thiết-kế-kiến-trúc-hệ-thống-system-architecture-design)
8. [HƯỚNG PHÁT TRIỂN TƯƠNG LAI (FUTURE ROADMAP)](#8-hướng-phát-triển-tương-lai-future-roadmap)

---

## 1. GIỚI THIỆU TỔNG QUAN (INTRODUCTION)

### 1.1. Mục đích tài liệu (Purpose)
Tài liệu Đặc tả Yêu cầu Phần mềm (SRS) này xác lập toàn bộ yêu cầu nghiệp vụ, kiến trúc kỹ thuật và hướng dẫn lập trình **Code-First ORM** cho nền tảng chuyển phát nhanh **Rikkei_Post**. Toàn bộ dự án được thiết kế, triển khai và hoàn thiện độc lập bởi **Nguyễn Công Hưởng** (Solo Fullstack Lead & AI Architect).

### 1.2. Phạm vi hệ thống (System Scope)
- Chuẩn hóa mô hình Hub-and-Spoke theo thực tiễn của Viettel Post.
- Sử dụng **Java 21**, **Spring Boot 4.1.x**, **Spring AI 2.0 (bản GA chính thức)**.
- Triển khai cơ chế **Code-First ORM** với Hibernate/Spring Data JPA: Các class Entity trong mã nguồn Java sẽ tự động tạo bảng, thiết lập khóa chính, khóa ngoại, chỉ mục và bảng trung gian `user_role` trên PostgreSQL.
- Cập nhật sự kiện hành trình và thông báo thời gian thực qua **WebSocket (STOMP)**.
- Tự động hóa gửi thông báo, xác nhận đơn hàng, OTP và bảng kê đối soát COD qua **Spring Mail**.

---

## 2. MÔ HÌNH VẬN HÀNH LOGISTICS CHUYỂN PHÁT (OPERATIONAL MODEL)

### 2.1. Mô hình Hub-and-Spoke 3 chặng
1. **First-Mile**: Shop tạo đơn $\rightarrow$ Bưu tá lấy hàng hoặc khách gửi bưu cục gốc.
2. **Middle-Mile**: Tập kết tại Hub trung tâm $\rightarrow$ Cân đo quy đổi $\rightarrow$ Chia chọn $\rightarrow$ Gom đóng bao Master Bag $\rightarrow$ Xe tải vận chuyển liên tỉnh.
3. **Last-Mile**: Bưu cục phát $\rightarrow$ Bưu tá giao tận tay người nhận $\rightarrow$ Chụp ảnh POD, chữ ký, OTP $\rightarrow$ Thu COD.

### 2.2. Các tác nhân và mô hình Đa vai trò (Multiple Roles per User)
Một người dùng trong hệ thống **Rikkei_Post** có thể sở hữu **nhiều quyền (Multiple Roles)** cùng lúc. Ví dụ:
- Một nhân sự có thể vừa là `ROLE_WAREHOUSE_STAFF` (Thủ kho) vừa là `ROLE_SHIPPER` (Bưu tá giao hàng).
- Một tài khoản doanh nghiệp có thể vừa là `ROLE_MERCHANT` (Chủ shop bán hàng) vừa là `ROLE_CARRIER` (Đối tác vận chuyển).
- Quản trị viên (`ROLE_ADMIN`) có đầy đủ các quyền vận hành.

---

## 3. YÊU CẦU CHỨC NĂNG HỆ THỐNG (5 PHÂN HỆ MVP)

### 3.1. Phân hệ 1: Customer Portal & Order Management
- **FR1.1**: Đăng ký, đăng nhập JWT, hỗ trợ người dùng có nhiều vai trò.
- **FR1.2**: Tạo đơn lẻ, tạo đơn lô từ Excel, validate địa chỉ 3 cấp hành chính.
- **FR1.3**: Động cơ định giá cước động: Trọng lượng quy đổi $(D \times R \times C) / 6000$, phụ phí bảo hiểm, cước vùng miền.
- **FR1.4**: Sinh mã vận đơn độc nhất `RKP...`, in tem nhãn nhiệt mã vạch Code 128 / QR Code chuẩn A6/A7.
- **FR1.5**: Tra cứu hành trình bưu gửi thời gian thực, xem timeline và bản đồ Google Maps.

### 3.2. Phân hệ 2: Quản lý Kho WMS Hub & Spoke
- **FR2.1**: Quét mã vạch Inbound tốc độ cao ($< 80ms$), tự động cân đo lại trọng lượng.
- **FR2.2**: Tự động sinh Routing Code phân luồng cửa xuất (Chute/Gate ID).
- **FR2.3**: Đóng bao tải Master Bag, kẹp chì seal niêm phong, quản lý danh sách kiện trong bao.
- **FR2.4**: Quét xuất kho xe tải (Outbound Manifest), phát hiện chênh lệch kiện.

### 3.3. Phân hệ 3: Vận tải TMS & Giao nhận Last-Mile
- **FR3.1**: Điều phối tự động bưu tá lấy hàng theo địa bàn (Geofence).
- **FR3.2**: Quản lý lịch trình xe tải đường trục (Linehaul).
- **FR3.3**: Shipper Mobile Web tối ưu cảm ứng, hiển thị bản đồ Google Maps dẫn đường.
- **FR3.4**: Xác thực giao hàng điện tử POD: Chụp ảnh hiện trường có Watermark GPS + Giờ giao, ký tên cảm ứng, xác nhận mã OTP với đơn giá trị cao.
- **FR3.5**: Quản lý tiền COD, tạo mã VietQR động trực tiếp trên máy shipper để người nhận thanh toán không dùng tiền mặt.
- **FR3.6**: Xử lý giao thất bại, lên lịch phát lại tối đa 3 lần hoặc kích hoạt Hàng hoàn (RTS).

### 3.4. Phân hệ 4: Đối soát COD & Đối tác vận tải
- **FR4.1**: Tự động cấn trừ cước vận chuyển, phí bảo hiểm vào tiền COD thu hộ.
- **FR4.2**: Sinh bảng kê đối soát chi tiết dạng Excel/PDF định kỳ gửi email cho chủ shop.
- **FR4.3**: Quản lý ví số dư shop, hỗ trợ tạo yêu cầu rút tiền về tài khoản ngân hàng.
- **FR4.4**: Quản lý đối tác vận tải 3PL, theo dõi SLA tỷ lệ giao đúng giờ.

### 3.5. Phân hệ 5: Tối ưu tuyến đường, Gom tải & Trí tuệ nhân tạo (Spring AI 2.0)
- **FR5.1**: Phân cụm đơn hàng theo địa lý (Geographic Clustering).
- **FR5.2**: Tối ưu hóa thứ tự các điểm dừng lấy/giao hàng (VRP/TSP Solver) giúp tiết kiệm 20-30% quãng đường di chuyển cho bưu tá.
- **FR5.3**: **Trợ lý ảo AI CSKH (Spring AI 2.0)**: Ứng dụng mô hình LLM kết hợp Tool/Function Calling tra cứu trực tiếp dữ liệu đơn hàng trong hệ thống để giải đáp câu hỏi của khách hàng bằng tiếng Việt tự nhiên.
- **FR5.4**: Dự báo thời gian giao hàng (AI Predictive ETA) và cảnh báo nguy cơ trễ hẹn SLA.

---

## 4. MÔ HÌNH THỰC THỂ CODE-FIRST & QUAN HỆ ĐA VAI TRÒ (ORM ENTITY MODEL)

Toàn bộ CSDL được xây dựng theo phương pháp **Code-First**: Định nghĩa các Java Class có gắn annotation của **Jakarta Persistence (JPA)**; Hibernate sẽ tự động sinh DDL (Data Definition Language) tạo bảng, cột, khóa chính, khóa ngoại và chỉ mục bên PostgreSQL khi ứng dụng khởi chạy.

### 4.1. Thiết kế Many-to-Many giữa User và Role qua bảng trung gian `user_role`

Một người dùng có thể có nhiều vai trò, và một vai trò có thể thuộc về nhiều người dùng.

```
       +-----------------------+                         +-----------------------+
       |         User          |                         |         Role          |
       +-----------------------+                         +-----------------------+
       | id (PK)               | 1                     N | id (PK)               |
       | username              |                         | roleName              |
       | password              |                         | description           |
       | fullName              |                         +-----------+-----------+
       | phoneNumber           |                                     ^
       | email                 |                                     | 1
       +-----------+-----------+                                     |
                   | 1                                               |
                   |                                                 |
                   |         +-----------------------------+         |
                   +-------->|          user_role          |<--------+
                           N |-----------------------------| N
                             | user_id (FK -> users.id)    |
                             | role_id (FK -> roles.id)    |
                             | PRIMARY KEY (user_id, role_id)
                             +-----------------------------+
```

#### Định nghĩa Class `Role.java`:
```java
package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "role_name", unique = true, nullable = false, length = 50)
    private String roleName; // e.g., "ROLE_MERCHANT", "ROLE_SHIPPER", "ROLE_WAREHOUSE_STAFF", "ROLE_ADMIN"

    @Column(name = "description", length = 255)
    private String description;
}
```

#### Định nghĩa Class `User.java`:
```java
package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "phone_number", unique = true, nullable = false, length = 15)
    private String phoneNumber;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    // Quan hệ Many-to-Many tự động tạo bảng trung gian user_role
    @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
        name = "user_role",
        joinColumns = @JoinColumn(name = "user_id", referencedColumnName = "id"),
        inverseJoinColumns = @JoinColumn(name = "role_id", referencedColumnName = "id")
    )
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
```

### 4.2. Cấu hình Code-First trong `application.yml`
```yaml
spring:
  jpa:
    database-platform: org.hibernate.dialect.PostgreSQLDialect
    hibernate:
      ddl-auto: update # Tự động tạo và cập nhật schema CSDL từ Java Entity
    show-sql: true
    properties:
      hibernate:
        format_sql: true
```

---

## 5. HỆ THỐNG REAL-TIME WEBSOCKET & EMAIL THÔNG BÁO

### 5.1. Kiến trúc WebSocket STOMP
- **Endpoint STOMP**: `/ws-logistics`
- **Application Destination Prefix**: `/app`
- **Topic Broker Destinations**: `/topic` (Public updates) và `/user/queue` (Private notification).
- **Luồng Real-time**:
  - Khi bưu tá bấm *"Bắt đầu đi phát"* hoặc *"Giao thành công POD"*, Backend bắn message lên `/topic/orders/{trackingCode}`.
  - Cổng Customer Portal và trang tra cứu tự động cập nhật trạng thái bưu gửi ngay lập tức mà không cần F5.

### 5.2. Động cơ gửi Email tự động với Spring Mail
- Tích hợp `spring-boot-starter-mail` cấu hình kết nối SMTP (MailHog trong môi trường Dev, SendGrid/Amazon SES trong môi trường Production).
- **Các kịch bản tự động gửi email**:
  1. *Email chào mừng & Kích hoạt tài khoản Shop*.
  2. *Email thông báo tạo đơn thành công kèm file nhãn in bưu gửi PDF*.
  3. *Email cảnh báo đơn hàng giao thất bại (kèm lý do và ảnh bằng chứng)*.
  4. *Email bảng kê đối soát COD định kỳ kèm file Excel chi tiết dòng tiền*.

---

## 6. YÊU CẦU PHI CHỨC NĂNG (NFR)
- **Code-First Performance**: Tạo chỉ mục `@Index` trên các cột tìm kiếm thường xuyên (`tracking_code`, `phone_number`, `current_status`).
- **Real-time Latency**: Độ trễ truyền phát qua WebSocket $< 50ms$.
- **Email Asynchronous**: Toàn bộ thao tác gửi email chạy bất đồng bộ qua `@Async` để không làm nghẽn tiến trình HTTP request của người dùng.

---

## 7. KÝ DUYỆT TÀI LIỆU

| **Tác giả & Nhà phát triển duy nhất** |
| :---: |
| **Nguyễn Công Hưởng** |
| *(Solo Fullstack Lead, Microservices & AI Architect)* |
