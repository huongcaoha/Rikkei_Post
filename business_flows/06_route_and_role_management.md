# 06. QUẢN LÝ TUYẾN ĐƯỜNG VẬN CHUYỂN & PHÂN QUYỀN VAI TRÒ ĐỘNG (ROLES & ROUTES)
## HỆ THỐNG RIKKEI POST WMS LOGISTICS

---

## 📌 1. Phân Định Chuyên Biệt Tuyến Đường Giao Nhận

Trong mạng lưới bưu chính của Rikkei Post, mô hình giao nhận được tách bạch thành **2 loại tuyến đường chuyên biệt** tương ứng với 2 phương tiện và 2 loại hình nhân sự hoàn toàn khác nhau:

```mermaid
graph TD
    classDef mainNode fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef motorNode fill:#fef3c7,stroke:#d97706,stroke-width:1.5px;
    classDef truckNode fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px;

    AllRoutes["Hệ Thống Quản Lý Tuyến Đường Bưu Chính<br/>(Route Management System)"]:::mainNode

    AllRoutes --> RouteType1["1. Tuyến Xe Máy Giao - Nhận Hàng Lẻ<br/>(MOTORBIKE_DELIVERY)"]:::motorNode
    AllRoutes --> RouteType2["2. Tuyến Ô Tô Gom Hàng & Trung Chuyển<br/>(TRUCK_TRANSFER)"]:::truckNode

    RouteType1 --> Sub1["Phương tiện: Xe máy gắn thùng giao hàng"]
    RouteType1 --> Sub2["Nhân sự: Bưu tá (Shipper)"]
    RouteType1 --> Sub3["Phạm vi: Cụm dân cư, ngõ hẻm, phường/xã, tòa nhà"]
    RouteType1 --> Sub4["Hàng hóa: Kiện nhỏ lẻ, bưu phẩm, thư từ"]

    RouteType2 --> Sub5["Phương tiện: Xe tải thùng kín (1.25T - 15T)"]
    RouteType2 --> Sub6["Nhân sự: Tài xế xe tải đường trục (Truck Driver)"]
    RouteType2 --> Sub7["Phạm vi: Liên bưu cục, bưu cục gom -> Hub trung tâm"]
    RouteType2 --> Sub8["Hàng hóa: Bao tải Master Bag kẹp chì, Pallet"]
```

---

## 🔒 2. Quy Tắc Phân Quyền Quản Lý Tuyến Đường Theo Bưu Cục

### 2.1. Giới hạn tầm nhìn (Visibility Scope)
- **Quản lý Bưu cục nào thì chỉ xem và thao tác trên các tuyến đường thuộc bưu cục mình:**
  - Khi Quản lý Bưu cục đăng nhập vào màn hình Tuyến Đường, danh sách hiển thị tự động được lọc theo `post_office_id` của tài khoản đăng nhập.
  - Quản lý không nhìn thấy và không thể can thiệp vào các tuyến đường thuộc về bưu cục khác trong hệ thống.
- **Tự động điền bưu cục quản lý khi tạo tuyến:**
  - Trong biểu mẫu `+ Thêm Tuyến Đường Mới`, trường **"Bưu cục quản lý"** được khóa và tự động gán giá trị mặc định là bưu cục mà tài khoản Quản lý đang trực thuộc. Tránh sai sót người dùng chọn nhầm bưu cục của đơn vị bạn.

### 2.2. Phân công nhân sự theo tuyến
- Đối với tuyến `MOTORBIKE_DELIVERY`: Hệ thống chỉ cho phép chọn Bưu tá (Shipper) thuộc danh sách nhân viên của bưu cục phụ trách.
- Đối với tuyến `TRUCK_TRANSFER`: Hệ thống chỉ cho phép chọn Xe tải và Tài xế xe tải (`TRUCK_DRIVER`) trực thuộc bưu cục quản lý.

---

## 👥 3. Quản Trị Vai Trò Động (Dynamic Role Management)

