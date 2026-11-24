package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Thực thể Bưu gửi / Đơn hàng (Order)
 * Tự động tạo bảng 'orders' với các trường thông tin chuẩn Logistics Hub-and-Spoke
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_orders_tracking_code", columnList = "tracking_code"),
    @Index(name = "idx_orders_merchant_id", columnList = "merchant_id"),
    @Index(name = "idx_orders_current_status", columnList = "current_status"),
    @Index(name = "idx_orders_routing_code", columnList = "routing_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tracking_code", unique = true, nullable = false, length = 30)
    private String trackingCode; // e.g. "RKP261120000001"

    @Column(name = "merchant_id", nullable = false)
    private Long merchantId;

    // --- Thông tin Người gửi ---
    @Column(name = "sender_name", nullable = false, length = 100)
    private String senderName;

    @Column(name = "sender_phone", nullable = false, length = 15)
    private String senderPhone;

    @Column(name = "sender_address", nullable = false, columnDefinition = "TEXT")
    private String senderAddress;

    @Column(name = "sender_province_id", nullable = false)
    private Integer senderProvinceId;

    @Column(name = "sender_district_id")
    private Integer senderDistrictId;

    @Column(name = "sender_ward_id")
    private Integer senderWardId;

    @Column(name = "sender_ward_name", length = 100)
    private String senderWardName;

    @Column(name = "sender_lat")
    private Double senderLat;

    @Column(name = "sender_lng")
    private Double senderLng;

    // --- Thông tin Người nhận ---
    @Column(name = "receiver_name", nullable = false, length = 100)
    private String receiverName;

    @Column(name = "receiver_phone", nullable = false, length = 15)
    private String receiverPhone;

    @Column(name = "receiver_address", nullable = false, columnDefinition = "TEXT")
    private String receiverAddress;

    @Column(name = "receiver_province_id", nullable = false)
    private Integer receiverProvinceId;

    @Column(name = "receiver_district_id")
    private Integer receiverDistrictId;

    @Column(name = "receiver_ward_id")
    private Integer receiverWardId;

    @Column(name = "receiver_ward_name", length = 100)
    private String receiverWardName;

    @Column(name = "receiver_lat")
    private Double receiverLat;

    @Column(name = "receiver_lng")
    private Double receiverLng;

    // --- Thông tin Kiện hàng & Cân nặng ---
    @Column(name = "item_name", nullable = false)
    private String itemName;

    @Column(name = "item_value", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal itemValue = BigDecimal.ZERO;

    @Column(name = "actual_weight_gram", nullable = false)
    private Integer actualWeightGram;

    @Column(name = "length_cm", nullable = false)
    @Builder.Default
    private Integer lengthCm = 10;

    @Column(name = "width_cm", nullable = false)
    @Builder.Default
    private Integer widthCm = 10;

    @Column(name = "height_cm", nullable = false)
    @Builder.Default
    private Integer heightCm = 10;

    @Column(name = "volumetric_weight_gram", nullable = false)
    private Integer volumetricWeightGram;

    @Column(name = "billable_weight_gram", nullable = false)
    private Integer billableWeightGram;

    // --- Cước phí & Thu hộ COD ---
    @Column(name = "shipping_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @Column(name = "insurance_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal insuranceFee = BigDecimal.ZERO;

    @Column(name = "other_surcharge", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal otherSurcharge = BigDecimal.ZERO;

    @Column(name = "total_fee", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal totalFee = BigDecimal.ZERO;

    @Column(name = "cod_amount", precision = 14, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal codAmount = BigDecimal.ZERO;

    @Column(name = "payment_party", nullable = false, length = 20)
    private String paymentParty; // "SENDER", "RECEIVER"

    @Column(name = "service_type", nullable = false, length = 30)
    private String serviceType; // "STANDARD", "EXPRESS", "ROAD_FREIGHT"

    // --- Phương thức lấy hàng: DROP_OFF (Shop gửi tại bưu cục) hoặc DOOR_PICKUP (Bưu tá đến lấy) ---
    @Column(name = "pickup_type", length = 30)
    @Builder.Default
    private String pickupType = "DROP_OFF";

    @Column(name = "pickup_fee", precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal pickupFee = BigDecimal.ZERO;

    // --- Định tuyến & Trạng thái ---
    @Column(name = "routing_code", nullable = false, length = 20)
    private String routingCode; // e.g. "HN-02-HBT"

    @Column(name = "current_status", nullable = false, length = 30)
    @Builder.Default
    private String currentStatus = "CREATED";

    @Column(name = "delivery_attempts", nullable = false)
    @Builder.Default
    private Integer deliveryAttempts = 0;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    // --- Bằng chứng giao hàng POD (Proof of Delivery) & Xác thực OTP ---
    @Column(name = "pod_photo_url", columnDefinition = "TEXT")
    private String podPhotoUrl;

    @Column(name = "pod_signature_url", columnDefinition = "TEXT")
    private String podSignatureUrl;

    @Column(name = "pod_latitude")
    private Double podLatitude;

    @Column(name = "pod_longitude")
    private Double podLongitude;

    @Column(name = "pod_receiver_name", length = 100)
    private String podReceiverName;

    @Column(name = "delivery_otp", length = 10)
    private String deliveryOtp;

    @Column(name = "rescheduled_delivery_date")
    private java.time.LocalDate rescheduledDeliveryDate;

    @Column(name = "failure_proof_photo_url", columnDefinition = "TEXT")
    private String failureProofPhotoUrl;

    @Column(name = "payment_method", length = 30)
    @Builder.Default
    private String paymentMethod = "CASH"; // "CASH", "VIETQR", "BANK_TRANSFER"

    // --- Phân bổ Tuyến & Bưu tá (Shipper Assignment) ---
    @Column(name = "assigned_shipper_id")
    private Long assignedShipperId;

    @Column(name = "assigned_shipper_name", length = 100)
    private String assignedShipperName;

    @Column(name = "assigned_shipper_phone", length = 20)
    private String assignedShipperPhone;

    @Column(name = "assigned_post_office_id")
    private Long assignedPostOfficeId;

    @Column(name = "assigned_route_id")
    private Long assignedRouteId;

    @Column(name = "pickup_completed_at")
    private LocalDateTime pickupCompletedAt;

    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;

    // --- US-19: Đối soát COD & Đối soát Ví Shop ---
    @Column(name = "is_reconciled", columnDefinition = "boolean default false")
    @Builder.Default
    private Boolean isReconciled = false;

    @Column(name = "reconciliation_sheet_code", length = 30)
    private String reconciliationSheetCode;

    // --- US-23: Mô hình AI Dự báo Thời gian Giao hàng (Predictive ETA) ---
    @Column(name = "estimated_delivery_at")
    private LocalDateTime estimatedDeliveryAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
