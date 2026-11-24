package vn.rikkei.post.dto.truck;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTruckRequest {

    private String truckType;

    private Double payloadKg;

    private String licensePlate;

    private Long currentWarehouseId;

    private String status; // "AT_WAREHOUSE", "IN_TRANSIT", "MAINTENANCE"

    private Long currentDriverId;

    private String notes;
}
