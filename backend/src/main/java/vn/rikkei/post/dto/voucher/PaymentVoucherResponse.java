package vn.rikkei.post.dto.voucher;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentVoucherResponse {
    private Long id;
    private String voucherCode;
    private String voucherType;
    private String category;
    private BigDecimal amount;
    private String title;
    private String description;
    private String proofAttachmentUrl;
    private Long createdByUserId;
    private String createdByUserName;
    private String createdByUserRole;
    private Long warehouseId;
    private String warehouseName;
    private Integer provinceId;
    private String status;
    private Long approvedByUserId;
    private String approvedByUserName;
    private LocalDateTime approvedAt;
    private String rejectionReason;
    private String disbursementMethod;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
