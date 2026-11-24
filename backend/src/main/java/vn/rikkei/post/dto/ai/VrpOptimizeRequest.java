package vn.rikkei.post.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VrpOptimizeRequest {
    private List<String> trackingCodes;
    private Double startLat;
    private Double startLng;
    private String startAddress;
    private Long shipperId;
    private Boolean applyToShipper; // Nếu true, tự động cập nhật thứ tự sequenceOrder cho shipper
}
