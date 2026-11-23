package vn.rikkei.post.dto.order;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderResponse {
    private Long id;
    private String trackingCode;
    private Long merchantId;

    private String senderName;
    private String senderPhone;
    private String senderAddress;
    private Integer senderProvinceId;
    private String senderWardName;

    private String receiverName;
    private String receiverPhone;
    private String receiverAddress;
    private Integer receiverProvinceId;
    private String receiverWardName;

    private String itemName;
    private BigDecimal itemValue;
    private Integer actualWeightGram;
    private Integer volumetricWeightGram;
    private Integer billableWeightGram;

    private BigDecimal shippingFee;
    private BigDecimal insuranceFee;
    private BigDecimal totalFee;
    private BigDecimal codAmount;
    private String paymentParty;
    private String serviceType;
    private String pickupType;
    private BigDecimal pickupFee;

    private String routingCode;
    private String currentStatus;
    private Integer deliveryAttempts;
    private String notes;

    // Phân bổ Tuyến & Bưu tá
    private Long assignedShipperId;
    private String assignedShipperName;
    private String assignedShipperPhone;
    private Long assignedPostOfficeId;
    private Long assignedRouteId;
    private LocalDateTime pickupCompletedAt;
    private LocalDateTime deliveredAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
