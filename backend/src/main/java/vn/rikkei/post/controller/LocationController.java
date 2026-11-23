package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.warehouse.WarehouseRequest;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Ward;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.LocationService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/locations")
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;

    @GetMapping("/provinces")
    public ResponseEntity<ApiResponse<List<Province>>> getProvinces() {
        List<Province> list = locationService.getAllProvinces();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/provinces/{provinceId}/wards")
    public ResponseEntity<ApiResponse<List<Ward>>> getWardsByProvince(@PathVariable Integer provinceId) {
        List<Ward> list = locationService.getWardsByProvinceId(provinceId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/wards/search")
    public ResponseEntity<ApiResponse<List<Ward>>> searchWards(
            @RequestParam(required = false) Integer provinceId,
            @RequestParam(required = false) String keyword
    ) {
        List<Ward> list = locationService.searchWards(provinceId, keyword);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/warehouses")
    public ResponseEntity<ApiResponse<List<Warehouse>>> getWarehouses(
            @RequestParam(required = false) Integer provinceId
    ) {
        List<Warehouse> list = locationService.getWarehouses(provinceId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/warehouses/all")
    public ResponseEntity<ApiResponse<List<Warehouse>>> getAllWarehouses(
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        List<Warehouse> list = locationService.getAllWarehouses(userDetails);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PostMapping("/warehouses")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<ApiResponse<Warehouse>> createWarehouse(
            @Valid @RequestBody WarehouseRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Warehouse warehouse = locationService.createWarehouse(request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(warehouse, "Tạo kho/bưu cục mới thành công!"));
    }

    @PutMapping("/warehouses/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<ApiResponse<Warehouse>> updateWarehouse(
            @PathVariable Long id,
            @Valid @RequestBody WarehouseRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Warehouse warehouse = locationService.updateWarehouse(id, request, userDetails);
        return ResponseEntity.ok(ApiResponse.success(warehouse, "Cập nhật thông tin kho/bưu cục thành công!"));
    }

    @PatchMapping("/warehouses/{id}/toggle-status")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<ApiResponse<Warehouse>> toggleWarehouseStatus(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Warehouse warehouse = locationService.toggleWarehouseStatus(id, userDetails);
        return ResponseEntity.ok(ApiResponse.success(warehouse, "Đổi trạng thái kho/bưu cục thành công!"));
    }
}
