package vn.rikkei.post.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Ward;
import vn.rikkei.post.entity.Warehouse;
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
}
