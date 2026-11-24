package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashSubmissionResponse {
    private Long id;
    private String submissionCode;
    private Long shipperId;
    private String shipperName;
    private String shipperPhone;
    private Long postOfficeId;
    private LocalDate shiftDate;
    private Integer totalOrders;
    private BigDecimal totalCodAmount;
    private BigDecimal totalFeeAmount;
    private BigDecimal totalAmount;
    private BigDecimal amountPaid;
    private String paymentMethod; // "PAYOS" | "CASH"
    private String status;        // "PENDING" | "COMPLETED" | "CANCELLED"
    private Long payosOrderCode;
    private String checkoutUrl;
    private String qrCode;
    private Long approvedBy;
    private String approvedByName;
    private LocalDateTime approvedAt;
    private LocalDateTime paidAt;
    private String notes;
    private LocalDateTime createdAt;
}
