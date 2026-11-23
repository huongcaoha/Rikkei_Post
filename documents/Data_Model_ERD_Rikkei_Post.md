# TÀI LIỆU THIẾT KẾ CƠ SỞ DỮ LIỆU CODE-FIRST & ORM ENTITY SPECIFICATION
## HỆ THỐNG QUẢN LÝ BƯU CHÍNH & CHUYỂN PHÁT NHANH RIKKEI_POST

---

| **Thuộc tính** | **Nội dung** |
| :--- | :--- |
| **Dự án** | **Rikkei_Post** - Smart Express Logistics Platform |
| **Tác giả thiết kế** | **Nguyễn Công Hưởng** (Solo Fullstack Lead & Database Architect) |
| **Phương pháp thiết kế** | **Code-First ORM Pattern** (Định nghĩa Entity Java $\rightarrow$ Hibernate tự động sinh Schema CSDL) |
| **Framework ORM** | **Spring Data JPA / Hibernate 6.x** trên nền tảng **Java 21 LTS** & **Spring Boot 4.1.x** |
| **Hệ quản trị CSDL** | **PostgreSQL 15+** |
| **Cấu hình DDL-Auto** | `spring.jpa.hibernate.ddl-auto=update` |

---

## 1. MÔ HÌNH THỰC THỂ USER & ROLE (MANY-TO-MANY QUA BẢNG `user_role`)

Trong hệ thống **Rikkei_Post**, một người dùng có thể đảm nhiệm **nhiều vai trò** khác nhau (ví dụ: Vừa là chủ shop vừa là quản trị viên, hoặc vừa là thủ kho vừa là bưu tá phát hàng). 
Để đáp ứng điều này, hệ thống thiết kế quan hệ **N-N (Many-to-Many)** giữa thực thể `User` và thực thể `Role`, ORM sẽ tự động tạo ra bảng trung gian **`user_role`**.

```
       +------------------------------------+               +------------------------------------+
       |          Entity: User              |               |          Entity: Role              |
       |          (Table: users)            |               |          (Table: roles)            |
       +------------------------------------+               +------------------------------------+
       | - id: Long (PK, Auto-increment)    | 1           N | - id: Long (PK, Auto-increment)    |
       | - username: String (Unique)        |               | - roleName: String (Unique)        |
       | - password: String                 |               | - description: String              |
       | - fullName: String                 |               +-----------------+------------------+
       | - phoneNumber: String (Unique)     |                                 ^
       | - email: String (Unique)           |                                 | 1
       | - isActive: Boolean                |                                 |
       | - roles: Set<Role>                 |                                 |
       +-----------------+------------------+                                 |
                         | 1                                                  |
                         |                                                    |
                         |          +-------------------------------+         |
                         +--------->|       Table: user_role        |<--------+
                                  N |-------------------------------| N
                                    | - user_id: Long (FK -> users) |
                                    | - role_id: Long (FK -> roles) |
                                    | PRIMARY KEY (user_id, role_id)|
                                    +-------------------------------+
```

