package vn.rikkei.post.dto.billing;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReconciliationDetailResponse {
    private ReconciliationSheetResponse sheet;
    private List<ReconciliationItemDto> items;
}
