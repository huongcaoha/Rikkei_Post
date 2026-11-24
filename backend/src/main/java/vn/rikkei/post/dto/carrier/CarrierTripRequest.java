package vn.rikkei.post.dto.carrier;

import jakarta.validation.constraints.NotNull;
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
public class CarrierTripRequest {
    @NotNull(message = "Đối tác vận tải không được để trống")
    private Long carrierId;

    private String manifestCode;

    @NotNull(message = "Kho / Bưu cục xuất phát không được để trống")
    private Long sourceHubId;

    @NotNull(message = "Kho / Bưu cục đích không được để trống")
    private Long destinationHubId;

    private String driverName;
    private String driverPhone;
    private String licensePlate;
    private Double distanceKm;
    private BigDecimal tripCost;
    private LocalDateTime departureTime;
    private LocalDateTime estimatedArrivalTime;
}