### 3.1. Vấn đề thực tế của giải pháp Hardcoded Role
Trước đây, các hệ thống thường định nghĩa danh sách vai trò cứng (Enum hardcoded trong Java hoặc Database seed tĩnh). Khi doanh nghiệp mở rộng quy mô cần thêm vai trò mới (ví dụ: *Điều Phối Viên Đội Xe*, *Nhân Viên Kiểm Định Chất Lượng*, *Thanh Tra An Ninh Hàng Hóa*), lập trình viên phải sửa code backend, sửa giao diện frontend và deploy lại toàn bộ hệ thống rất rủi ro.

### 3.2. Cơ chế Dynamic Role trong Rikkei Post Admin Portal
Hệ thống bổ sung module **Quản Lý Vai Trò Động (Dynamic Role Management)** dành riêng cho Quản trị viên cấp cao (Admin):
1. **Tạo vai trò mới trực tiếp trên giao diện Admin:**
   - Mã vai trò (Role Code): Tự động chuẩn hóa viết hoa không dấu, tiền tố `ROLE_` (ví dụ: `ROLE_FLEET_COORDINATOR`).
   - Tên hiển thị (Display Name): Tiếng Việt rõ nghĩa (ví dụ: *Điều phối viên đội xe trung chuyển*).
   - Mô tả phạm vi trách nhiệm (Description).
2. **Cấu hình nhóm quyền (Permission Checklist):**
   - Danh sách quyền hạn được phân cấp theo nhóm tài nguyên:
     - Nhóm Quản trị hệ thống (Xem người dùng, Thêm người dùng, Đổi mật khẩu).
     - Nhóm Vận hành bưu cục (Đóng bao tải, Kẹp chì, Quét nhập kho, Chia chọn).
     - Nhóm Vận tải đường trục (Tạo lệnh điều vận, Quét camera nạp bao, Cập nhật lộ trình).
     - Nhóm Vật tư & Thiết bị (Quản lý kho vật tư, Lập phiếu xuất, Thu hồi máy hỏng).
     - Nhóm Tài chính & Đối soát (Duyệt COD, Đối soát công nợ shop).
3. **Hiệu lực tức thì (Realtime Dynamic Authorization):**
   - Khi Admin thêm hoặc chỉnh sửa quyền hạn của Role, danh sách quyền hạn được lưu vào bảng `roles` và `role_permissions`.
   - Các API kiểm tra quyền qua Spring Security sử dụng cơ chế kiểm tra động (`@PreAuthorize("@rbacService.hasPermission(authentication, 'PERMISSION_NAME')")`) mà không cần restart server hay sửa lại mã nguồn.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Quản Trị Viên (Admin)
    participant UI as Giao Diện Quản Trị Role
    participant API as Backend Role Controller
    participant DB as CSDL (roles & permissions)
    actor NewUser as Nhân Viên Được Gán Role Mới

    Admin->>UI: 1. Mở Cổng Admin -> Quản Lý Vai Trò
    Admin->>UI: 2. Bấm '+ Thêm Vai Trò Mới'
    Admin->>UI: 3. Nhập Tên: 'Điều Phối Đội Xe', Mã: 'ROLE_FLEET_COORDINATOR'
    Admin->>UI: 4. Tích chọn các quyền: Quản lý xe tải, Xem tuyến đường, Tạo lệnh điều vận
    Admin->>UI: 5. Bấm 'Lưu Vai Trò'
    UI->>API: POST /api/admin/roles { roleCode, permissions[] }
    API->>DB: INSERT INTO roles & role_permissions
    API-->>UI: Thông báo tạo vai trò thành công!

    Note over Admin, NewUser: GÁN ROLE CHO NHÂN VIÊN
    Admin->>UI: 6. Mở danh sách nhân viên -> Chọn nhân viên -> Gán vai trò 'Điều Phối Đội Xe'
    UI->>API: PUT /api/admin/users/{id}/roles
    API->>DB: UPDATE user_roles

    Note over NewUser, API: TÁC NGHIỆP TỨC THÌ KHÔNG CẦN DEPLOY
    NewUser->>API: Đăng nhập & Gọi API Tạo lệnh điều vận
    API->>DB: Kiểm tra quyền qua RBAC Service -> Quyền hợp lệ!
    API-->>NewUser: Cho phép tác nghiệp thành công!
```
