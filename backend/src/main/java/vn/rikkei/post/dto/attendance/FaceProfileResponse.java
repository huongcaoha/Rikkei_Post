package vn.rikkei.post.dto.attendance;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FaceProfileResponse {
    private Long id;
    private Long userId;
    private String facePhotoUrl;

    @JsonProperty("isRegistered")
    private boolean isRegistered;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @JsonProperty("registered")
    public boolean getRegistered() {
        return isRegistered;
    }
}
