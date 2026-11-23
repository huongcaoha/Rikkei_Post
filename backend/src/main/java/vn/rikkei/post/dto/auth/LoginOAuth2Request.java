package vn.rikkei.post.dto.auth;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginOAuth2Request {

    @NotBlank(message = "Access token hoặc Auth code không được để trống")
    private String accessToken;

    @NotBlank(message = "Loại nhà cung cấp OAuth2 (google, facebook, github) không được để trống")
    private String type;
}
