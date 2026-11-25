package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.ecommerce.CreateChannelRequest;
import vn.rikkei.post.entity.EcommerceChannel;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.EcommerceIntegrationService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ecommerce/channels")
@RequiredArgsConstructor
public class EcommerceChannelController {

    private final EcommerceIntegrationService ecommerceService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EcommerceChannel>>> getChannels(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        List<EcommerceChannel> channels = ecommerceService.getChannels(userId);
        return ResponseEntity.ok(ApiResponse.success(channels, "Tải danh sách kênh kết nối thành công"));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EcommerceChannel>> createChannel(
            @Valid @RequestBody CreateChannelRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        EcommerceChannel channel = ecommerceService.createChannel(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(channel, "Kết nối sàn TMĐT " + channel.getPlatform() + " thành công"));
    }

    @PostMapping("/{id}/regenerate-key")
    public ResponseEntity<ApiResponse<EcommerceChannel>> regenerateKey(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        EcommerceChannel channel = ecommerceService.regenerateApiKey(id, userId);
        return ResponseEntity.ok(ApiResponse.success(channel, "Đã cập nhật lại API Key mới"));
    }

    @PutMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<EcommerceChannel>> toggleStatus(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        EcommerceChannel channel = ecommerceService.toggleChannelStatus(id, userId);
        return ResponseEntity.ok(ApiResponse.success(channel, "Cập nhật trạng thái kênh thành: " + channel.getStatus()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteChannel(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        ecommerceService.deleteChannel(id, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa kết nối sàn TMĐT"));
    }
}
