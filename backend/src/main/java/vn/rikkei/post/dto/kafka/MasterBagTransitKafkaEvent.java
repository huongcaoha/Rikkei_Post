package vn.rikkei.post.dto.kafka;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MasterBagTransitKafkaEvent {

    /**
     * "DEPARTURE_TO_HUB": Tài xế quét nhận bao tải xuất kho trung chuyển đi Hub
     * "ARRIVED_AT_HUB": Nhân viên kho Hub quét nhận bao tải đến nơi
     */
    private String eventType;

    private String bagCode;
    private String sealNumber;

    private Long originWarehouseId;
    private String originWarehouseName;

    private Long destWarehouseId;
    private String destWarehouseName;

    private Long driverId;
    private String driverName;
    private String driverPhone;

    private Long truckId;
    private String truckPlate;

    private Long operatorId;
    private String operatorName;

    private LocalDateTime timestamp;

    private List<String> trackingCodes;
}
