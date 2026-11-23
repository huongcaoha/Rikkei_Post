package vn.rikkei.post.dto.order;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchOrderResponse {
    private int totalSubmitted;
    private int successCount;
    private int failureCount;
    private List<OrderResponse> createdOrders;
    private List<String> errors;
}
