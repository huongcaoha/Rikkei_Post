package vn.rikkei.post.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateReconciliationRequest {
    private Long merchantId;
    private LocalDate startDate;
    private LocalDate endDate;
    private List<String> trackingCodes; // Tuỳ chọn: danh sách mã đơn cụ thể cần đối soát
}
