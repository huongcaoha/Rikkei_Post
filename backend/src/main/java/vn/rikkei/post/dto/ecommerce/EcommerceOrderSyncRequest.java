package vn.rikkei.post.dto.ecommerce;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EcommerceOrderSyncRequest {

    @NotBlank(message = "Mã đơn hàng trên sàn TMĐT không được để trống (ví dụ: SHOPEE_20261125_001)")
    private String ecommerceOrderId;

    private String platform; // SHOPEE, LAZADA, TIKTOK, TIKI

    // Thông tin người gửi (Shop)
    @NotBlank(message = "Tên người gửi (Shop) không được để trống")
    private String senderName;

    @NotBlank(message = "Số điện thoại người gửi không được để trống")
    private String senderPhone;

    @NotBlank(message = "Địa chỉ lấy hàng của Shop không được để trống")
    private String senderAddress;

    @NotNull(message = "Mã tỉnh thành người gửi không được để trống")
    private Integer senderProvinceId;

    private Integer senderDistrictId;
    private String senderWardName;

    // Thông tin người nhận (Khách mua hàng)
    @NotBlank(message = "Tên người nhận không được để trống")
    private String receiverName;

    @NotBlank(message = "Số điện thoại người nhận không được để trống")
    private String receiverPhone;

    @NotBlank(message = "Địa chỉ nhận hàng không được để trống")
    private String receiverAddress;

    @NotNull(message = "Mã tỉnh thành người nhận không được để trống")
    private Integer receiverProvinceId;

    private Integer receiverDistrictId;

    @NotBlank(message = "Tên phường/xã người nhận không được để trống")
    private String receiverWardName;

    // Hàng hóa
    @NotBlank(message = "Tên kiện hàng không được để trống")
    private String itemName;

    @Builder.Default
    private BigDecimal itemValue = BigDecimal.ZERO;

    @NotNull(message = "Khối lượng hàng hóa (gram) không được để trống")
    private Integer actualWeightGram;

    @Builder.Default
    private Integer lengthCm = 15;

    @Builder.Default
    private Integer widthCm = 15;

    @Builder.Default
    private Integer heightCm = 10;

    // COD & Cước
    @Builder.Default
    private BigDecimal codAmount = BigDecimal.ZERO;

    @Builder.Default
    private String paymentParty = "RECEIVER"; // "SENDER", "RECEIVER"

    @Builder.Default
    private String serviceType = "STANDARD"; // "STANDARD", "EXPRESS"

    private String notes;
}
