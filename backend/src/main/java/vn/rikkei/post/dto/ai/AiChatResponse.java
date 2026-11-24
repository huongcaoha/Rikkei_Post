package vn.rikkei.post.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatResponse {
    private String reply;
    private String detectedIntent; // "TRACK_ORDER", "PRICE_CALC", "POST_OFFICE_FIND", "COD_BALANCE", "GENERAL_FAQ"
    private Object structuredData; // Dữ liệu tra cứu tương ứng để UI render card (ví dụ Order info hoặc Hub info)
    private List<String> suggestions; // Các gợi ý câu hỏi tiếp theo
}
