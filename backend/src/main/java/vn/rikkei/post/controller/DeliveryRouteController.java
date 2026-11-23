package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.entity.DeliveryRoute;
import vn.rikkei.post.service.DeliveryRouteService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/routes")
@RequiredArgsConstructor
public class DeliveryRouteController {

    private final DeliveryRouteService routeService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DeliveryRoute>>> getRoutes(
            @RequestParam(required = false) Integer provinceId,
            @RequestParam(required = false) Long postOfficeId,
            @RequestParam(required = false) Long shipperId
    ) {
        List<DeliveryRoute> list = routeService.getRoutes(provinceId, postOfficeId, shipperId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryRoute>> getRouteById(@PathVariable Long id) {
        DeliveryRoute route = routeService.getRouteById(id);
        return ResponseEntity.ok(ApiResponse.success(route));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DeliveryRoute>> createRoute(@RequestBody DeliveryRoute route) {
        DeliveryRoute created = routeService.createRoute(route);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(created, "Tạo tuyến đường thành công"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DeliveryRoute>> updateRoute(
            @PathVariable Long id,
            @RequestBody DeliveryRoute route
    ) {
        DeliveryRoute updated = routeService.updateRoute(id, route);
        return ResponseEntity.ok(ApiResponse.success(updated, "Cập nhật tuyến đường thành công"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRoute(@PathVariable Long id) {
        routeService.deleteRoute(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa tuyến đường thành công"));
    }

    @PostMapping("/{id}/assign-shipper")
    public ResponseEntity<ApiResponse<DeliveryRoute>> assignShipper(
            @PathVariable Long id,
            @RequestParam Long shipperId
    ) {
        DeliveryRoute updated = routeService.assignShipper(id, shipperId);
        return ResponseEntity.ok(ApiResponse.success(updated, "Gán bưu tá phụ trách tuyến thành công"));
    }
}
