# 03. LỆNH ĐIỀU VẬN & CỔNG TÁC NGHIỆP TÀI XẾ XE TẢI (TRUCK DRIVER DISPATCH)
## HỆ THỐNG RIKKEI POST WMS LOGISTICS

---

## 📌 1. Bối Cảnh Nghiệp Vụ Điều Vận Đường Trục

Hệ thống vận tải đường trục và trung chuyển liên kho (Inter-hub Transfer) là xương sống kết nối mạng lưới bưu chính Rikkei Post. Để đảm bảo tính minh bạch, an ninh hàng hóa và kỷ luật điều hành, hệ thống áp dụng các nguyên tắc điều vận chặt chẽ:
1. **Phân quyền tạo lệnh nghiêm ngặt:** Chỉ Quản lý bưu cục / kho trung chuyển mới được lập lệnh điều vận. Tài xế xe tải KHÔNG được phép tự tạo lệnh.
2. **Quyền hạn kho trực thuộc:** Quản lý bưu cục nào thì chỉ được điều động tài xế và xe tải trực thuộc kho bưu cục đó.
3. **Bảo mật phân công:** Lệnh điều vận chỉ hiển thị đối với tài xế được gán tên đích danh trong lệnh.
4. **Tác nghiệp bằng Camera điện thoại:** Tài xế không nhập tay danh sách bao hàng; toàn bộ thao tác nạp hàng lên xe tải đều được thực hiện thông qua Camera quét mã Barcode/QR trên tem A6 dán ở bao tải.
5. **Điều kiện hoàn thành chuyến đi:** Chuyến xe chỉ được phép chuyển trạng thái `COMPLETED` khi tất cả bao tải trên xe đã được quét nhập kho thành công tại kho đích.

---

## 🔄 2. Sơ Đồ Phân Quyền & Quy Trình Điều Vận (Swimlane Diagram)

```mermaid
sequenceDiagram
    autonumber
    actor Manager as Quản Lý Bưu Cục Xuất Phát
    participant System as Hệ Thống WMS Rikkei Post
    actor AssignedDriver as Tài Xế Xe Tải Được Phân Công
    actor OtherDriver as Các Tài Xế Khác
    participant DestWarehouse as Kho Bưu Cục Đích

    Note over Manager, System: GIAI ĐOẠN 1: KHỞI TẠO LỆNH ĐIỀU VẬN
    Manager->>System: 1. Đăng nhập Cổng Quản Lý Kho Bưu Cục
    Manager->>System: 2. Mở form 'Khởi Tạo Lệnh Điều Vận Xe & Gom Bao Hàng'
    System-->>Manager: 3. Lọc danh sách: Chỉ cho phép chọn Xe tải & Tài xế TRỰC THUỘC bưu cục đang quản lý
    Manager->>System: 4. Chọn Tuyến đường, Xe tải (biển số), Tài xế và Kho đích đến -> Bấm 'Tạo Lệnh'
    Note over Manager, System: Không có bước quét mã bao tải ở khâu tạo lệnh!

    Note over System, OtherDriver: GIAI ĐOẠN 2: BẢO MẬT HIỂN THỊ LỆNH ĐIỀU VẬN
    OtherDriver->>System: Đăng nhập app tài xế -> Không nhìn thấy lệnh điều vận này
    AssignedDriver->>System: 5. Đăng nhập app tài xế -> Nhìn thấy Chuyến Vận Chuyển được gán tên

    Note over AssignedDriver, System: GIAI ĐOẠN 3: TÁC NGHIỆP QUÉT CAMERA NẠP BAO
    AssignedDriver->>System: 6. Bấm nút 'Thực hiện chuyến đi'
    AssignedDriver->>System: 7. Bấm 'Bật Camera quét mã bao tải'
    loop Quét từng bao tải dán tem A6
        AssignedDriver->>System: Quét Barcode/QR BAG... trên tem dán bao
        System->>System: Kiểm tra bao tải: Gán Driver & Truck vào bao -> Đánh dấu LOADED
        System-->>AssignedDriver: Hiển thị âm thanh 'Bíp' & Tăng số lượng bao đã nạp
    end
    AssignedDriver->>System: 8. Xác nhận xuất phát -> Chuyến xe đổi trạng thái: IN_TRANSIT
    System->>DestWarehouse: Phát sự kiện Kafka / SSE thông báo xe tải đang lăn bánh đến

    Note over AssignedDriver, DestWarehouse: GIAI ĐOẠN 4: NGHIỆM THU CHUYẾN ĐI
    AssignedDriver->>DestWarehouse: 9. Xe tải đến cửa dỡ hàng kho đích
    AssignedDriver->>System: Thử bấm 'Hoàn thành chuyến đi'
    alt Vẫn còn bao tải chưa quét nhập kho đích
        System-->>AssignedDriver: BÁO LỖI: 'Không thể hoàn thành! Vẫn còn X bao tải chưa được nhập kho đích'
    else Tất cả bao tải đã được kho đích quét nhập kho
        DestWarehouse->>System: Quét nhập kho toàn bộ các bao tải của chuyến xe
        AssignedDriver->>System: Bấm 'Hoàn thành chuyến đi' -> Thành công (COMPLETED)
    end
```

