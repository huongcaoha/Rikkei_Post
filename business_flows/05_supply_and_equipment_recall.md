# 05. QUẢN LÝ VẬT TƯ, THIẾT BỊ DOANH NGHIỆP & THU HỒI ĐỒ HỎNG
## HỆ THỐNG RIKKEI POST WMS LOGISTICS

---

## 📌 1. Tổng Quan Quản Lý Tài Sản & Thiết Bị Hiện Trường

Mỗi bưu cục và trung tâm khai thác của Rikkei Post được trang bị một hệ thống trang thiết bị chuyên dụng phục vụ vận hành:
- **Trang thiết bị đo đếm & in ấn:** Cân điện tử bưu chính (30kg, 100kg, 500kg), Máy in nhiệt tem nhãn A6/A7, Máy quét mã vạch 2D cầm tay không dây.
- **Vật tư tiêu hao vận hành:** Dây kẹp chì niêm phong an ninh (Security Plastic Seals), Bao tải bưu chính Master Bag (loại 1m x 1.2m chống thấm), Giấy in nhiệt 3 lớp chống bay mực.
- **Đồ bảo hộ & nhận diện:** Đồng phục bưu tá Rikkei Post, Áo mưa bưu chính, Mũ bảo hiểm chuyên dụng.

Để quản lý chặt chẽ chuỗi cung ứng nội bộ, chống thất thoát và đảm bảo thiết bị luôn trong tình trạng hoạt động tốt, hệ thống thiết lập phân hệ **Quản Lý Vật Tư & Trang Thiết Bị Doanh Nghiệp** với đầy đủ vai trò Quản lý kho vật tư (`ROLE_SUPPLY_WAREHOUSE_MANAGER`), quản lý kho vật tư Google Maps và quy trình xuất - nhập - thu hồi thiết bị hỏng hai chiều.

---

## 🔄 2. Sơ Đồ Quy Trình Xuất Cấp Phát & Thu Hồi Vật Tư (Flowchart)

```mermaid
flowchart TD
    classDef startNode fill:#e0f2fe,stroke:#0284c7,stroke-width:2px;
    classDef stepNode fill:#ffffff,stroke:#64748b,stroke-width:1.5px;
    classDef decisionNode fill:#fef3c7,stroke:#d97706,stroke-width:2px;
    classDef highlightNode fill:#dcfce7,stroke:#16a34a,stroke-width:2px;
    classDef alertNode fill:#fee2e2,stroke:#dc2626,stroke-width:2px;

    subgraph ISSUE_FLOW["LUỒNG 1: XUẤT CẤP PHÁT THIẾT BỊ / VẬT TƯ CHO BƯU CỤC"]
        IssueStart([Bưu cục yêu cầu cấp vật tư]):::startNode --> Issue1[Thủ kho vật tư lập Phiếu Xuất Kho]:::[stepNode]
        Issue1 --> Issue2[Chọn Kho vật tư xuất, Bưu cục nhận, Loại vật tư & Số lượng]:::[stepNode]
        Issue2 --> Issue3[Hệ thống trừ tồn kho tạm tính & sinh phiếu trạng thái: CHO_XAC_NHAN]:::[highlightNode]
        
        Issue3 --> Issue4[Hệ thống gửi Thông báo Realtime đến Quản Lý Bưu Cục Nhận]:::[highlightNode]
        Issue4 --> Issue5[Vật tư được vận chuyển đến Bưu cục đích]:::[stepNode]
        
        Issue5 --> Issue6[Quản lý bưu cục mở phiếu xuất kho, kiểm đếm thực tế]:::[stepNode]
        Issue6 --> CheckCount{Số lượng vật tư đủ & nguyên vẹn?}:::decisionNode
        CheckCount -- Đủ 100% --> Issue7[Bấm nút 'Xác nhận đã nhận đủ đồ']:::[highlightNode]
        CheckCount -- Thiếu/Hỏng hóc --> Issue8[Báo cáo sai lệch cho Thủ kho vật tư xử lý]:::[alertNode]
        
        Issue7 --> Issue9[Phiếu chuyển trạng thái thành: COMPLETED]:::[highlightNode]
        Issue9 --> IssueLock{{QUY TẮC AN TOÀN: Khóa toàn bộ thông tin phiếu, cấm sửa đổi}}:::decisionNode
        IssueLock --> IssueFinish([Hoàn tất cấp phát]):::startNode
    end

    subgraph RECALL_FLOW["LUỒNG 2: THU HỒI ĐỒ DÙNG, MÁY MÓC HỎNG HÓC"]
        RecallStart([Thiết bị tại bưu cục bị hỏng/lỗi]):::startNode --> Recall1[Quản lý bưu cục bấm: + Viết Phiếu Thu Hồi Đồ Hỏng]:::[stepNode]
        Recall1 --> Recall2[Khai báo: Tên thiết bị, Mã seri, Tình trạng hỏng, Ảnh hiện trạng]:::[stepNode]
        Recall2 --> Recall3[Phiếu được tạo với trạng thái: CHO_THU_HOI]:::[highlightNode]
        
        Recall3 --> Recall4[Xe tải gom đồ hỏng mang về Kho Vật Tư trung tâm]:::[stepNode]
        Recall4 --> Recall5[Thủ kho vật tư tiếp nhận thiết bị hỏng, kiểm tra giám định]:::[stepNode]
        
        Recall5 --> CheckRepair{Khả năng sửa chữa / Bảo hành?}:::decisionNode
        CheckRepair -- Sửa được --> Recall6[Gửi nhà sản xuất / Đối tác bảo hành]:::[stepNode]
        CheckRepair -- Hỏng hoàn toàn --> Recall7[Đưa vào kho chờ thanh lý phế liệu]:::[alertNode]
        
        Recall6 --> Recall8[Thủ kho bấm xác nhận -> Trạng thái: DA_THU_HOI]:::[highlightNode]
        Recall7 --> Recall8
        Recall8 --> RecallFinish([Hoàn tất thu hồi]):::startNode
    end
```

