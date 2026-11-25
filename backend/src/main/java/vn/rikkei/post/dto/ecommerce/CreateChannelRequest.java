package vn.rikkei.post.dto.ecommerce;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateChannelRequest {

    @NotBlank(message = "Nền tảng sàn TMĐT không được để trống (SHOPEE, LAZADA, TIKTOK, TIKI, CUSTOM)")
    private String platform;

    @NotBlank(message = "Tên gian hàng / kênh kết nối không được để trống")
    private String channelName;

    private String shopId;

    private String webhookUrl;
}
