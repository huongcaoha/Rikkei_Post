package vn.rikkei.post.dto.payroll;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GeneratePayrollRequest {
    @NotNull(message = "Tháng tính lương không được để trống")
    @Min(value = 1, message = "Tháng từ 1 đến 12")
    @Max(value = 12, message = "Tháng từ 1 đến 12")
    private Integer month;

    @NotNull(message = "Năm tính lương không được để trống")
    @Min(value = 2020, message = "Năm không hợp lệ")
    private Integer year;

    private Long warehouseId;
}
