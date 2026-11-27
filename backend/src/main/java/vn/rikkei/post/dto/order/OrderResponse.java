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
    private Double senderLat;
    private Double senderLng;

    private String receiverName;
    private String receiverPhone;
    private String receiverAddress;
    private Integer receiverProvinceId;
    private String receiverWardName;
    private Double receiverLat;
    private Double receiverLng;

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

    // Bằng chứng giao hàng POD & Xác thực
    private String podPhotoUrl;
    private String podSignatureUrl;
    private Double podLatitude;
    private Double podLongitude;
    private String podReceiverName;
    private String deliveryOtp;
    private java.time.LocalDate rescheduledDeliveryDate;
    private String failureProofPhotoUrl;
    private String paymentMethod;

    // Phân bổ Tuyến & Bưu tá
    private Long assignedShipperId;
    private String assignedShipperName;
    private String assignedShipperPhone;
    private Long assignedPostOfficeId;
    private String postOfficeName;
    private Long assignedRouteId;
    private LocalDateTime pickupCompletedAt;
    private LocalDateTime deliveredAt;
    private LocalDateTime estimatedDeliveryAt;

    // Đối soát COD & Nộp tiền cuối ca
    private Boolean isReconciled;
    private String reconciliationSheetCode;
    private Boolean isCashSettled;
    private BigDecimal settledCashAmount;
    private BigDecimal remainingCashAmount;
    private String cashSubmissionCode;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
