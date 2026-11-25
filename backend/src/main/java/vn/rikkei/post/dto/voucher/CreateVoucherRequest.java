package vn.rikkei.post.dto.voucher;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateVoucherRequest {
    @NotBlank(message = "Loại phiếu không được để trống (RECEIPT/PAYMENT)")
    private String voucherType; // "RECEIPT", "PAYMENT"

    @NotBlank(message = "Danh mục chi/thu không được để trống")
    private String category; // "OPERATING_EXPENSE", "OFFICE_SUPPLIES", "VEHICLE_MAINTENANCE", "FUEL_ALLOWANCE", "RENTAL", "SALARY_ADVANCE", "COD_SETTLEMENT", "OTHER"

    @NotNull(message = "Số tiền không được để trống")
    @DecimalMin(value = "1000", message = "Số tiền tối thiểu là 1.000 đ")
    private BigDecimal amount;

    @NotBlank(message = "Tiêu đề phiếu không được để trống")
    private String title;

    private String description;
    private String proofAttachmentUrl;
    private Long warehouseId;
}
