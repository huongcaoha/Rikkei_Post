package vn.rikkei.post.dto.wms;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SmartSortingResponse {

    private String trackingCode;
    private String itemName;
    private Integer actualWeightGram;
    private Integer billableWeightGram;
    private BigDecimal codAmount;
    private String serviceType;
    private String currentStatus;
    private String routingCode;

    // Thông tin người gửi
    private String senderName;
    private String senderPhone;
    private String senderAddress;
    private String senderProvinceName;

    // Thông tin người nhận
    private String receiverName;
    private String receiverPhone;
    private String receiverAddress;
    private Integer receiverProvinceId;
    private String receiverProvinceName;
    private String receiverWardName;
    private Double receiverLat;
    private Double receiverLng;

    // Kho / Bưu cục điểm cuối sẽ đi giao đơn cho khách (Last-mile Delivery Post Office)
    private Long destinationPostOfficeId;
    private String destinationPostOfficeCode;
    private String destinationPostOfficeName;
    private String destinationPostOfficeAddress;
    private Double destinationPostOfficeLat;
    private Double destinationPostOfficeLng;

    // Gợi ý chia chọn và phân tuyến
    private String sortingZone; // Vd: "HÀ NỘI - BƯU CỤC CẦU GIẤY"
    private String suggestedBinCode; // Vd: "LỒNG-HN-CG"
    private String suggestedAction; // Vd: "Cho vào bao tải/lồng hàng đi Bưu cục Cầu Giấy (SPOKE_HN_CG)"
}