### 1.1. Code Entity `Role.java`
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
    private String roleName; // e.g. "ROLE_MERCHANT", "ROLE_SHIPPER", "ROLE_WAREHOUSE_STAFF", "ROLE_DISPATCHER", "ROLE_ACCOUNTANT", "ROLE_ADMIN"

    @Column(name = "description", length = 255)
    private String description;
}
```

### 1.2. Code Entity `User.java`
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
@Table(name = "users", indexes = {
    @Index(name = "idx_user_phone", columnList = "phone_number"),
    @Index(name = "idx_user_email", columnList = "email")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", unique = true, nullable = false, length = 50)
    private String username;

    @Column(name = "password", nullable = false, length = 255)
    private String password;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "phone_number", unique = true, nullable = false, length = 15)
    private String phoneNumber;

    @Column(name = "email", unique = true, nullable = false, length = 100)
    private String email;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "assigned_post_office_id")
    private Long assignedPostOfficeId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    // Quan hệ Many-to-Many tự động sinh bảng trung gian user_role
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

---

## 2. DANH MỤC CÁC ENTITY CODE-FIRST KHÁC TRONG HỆ THỐNG

### 2.1. Entity `MerchantAddress.java` (Sổ địa chỉ kho của Shop)
- `@Table(name = "merchant_addresses")`
- `id`: Long (PK)
- `user`: `@ManyToOne` `User` (FK: `merchant_id`)
- `contactName`, `contactPhone`: String
- `provinceId`, `provinceName`, `districtId`, `districtName`, `wardId`, `wardName`: String / Integer
- `streetAddress`: String
- `latitude`, `longitude`: Double (tọa độ địa lý)
- `isDefault`: Boolean

### 2.2. Entity `Order.java` (Bưu gửi / Vận đơn)
- `@Table(name = "orders", indexes = {@Index(name = "idx_order_tracking", columnList = "tracking_code"), @Index(name = "idx_order_status", columnList = "current_status")})`
- `id`: Long (PK)
- `trackingCode`: String (Unique, format: `RKP...`)
- `merchantId`: Long
- Thông tin Người gửi: `senderName`, `senderPhone`, `senderAddress`, `senderProvinceId`, `senderDistrictId`, `senderWardId`, `senderLat`, `senderLng`
- Thông tin Người nhận: `receiverName`, `receiverPhone`, `receiverAddress`, `receiverProvinceId`, `receiverDistrictId`, `receiverWardId`, `receiverLat`, `receiverLng`
- Bưu kiện & Trọng lượng: `itemName`, `itemValue`, `actualWeightGram`, `lengthCm`, `widthCm`, `heightCm`, `volumetricWeightGram`, `billableWeightGram`
- Chi phí & Tiền thu hộ: `shippingFee`, `insuranceFee`, `totalFee`, `codAmount`, `paymentParty` (SENDER/RECEIVER), `serviceType` (STANDARD/EXPRESS/ROAD_FREIGHT)
- Định tuyến & Trạng thái: `routingCode`, `currentStatus`, `deliveryAttempts`, `notes`
- `createdAt`, `updatedAt`

### 2.3. Entity `PricingMatrix.java` (Bảng giá cước động)
- `@Table(name = "pricing_matrix")`
- `id`: Long (PK)
- `serviceType`: String (`STANDARD`, `EXPRESS`, `ROAD_FREIGHT`)
- `zoneType`: String (`INTRA_PROVINCE`, `INTRA_REGION`, `INTER_REGION_NEAR`, `INTER_REGION_FAR`)
- `baseWeightGram`, `basePrice`, `stepWeightGram`, `stepPrice`: Integer & BigDecimal
- `estimatedDeliveryHours`: Integer

### 2.4. Entity `Warehouse.java` (Bưu cục & Trung tâm chia chọn Hub)
- `@Table(name = "warehouses")`
- `id`: Long (PK)
- `code`: String (Unique)
- `name`: String
- `type`: String (`HUB`, `SPOKE_POST_OFFICE`)
- `provinceId`, `districtId`, `address`: Integer & String
- `latitude`, `longitude`: Double
- `capacityPackages`: Integer

### 2.5. Entity `MasterBag.java` & `BagItem.java` (Bao tải gom hàng & Chi tiết kiện)
- `MasterBag`: `id`, `bagCode` (Unique), `originWarehouseId`, `destWarehouseId`, `sealNumber` (Unique), `status` (`OPEN`, `SEALED`, `MANIFESTED`, `DISPATCHED`, `RECEIVED`, `UNSEALED`), `totalItems`, `totalWeightKg`, `sealedByUserId`, `sealedAt`
- `BagItem`: `id`, `@ManyToOne MasterBag`, `trackingCode`, `weightGram`, `scannedAt`

### 2.6. Entity `ShipmentManifest.java` (Bảng kê chuyến xe tải liên tỉnh)
- `@Table(name = "shipment_manifests")`
- `id`: Long (PK)
- `manifestCode`: String (Unique)
- `tripCode`, `vehiclePlate`, `driverName`, `driverPhone`: String
- `originHubId`, `destHubId`: Long
- `truckSealNumber`: String
- `departureScheduledAt`, `departureActualAt`, `arrivalEstimatedAt`, `arrivalActualAt`: LocalDateTime
- `totalBags`, `totalPackages`: Integer
- `status`: String (`SCHEDULED`, `LOADING`, `DISPATCHED`, `ARRIVED`, `COMPLETED`)

### 2.7. Entity `ShipperAssignment.java` (Nhiệm vụ điều phối giao/nhận)
- `@Table(name = "shipper_assignments")`
- `id`: Long (PK)
- `shipperId`: Long
- `trackingCode`: String
- `taskType`: String (`PICKUP`, `DELIVERY`)
- `sequenceOrder`: Integer (Thứ tự giao tối ưu theo VRP)
- `status`: String (`ASSIGNED`, `IN_PROGRESS`, `SUCCESS`, `FAILED`)
- `failReason`, `podPhotoUrl`, `podSignatureUrl`, `podLatitude`, `podLongitude`, `otpCode`: String, Double
- `completedAt`: LocalDateTime

### 2.8. Entity `OrderTrackingLog.java` (Nhật ký hành trình Event Sourcing)
- `@Table(name = "order_tracking_logs")`
- `id`: Long (PK)
- `trackingCode`: String
- `status`: String
- `locationType`: String (`POST_OFFICE`, `HUB`, `ON_ROAD`, `CONSIGNEE_DOOR`)
- `locationId`: Long
- `locationName`, `description`, `actorName`, `deviceInfo`: String
- `actorId`: Long
- `gpsLat`, `gpsLng`: Double
- `createdAt`: LocalDateTime

### 2.9. Entity `MerchantWallet.java` & `ReconciliationSheet.java` (Ví & Đối soát COD)
- `MerchantWallet`: `id`, `merchantId` (Unique), `availableBalance`, `holdingCodBalance`, `totalWithdrawn`, `bankName`, `bankAccountNumber`, `bankAccountHolder`, `updatedAt`
- `ReconciliationSheet`: `id`, `sheetCode` (Unique), `merchantId`, `startDate`, `endDate`, `totalOrders`, `totalCod`, `totalShippingFee`, `totalInsuranceFee`, `netPayout`, `status` (`PENDING`, `APPROVED`, `TRANSFERRED`, `REJECTED`), `bankTransactionCode`

---

## 3. CẤU HÌNH CODE-FIRST HIBERNATE TRONG `application.yml`

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/rkp_logistics
    username: rkp_admin
    password: rkp_password_2026
    driver-class-name: org.postgresql.Driver

  jpa:
    database-platform: org.hibernate.dialect.PostgreSQLDialect
    hibernate:
      ddl-auto: update # Tự động tạo bảng, khóa ngoại, bảng user_role khi chạy ứng dụng
    show-sql: true
    properties:
      hibernate:
        format_sql: true
        jdbc:
          batch_size: 50
```

---

| **Tác giả & Kiến trúc sư CSDL duy nhất** |
| :---: |
| **Nguyễn Công Hưởng** |
| *(Solo Fullstack Lead & Database Architect)* |
