package vn.rikkei.post.dto.wms;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BagItemResponse {

    private Long id;
    private String trackingCode;
    private Integer weightGram;
    private String itemName;
    private String receiverAddress;
    private String routingCode;
    private LocalDateTime scannedAt;
}
