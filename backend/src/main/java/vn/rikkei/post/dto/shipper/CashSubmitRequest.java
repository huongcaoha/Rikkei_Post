package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashSubmitRequest {
    private BigDecimal amountSubmitted;
    private LocalDate shiftDate;
    @Builder.Default
    private String paymentMethod = "PAYOS"; // "PAYOS" or "CASH"
    private String notes;
    private String returnUrl;
    private String cancelUrl;
    private List<String> trackingCodes;
}
