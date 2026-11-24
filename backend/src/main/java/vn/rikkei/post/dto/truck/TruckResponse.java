package vn.rikkei.post.dto.truck;

import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TruckResponse {

    private Long id;
    private String truckType;
    private Double payloadKg;
    private String licensePlate;
    private Long currentWarehouseId;
    private String currentWarehouseName;
    private String currentWarehouseCode;
    private String currentWarehouseType;
    private String status;
    private String statusDescription;
    private Long currentDriverId;
    private String currentDriverName;
    private String currentDriverPhone;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
