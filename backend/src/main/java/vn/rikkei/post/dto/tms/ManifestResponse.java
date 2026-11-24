package vn.rikkei.post.dto.tms;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vn.rikkei.post.dto.wms.MasterBagResponse;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ManifestResponse {

    private Long id;
    private String manifestCode;
    private String tripCode;
    private String vehiclePlate;
    private String driverName;
    private String driverPhone;
    private Long originHubId;
    private String originHubName;
    private Long destHubId;
    private String destHubName;
    private String truckSealNumber;
    private LocalDateTime departureScheduledAt;
    private LocalDateTime departureActualAt;
    private LocalDateTime arrivalEstimatedAt;
    private LocalDateTime arrivalActualAt;
    private Integer totalBags;
    private Integer totalPackages;
    private String status;
    private String notes;
    private LocalDateTime createdAt;
    private List<MasterBagResponse> bags;
}
