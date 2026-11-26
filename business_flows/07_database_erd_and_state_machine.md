# 07. SƠ ĐỒ THỰC THỂ CSDL (ERD) & MÁY TRẠNG THÁI TOÀN HỆ THỐNG
## HỆ THỐNG RIKKEI POST WMS LOGISTICS

---

## 📌 1. Sơ Đồ Thực Thể Cơ Sở Dữ Liệu Quan Hệ (Entity Relationship Diagram - ERD)

```mermaid
erDiagram
    USERS ||--o{ ORDERS : "creates / handles"
    USERS ||--o{ MASTER_BAGS : "packs / seals"
    USERS ||--o{ DISPATCH_ORDERS : "drives / manages"
    USERS ||--o{ ATTENDANCE_RECORDS : "records"
    USERS ||--o{ SUPPLY_TICKETS : "issues / confirms"
    ROLES ||--o{ USERS : "assigned to"
    ROLES ||--o{ ROLE_PERMISSIONS : "contains"

    WAREHOUSES ||--o{ USERS : "employs"
    WAREHOUSES ||--o{ ORDERS : "current location"
    WAREHOUSES ||--o{ MASTER_BAGS : "origin / destination"
    WAREHOUSES ||--o{ ROUTES : "manages"
    WAREHOUSES ||--o{ DISPATCH_ORDERS : "origin / destination"

    ROUTES ||--o{ DISPATCH_ORDERS : "assigned route"

    MASTER_BAGS ||--o{ ORDERS : "contains (1-to-N)"
    DISPATCH_ORDERS ||--o{ MASTER_BAGS : "transports (1-to-N)"

    SUPPLY_WAREHOUSES ||--o{ SUPPLY_ITEMS : "stores"
    SUPPLY_WAREHOUSES ||--o{ SUPPLY_TICKETS : "source warehouse"
    SUPPLY_TICKETS ||--o{ SUPPLY_TICKET_DETAILS : "includes"
    SUPPLY_ITEMS ||--o{ SUPPLY_TICKET_DETAILS : "specified in"

    USERS {
        bigint id PK
        string username UK
        string password_hash
        string full_name
        string phone
        string email
        bigint role_id FK
        bigint warehouse_id FK
        string face_descriptor_json
        string status
    }

    WAREHOUSES {
        bigint id PK
        string code UK
        string name
        string warehouse_type "POST_OFFICE | HUB"
        string address
        double latitude
        double longitude
        bigint manager_id FK
    }

    ORDERS {
        bigint id PK
        string tracking_code UK
        bigint sender_id FK
        string receiver_name
        string receiver_phone
        string receiver_address
        decimal weight_kg
        decimal cod_amount
        decimal shipping_fee
        string status "ORDER_STATUS"
        bigint current_warehouse_id FK
        bigint master_bag_id FK
        datetime created_at
    }

    MASTER_BAGS {
        bigint id PK
        string bag_code UK
        string seal_code UK
        bigint origin_warehouse_id FK
        bigint destination_warehouse_id FK
        int item_count
        decimal total_weight_kg
        string status "BAG_STATUS"
        bigint dispatch_order_id FK
        bigint driver_id FK
        bigint truck_id FK
        datetime sealed_at
    }

    DISPATCH_ORDERS {
        bigint id PK
        string dispatch_code UK
        bigint origin_warehouse_id FK
        bigint destination_warehouse_id FK
        bigint route_id FK
        bigint truck_id FK
        bigint driver_id FK
        bigint created_by_manager_id FK
        string status "DISPATCH_STATUS"
        datetime departed_at
        datetime completed_at
    }

    SUPPLY_WAREHOUSES {
        bigint id PK
        string name
        string address
        string google_map_location
        bigint manager_id FK
    }

    SUPPLY_ITEMS {
        bigint id PK
        string item_code UK
        string item_name
        string category
        string unit
        int stock_quantity
        bigint supply_warehouse_id FK
    }

    SUPPLY_TICKETS {
        bigint id PK
        string ticket_code UK
        string ticket_type "EXPORT | RECALL"
        bigint supply_warehouse_id FK
        bigint target_warehouse_id FK
        bigint creator_id FK
        bigint confirmed_by_id FK
        string status "TICKET_STATUS"
        datetime created_at
        datetime confirmed_at
    }
```

