package vn.rikkei.post.dto.supply;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class SupplyDto {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateWarehouseRequest {
        @NotBlank(message = "Mã kho không được để trống")
        private String code;

        @NotBlank(message = "Tên kho vật tư không được để trống")
        private String name;

        @NotBlank(message = "Địa chỉ kho không được để trống")
        private String address;

        private String googleMapsUrl;
        private Double latitude;
        private Double longitude;
        private Long managerId;
        private String managerName;
        private String managerPhone;
        private String status; // ACTIVE, MAINTENANCE
        private String notes;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateItemRequest {
        @NotBlank(message = "Mã vật tư không được để trống")
        private String itemCode;

        @NotBlank(message = "Tên vật tư không được để trống")
        private String itemName;

        @NotBlank(message = "Phân loại vật tư không được để trống")
        private String category;

        @NotBlank(message = "Đơn vị tính không được để trống")
        private String unit;

        private String specifications;
        private BigDecimal standardPrice;
        private Integer minStockAlert;
        private Boolean isActive;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TicketItemRequest {
        @NotNull(message = "ID vật tư không được để trống")
        private Long itemId;

        @NotNull(message = "Số lượng không được để trống")
        private Integer quantity;

        private BigDecimal unitPrice;
        private String notes;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateTicketRequest {
        @NotBlank(message = "Loại phiếu không được để trống")
        private String ticketType; // IMPORT, EXPORT

        @NotNull(message = "Kho vật tư không được để trống")
        private Long warehouseId;

        private Long targetPostOfficeId;
        private String targetPostOfficeName;
        private String partnerOrSupplier;
        private String reason;
        private String notes;

        @NotNull(message = "Danh sách vật tư không được rỗng")
        private List<TicketItemRequest> items;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateRecallRequest {
        @NotNull(message = "Kho / Bưu cục báo hỏng không được để trống")
        private Long postOfficeId;

        private String postOfficeName;

        @NotBlank(message = "Tên đồ dùng/máy móc hỏng không được để trống")
        private String equipmentName;

        private Long supplyItemId;
        private Integer quantity;
        private String serialNumber;

        @NotBlank(message = "Mô tả tình trạng hư hỏng không được để trống")
        private String damageDescription;

        private String requesterPhone;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ResolveRecallRequest {
        @NotBlank(message = "Ghi chú hướng xử lý không được để trống")
        private String resolutionNotes; // Hướng xử lý: Sửa chữa, đổi mới, nhập kho phế liệu...
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InventoryDetailDto {
        private Long id;
        private Long warehouseId;
        private String warehouseName;
        private Long itemId;
        private String itemCode;
        private String itemName;
        private String category;
        private String unit;
        private Integer quantity;
        private Integer damagedQuantity;
        private Integer minStockAlert;
        private Boolean isLowStock;
        private LocalDateTime updatedAt;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DashboardStats {
        private long totalWarehouses;
        private long totalItems;
        private long totalInStock;
        private long totalDamaged;
        private long pendingRecallTickets; // Số phiếu chờ thu hồi (CHO_THU_HOI)
        private long resolvedRecallTickets; // Số phiếu đã thu hồi (DA_THU_HOI)
        private long totalImportTickets;
        private long totalExportTickets;
        private List<InventoryDetailDto> lowStockAlerts;
    }
}
