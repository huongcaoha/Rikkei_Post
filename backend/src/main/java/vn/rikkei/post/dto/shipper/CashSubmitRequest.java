package vn.rikkei.post.dto.shipper;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CashSubmitRequest {
    private BigDecimal amountSubmitted;
    private String notes;
}
