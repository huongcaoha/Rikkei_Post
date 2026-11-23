package vn.rikkei.post.dto.auth;

import lombok.*;

import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    private String accessToken;
    @Builder.Default
    private String tokenType = "Bearer";
    private Long userId;
    private String username;
    private String fullName;
    private String phoneNumber;
    private String email;
    private Integer managedProvinceId;
    private String managedProvinceName;
    private Long assignedPostOfficeId;
    private String postOfficeName;
    private Set<String> roles;
}