---

## 📱 3. Giao Diện & Tính Năng Cổng Tác Nghiệp Tài Xế (Driver Portal)

### 3.1. Chức năng Quét mã bao tải bằng Camera điện thoại
- **Camera trực tiếp trên trình duyệt Web/PWA:** Sử dụng thư viện `Html5Qrcode` cấu hình độ phân giải camera sau (rear facing camera) tối ưu cho việc quét mã vạch 1D và QR 2D.
- **Tốc độ phản hồi:** 
  - Khung quét hình chữ nhật đỏ có đường quét quét laser động.
  - Sau khi quét thành công 1 bao, hệ thống phát âm thanh bíp và hiển thị snackbar thông báo: *"Bao tải BAG2611... đã nạp lên xe tải thành công"*.
  - Khung quét tự động sẵn sàng quét bao tiếp theo mà không cần người dùng phải bấm nút chụp lại.

### 3.2. Cơ chế khóa logic nghiệm thu chuyến xe
Trạng thái chuyến đi trong bảng `dispatch_orders`:
- `CREATED`: Quản lý bưu cục vừa tạo lệnh, chờ tài xế tiếp nhận.
- `LOADING`: Tài xế đã bấm thực hiện, đang mở camera quét nạp các bao tải lên xe.
- `IN_TRANSIT`: Xe đang lăn bánh trên đường thiên lý.
- `COMPLETED`: Chuyến đi kết thúc thành công.

```mermaid
stateDiagram-v2
    [*] --> CREATED: Quản lý bưu cục tạo lệnh
    CREATED --> LOADING: Tài xế bấm 'Thực hiện chuyến đi'
    LOADING --> IN_TRANSIT: Tài xế quét đủ bao & bấm 'Xuất phát'
    IN_TRANSIT --> COMPLETED: 100% bao tải đã nhập kho đích & Tài xế bấm 'Hoàn thành'
    IN_TRANSIT --> IN_TRANSIT: Báo lỗi nếu còn bao chưa nhập kho đích
    COMPLETED --> [*]
```

### 3.3. Thuật toán kiểm tra điều kiện hoàn thành (Completion Guard)

```java
// Logic kiểm tra điều kiện hoàn thành chuyến đi tại Backend DispatchOrderService
@Transactional
public DispatchOrder completeDispatchTrip(Long dispatchOrderId, Long driverId) {
    DispatchOrder order = dispatchOrderRepository.findById(dispatchOrderId)
        .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lệnh điều vận!"));

    // 1. Kiểm tra quyền tài xế
    if (!order.getDriver().getId().equals(driverId)) {
        throw new AccessDeniedException("Bạn không phải tài xế được phân công cho chuyến xe này!");
    }

    // 2. Kiểm tra danh sách bao tải gán với chuyến xe này
    List<MasterBag> bagsOnTruck = masterBagRepository.findByDispatchOrderId(dispatchOrderId);
    long unReceivedCount = bagsOnTruck.stream()
        .filter(bag -> !BagStatus.RECEIVED_AT_DESTINATION.equals(bag.getStatus()) 
                    && !BagStatus.UNPACKED.equals(bag.getStatus()))
        .count();

    if (unReceivedCount > 0) {
        throw new IllegalStateException("Không thể hoàn tất chuyến đi! Vẫn còn " 
            + unReceivedCount + " bao tải chưa được kho đích quét nhập kho.");
    }

    // 3. Cho phép chuyển trạng thái chuyến đi thành COMPLETED
    order.setStatus(DispatchStatus.COMPLETED);
    order.setCompletedAt(LocalDateTime.now());
    return dispatchOrderRepository.save(order);
}
```
