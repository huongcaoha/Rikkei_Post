package vn.rikkei.post.dto.carrier;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CarrierTripResponse {
    private Long id;
    private String tripCode;
    private Long carrierId;
    private String carrierName;
    private String manifestCode;
    private Long sourceHubId;
    private String sourceHubName;
    private Long destinationHubId;
    private String destinationHubName;
    private String driverName;
    private String driverPhone;
    private String licensePlate;
    private Double distanceKm;
    private BigDecimal tripCost;
    private LocalDateTime departureTime;
    private LocalDateTime estimatedArrivalTime;
    private LocalDateTime actualArrivalTime;
    private String status;
    private Boolean slaCompliant;
    private LocalDateTime createdAt;
}
