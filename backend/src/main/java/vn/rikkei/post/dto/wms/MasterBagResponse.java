package vn.rikkei.post.dto.wms;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MasterBagResponse {

    private Long id;
    private String bagCode;
    private Long originWarehouseId;
    private String originWarehouseName;
    private Long destWarehouseId;
    private String destWarehouseName;
    private String sealNumber;
    private String status;
    private Integer totalItems;
    private BigDecimal totalWeightKg;
    private Long sealedByUserId;
    private String sealedByUserName;
    private LocalDateTime sealedAt;
    private Long manifestId;
    private String manifestCode;
    private String notes;
    private LocalDateTime createdAt;
    private List<BagItemResponse> items;
}