---

## 🔄 2. Sơ Đồ Máy Trạng Thái Toàn Hệ Thống (State Machines)

### 2.1. Vòng Đời Đơn Hàng (`ORDER_STATUS`)

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Shop soạn đơn nháp
    DRAFT --> WAITING_FOR_PICKUP: Shop xác nhận gửi hàng
    WAITING_FOR_PICKUP --> PICKED_UP: Bưu tá quét camera lấy hàng tại Shop
    PICKED_UP --> IN_POST_OFFICE: Nhập kho bưu cục gốc
    IN_POST_OFFICE --> BAGGED: Đóng vào bao Master Bag kẹp chì
    BAGGED --> IN_TRANSIT: Nạp lên xe tải vận chuyển đường trục
    IN_TRANSIT --> AT_HUB: Nhập Hub trung tâm chia chọn
    AT_HUB --> IN_TRANSIT: Đóng bao chuyển tiếp về Bưu cục phát
    IN_TRANSIT --> IN_POST_OFFICE: Nhập kho bưu cục phát
    IN_POST_OFFICE --> OUT_FOR_DELIVERY: Phân tuyến cho bưu tá đi phát
    OUT_FOR_DELIVERY --> DELIVERED: Khách nhận & Thu hộ COD thành công
    OUT_FOR_DELIVERY --> DELIVERY_FAILED: Giao không thành công (Hẹn lại / Sai địa chỉ)
    DELIVERY_FAILED --> OUT_FOR_DELIVERY: Phát lại lần 2 / lần 3
    DELIVERY_FAILED --> RETURNING: Quá số lần phát -> Chuyển hoàn về Shop
    RETURNING --> RETURNED: Bưu tá trả hàng về tận tay Shop
    DELIVERED --> [*]
    RETURNED --> [*]
```

### 2.2. Vòng Đời Bao Tải Master Bag (`BAG_STATUS`)

```mermaid
stateDiagram-v2
    [*] --> OPEN: Tạo bao tải mới (Gom kiện lẻ)
    OPEN --> SEALED: Bấm kẹp chì niêm phong (Khai báo mã SEAL, in tem A6)
    SEALED --> LOADED_ON_TRUCK: Tài xế mở camera quét nạp lên xe tải (Gán Driver & Truck)
    LOADED_ON_TRUCK --> IN_TRANSIT: Xe khởi hành vận chuyển
    IN_TRANSIT --> RECEIVED_AT_DESTINATION: Kho đích quét mã bao tải tiếp nhận
    RECEIVED_AT_DESTINATION --> UNPACKED: Cắt chì niêm phong, dỡ kiện con kiểm đếm
    UNPACKED --> [*]
```

### 2.3. Vòng Đời Chuyến Xe Điều Vận (`DISPATCH_STATUS`)

```mermaid
stateDiagram-v2
    [*] --> CREATED: Quản lý bưu cục tạo lệnh điều vận
    CREATED --> LOADING: Tài xế nhận lệnh & mở camera quét nạp bao
    LOADING --> IN_TRANSIT: Đủ hàng & Xe xuất phát rời bến
    IN_TRANSIT --> IN_TRANSIT: Bị chặn nếu còn bao tải chưa nhập kho đích
    IN_TRANSIT --> COMPLETED: 100% bao tải đã nhập kho đích & Tài xế bấm 'Hoàn thành'
    COMPLETED --> [*]
```

### 2.4. Vòng Đời Phiếu Xuất Cấp Phát & Thu Hồi Vật Tư (`SUPPLY_TICKET_STATUS`)

```mermaid
stateDiagram-v2
    [*] --> CHO_XAC_NHAN: Thủ kho lập phiếu xuất cấp phát cho bưu cục
    CHO_XAC_NHAN --> COMPLETED: Quản lý bưu cục kiểm đếm đủ & Bấm 'Xác nhận'
    COMPLETED --> [*]: KHÓA DỮ LIỆU PHIẾU VĨNH VIỄN (CẤM SỬA/XÓA)

    [*] --> CHO_THU_HOI: Bưu cục viết phiếu thu hồi thiết bị hỏng
    CHO_THU_HOI --> DA_THU_HOI: Thủ kho nhận máy hỏng, giám định & duyệt phiếu
    DA_THU_HOI --> [*]
```
