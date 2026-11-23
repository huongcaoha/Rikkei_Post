package vn.rikkei.post.dto.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BatchOrderRequest {

    @NotEmpty(message = "Danh sách đơn hàng không được rỗng")
    @Valid
    private List<CreateOrderRequest> orders;
}
