package vn.rikkei.post.dto.network;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NetworkActiveTruckResponse {
    private Long id;
    private String licensePlate;
    private String truckType;
    private Double payloadKg;
    private String status;
    private String driverName;
    private String driverPhone;
    private Long currentWarehouseId;
    private String currentWarehouseName;
    private Double latitude;
    private Double longitude;
}
