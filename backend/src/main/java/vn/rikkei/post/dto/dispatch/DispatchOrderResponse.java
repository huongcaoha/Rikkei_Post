package vn.rikkei.post.dto.dispatch;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchOrderResponse {
    private Long id;
    private String dispatchCode;
    private Long originWarehouseId;
    private String originWarehouseName;
    private String originWarehouseCode;
    private Long destWarehouseId;
    private String destWarehouseName;
    private String destWarehouseCode;
    private Long driverId;
    private String driverName;
    private String driverPhone;
    private Long truckId;
    private String truckPlate;
    private String status;
    private String statusDescription;
    private Integer totalBags;
    private BigDecimal totalWeightKg;
    private Integer totalItems;
    private String notes;
    private LocalDateTime departureTime;
    private LocalDateTime completedTime;
    private Long createdUserId;
    private String createdUserName;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<DispatchOrderItemResponse> items;
}
