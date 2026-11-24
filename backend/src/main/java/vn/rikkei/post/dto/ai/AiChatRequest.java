package vn.rikkei.post.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatRequest {
    private String message;
    private List<Map<String, String>> history; // [ { "role": "user", "content": "..." }, ... ]
    private Long userId;
}
