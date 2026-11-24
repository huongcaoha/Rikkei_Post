package vn.rikkei.post.dto.billing;

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
public class ReconciliationSheetResponse {
    private Long id;
    private String sheetCode;
    private Long merchantId;
    private String merchantName;
    private String merchantEmail;
    private LocalDate startDate;
    private LocalDate endDate;
    private Integer totalOrders;
    private BigDecimal totalCod;
    private BigDecimal totalShippingFee;
    private BigDecimal totalInsuranceFee;
    private BigDecimal netPayout;
    private String status;
    private LocalDateTime paidAt;
    private String bankTransactionCode;
    private LocalDateTime createdAt;
}
