package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompleteReturnRequest {
    private String trackingCode;
    private String proofPhotoUrl; // Bắt buộc: Chụp ảnh hiện trường bàn giao hàng hoàn cho Shop
    private String receiverName;  // Người đại diện Shop nhận hàng hoàn
    private String notes;         // Ghi chú hoàn trả
    private Double latitude;      // Tọa độ GPS hiện trường
    private Double longitude;     // Tọa độ GPS hiện trường
}
