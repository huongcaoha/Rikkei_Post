package vn.rikkei.post.dto.wms;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateMasterBagRequest {

    @NotNull(message = "Kho / Bưu cục xuất phát không được để trống")
    private Long originWarehouseId;

    @NotNull(message = "Kho / Hub đích không được để trống")
    private Long destWarehouseId;

    private String notes;
}
