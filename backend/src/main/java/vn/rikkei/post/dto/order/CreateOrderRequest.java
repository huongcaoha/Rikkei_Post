package vn.rikkei.post.dto.order;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateOrderRequest {

    // Người gửi
    @NotBlank(message = "Tên người gửi không được để trống")
    private String senderName;

    @NotBlank(message = "Số điện thoại người gửi không được để trống")
    private String senderPhone;

    @NotBlank(message = "Địa chỉ người gửi không được để trống")
    private String senderAddress;

    @NotNull(message = "Tỉnh người gửi không được để trống")
    private Integer senderProvinceId;

    private Integer senderDistrictId;

    private Integer senderWardId;

    private String senderWardName;

    @Builder.Default
    private Boolean saveAsDefaultSender = false;

    private Double senderLat;
    private Double senderLng;

    // Người nhận
    @NotBlank(message = "Tên người nhận không được để trống")
    private String receiverName;

    @NotBlank(message = "Số điện thoại người nhận không được để trống")
    private String receiverPhone;

    @NotBlank(message = "Địa chỉ người nhận không được để trống")
    private String receiverAddress;

    @NotNull(message = "Tỉnh người nhận không được để trống")
    private Integer receiverProvinceId;

    private Integer receiverDistrictId;

    private Integer receiverWardId;

    @NotBlank(message = "Tên Xã/Phường người nhận không được để trống")
    private String receiverWardName;

    private Double receiverLat;
    private Double receiverLng;

    // Kiện hàng
    @NotBlank(message = "Tên hàng hóa không được để trống")
    private String itemName;

    @Builder.Default
    private BigDecimal itemValue = BigDecimal.ZERO;

    @NotNull(message = "Trọng lượng không được để trống")
    private Integer actualWeightGram;

    @Builder.Default
    private Integer lengthCm = 10;

    @Builder.Default
    private Integer widthCm = 10;

    @Builder.Default
    private Integer heightCm = 10;

    // Dịch vụ & Thanh toán
    @Builder.Default
    private BigDecimal codAmount = BigDecimal.ZERO;

    @Builder.Default
    private String paymentParty = "RECEIVER"; // "SENDER", "RECEIVER"

    @Builder.Default
    private String serviceType = "STANDARD"; // "STANDARD", "EXPRESS", "ROAD_FREIGHT"

    @Builder.Default
    private String pickupType = "DROP_OFF"; // "DROP_OFF" hoặc "DOOR_PICKUP"

    private String notes;
}