---

## 🏛️ 3. Mô Hình Thực Thể & Phân Quyền Kho Vật Tư

### 3.1. Thực thể Kho Vật Tư (`SupplyWarehouse`)
Mỗi kho vật tư đại diện cho một trung tâm lưu trữ và bảo quản vật tư, trang thiết bị của công ty với các thuộc tính:
- `id`: Mã định danh kho vật tư (Primary Key).
- `warehouse_name`: Tên kho (ví dụ: *Tổng Kho Vật Tư Miền Bắc*, *Kho Thiết Bị Miền Nam*).
- `address`: Địa chỉ chi tiết.
- `google_map_location`: Đường dẫn liên kết Google Maps hoặc tọa độ GPS chính xác để xe tải dễ dàng tìm đường nhập - xuất.
- `manager_id`: Khóa ngoại liên kết bảng `users`, xác định ai là Thủ kho chịu trách nhiệm pháp lý cao nhất đối với tài sản trong kho.

### 3.2. Vai Trò Quản Lý Kho Vật Tư (`ROLE_SUPPLY_WAREHOUSE_MANAGER`)
- Hệ thống hỗ trợ vai trò chuyên biệt cho thủ kho vật tư.
- **Trang Dashboard Kho Vật Tư:** Hiển thị tức thời 5 chỉ số KPI:
  1. Tổng số Kho vật tư đang vận hành.
  2. Tổng danh mục loại vật tư (Cân, Máy in, Seal, Bao, Giấy in...).
  3. Tổng số lượng tồn kho khả dụng sẵn sàng cấp phát.
  4. Số lượng Phiếu Chờ Thu Hồi (`CHO_THU_HOI`) cần tiếp nhận.
  5. Số lượng Phiếu Đã Thu Hồi Xong (`DA_THU_HOI`) đã giải quyết.

---

## 🔒 4. Cơ Chế Khóa Phiếu Nghiêm Ngặt Sau Khi Hoàn Thành (Lock-on-Complete)

Để đảm bảo số liệu kế toán vật tư không bị chỉnh sửa hồi tố (Retroactive Tampering), hệ thống áp dụng cơ chế khóa phiếu:
1. Khi Quản lý bưu cục bấm **"Xác nhận đã nhận đủ đồ"**, hệ thống cập nhật:
   - `status` = `COMPLETED`
   - `confirmed_by` = `currentUser.getId()`
   - `confirmed_at` = `LocalDateTime.now()`
2. Sau khi phiếu đạt trạng thái `COMPLETED`:
   - Nút **"Chỉnh sửa phiếu"** và **"Xóa phiếu"** bị ẩn hoàn toàn trên giao diện Frontend.
   - Tại Backend Controller & Service: Bất kỳ API request cập nhật (`PUT /api/supply-tickets/{id}`) nào gửi lên đối với phiếu đã `COMPLETED` sẽ lập tức bị chặn với mã lỗi `400 Bad Request`:
     ```json
     {
       "error": "TICKET_LOCKED",
       "message": "Phiếu xuất nhập kho này đã hoàn tất thành công, không thể chỉnh sửa thông tin!"
     }
     ```
