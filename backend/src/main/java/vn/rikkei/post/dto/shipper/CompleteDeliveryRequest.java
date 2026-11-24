package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompleteDeliveryRequest {
    private String trackingCode;
    private String podPhotoUrl;
    private String podSignatureUrl;
    private Double podLatitude;
    private Double podLongitude;
    private String receiverName;
    private String notes;
    private String otpCode;
    private String paymentMethod; // "CASH", "VIETQR"
}
