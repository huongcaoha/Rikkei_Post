package vn.rikkei.post.dto.attendance;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterFaceRequest {
    @NotBlank(message = "Ảnh khuôn mặt mẫu không được để trống")
    private String facePhotoBase64;
    private String faceFeatures;
}
