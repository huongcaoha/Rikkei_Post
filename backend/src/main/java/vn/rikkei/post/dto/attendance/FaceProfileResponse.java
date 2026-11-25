package vn.rikkei.post.dto.attendance;

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
    private boolean isRegistered;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
