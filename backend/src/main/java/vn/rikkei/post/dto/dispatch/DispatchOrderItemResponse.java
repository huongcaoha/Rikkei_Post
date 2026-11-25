package vn.rikkei.post.dto.dispatch;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DispatchOrderItemResponse {
    private Long id;
    private Long masterBagId;
    private String bagCode;
    private String sealNumber;
    private String originWarehouseName;
    private String destWarehouseName;
    private String bagStatus;
    private Integer totalItems;
    private BigDecimal weightKg;
    private Boolean isReceivedAtDest;
    private LocalDateTime receivedAt;
    private Long receiverUserId;
    private String receiverUserName;
    private LocalDateTime scannedAt;
}
