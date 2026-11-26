package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.entity.DeliveryRoute;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.DeliveryRouteService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/routes")
@RequiredArgsConstructor
public class DeliveryRouteController {

    private final DeliveryRouteService routeService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DeliveryRoute>>> getRoutes(
            @RequestParam(required = false) Integer provinceId,
            @RequestParam(required = false) Long postOfficeId,
            @RequestParam(required = false) Long shipperId,
            @RequestParam(required = false) String routeType,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long effectivePostOfficeId = postOfficeId;
        if (userDetails != null) {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null) {
                boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
                if (!isAdmin && user.getAssignedPostOfficeId() != null) {
                    effectivePostOfficeId = user.getAssignedPostOfficeId();
                }
            }
        }
        List<DeliveryRoute> list = routeService.getRoutes(provinceId, effectivePostOfficeId, shipperId, routeType);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryRoute>> getRouteById(@PathVariable Long id) {
        DeliveryRoute route = routeService.getRouteById(id);
        return ResponseEntity.ok(ApiResponse.success(route));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DeliveryRoute>> createRoute(
            @RequestBody DeliveryRoute route,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails != null) {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null) {
                boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
                if (!isAdmin && user.getAssignedPostOfficeId() != null) {
                    route.setPostOfficeId(user.getAssignedPostOfficeId());
                    route.setPostOfficeName(user.getPostOfficeName());
                }
            }
        }
        DeliveryRoute created = routeService.createRoute(route);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created, "Tạo tuyến đường thành công"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryRoute>> updateRoute(
            @PathVariable Long id,
            @RequestBody DeliveryRoute route,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails != null) {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null) {
                boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
                if (!isAdmin && user.getAssignedPostOfficeId() != null) {
                    DeliveryRoute existing = routeService.getRouteById(id);
                    if (!user.getAssignedPostOfficeId().equals(existing.getPostOfficeId())) {
                        throw new AccessDeniedException("Bạn chỉ có quyền chỉnh sửa các tuyến đường trực thuộc kho bưu cục của mình!");
                    }
                    route.setPostOfficeId(user.getAssignedPostOfficeId());
                    route.setPostOfficeName(user.getPostOfficeName());
                }
            }
        }
        DeliveryRoute updated = routeService.updateRoute(id, route);
        return ResponseEntity.ok(ApiResponse.success(updated, "Cập nhật tuyến đường thành công"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRoute(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        if (userDetails != null) {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null) {
                boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
                if (!isAdmin && user.getAssignedPostOfficeId() != null) {
                    DeliveryRoute existing = routeService.getRouteById(id);
                    if (!user.getAssignedPostOfficeId().equals(existing.getPostOfficeId())) {
                        throw new AccessDeniedException("Bạn chỉ có quyền xóa các tuyến đường trực thuộc kho bưu cục của mình!");
                    }
                }
            }
        }
        routeService.deleteRoute(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa tuyến đường thành công"));
    }

    @PostMapping("/{id}/assign-shipper")
    public ResponseEntity<ApiResponse<DeliveryRoute>> assignShipper(
            @PathVariable Long id,
            @RequestParam Long shipperId
    ) {
        DeliveryRoute updated = routeService.assignShipper(id, shipperId);
        return ResponseEntity.ok(ApiResponse.success(updated, "Gán bưu tá/tài xế phụ trách tuyến thành công"));
    }
}
