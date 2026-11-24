package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.tms.CreateManifestRequest;
import vn.rikkei.post.dto.tms.LoadBagToManifestRequest;
import vn.rikkei.post.dto.tms.ManifestResponse;
import vn.rikkei.post.service.ShipmentManifestService;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tms/manifests")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF')")
public class ShipmentManifestController {

    private final ShipmentManifestService manifestService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ManifestResponse>>> getAllManifests() {
        List<ManifestResponse> list = manifestService.getAllManifests();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/hub/{hubId}")
    public ResponseEntity<ApiResponse<List<ManifestResponse>>> getManifestsByHub(@PathVariable Long hubId) {
        List<ManifestResponse> list = manifestService.getManifestsByHub(hubId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ManifestResponse>> getManifestById(@PathVariable Long id) {
        ManifestResponse res = manifestService.getManifestById(id);
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @GetMapping("/code/{code}")
    public ResponseEntity<ApiResponse<ManifestResponse>> getManifestByCode(@PathVariable String code) {
        ManifestResponse res = manifestService.getManifestByCode(code);
        return ResponseEntity.ok(ApiResponse.success(res));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ManifestResponse>> createManifest(
            @Valid @RequestBody CreateManifestRequest request
    ) {
        ManifestResponse res = manifestService.createManifest(request);
        return ResponseEntity.ok(ApiResponse.success(res, "Khởi tạo bảng kê chuyến xe tải thành công"));
    }

    @PostMapping("/{id}/load-bag")
    public ResponseEntity<ApiResponse<ManifestResponse>> loadBag(
            @PathVariable Long id,
            @Valid @RequestBody LoadBagToManifestRequest request
    ) {
        ManifestResponse res = manifestService.loadBagToManifest(id, request);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã nạp bao tải lên chuyến xe"));
    }

    @DeleteMapping("/{id}/bags/{bagCode}")
    public ResponseEntity<ApiResponse<ManifestResponse>> removeBag(
            @PathVariable Long id,
            @PathVariable String bagCode
    ) {
        ManifestResponse res = manifestService.removeBagFromManifest(id, bagCode);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã dỡ bao tải khỏi chuyến xe"));
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<ApiResponse<ManifestResponse>> dispatch(
            @PathVariable Long id
    ) {
        ManifestResponse res = manifestService.dispatchManifest(id);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã khai xuất bến chuyến xe tải thành công"));
    }

    @PostMapping("/{id}/arrive")
    public ResponseEntity<ApiResponse<ManifestResponse>> arrive(
            @PathVariable Long id
    ) {
        ManifestResponse res = manifestService.arriveManifest(id);
        return ResponseEntity.ok(ApiResponse.success(res, "Đã xác nhận chuyến xe cập bến Hub"));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<ApiResponse<ManifestResponse>> complete(
            @PathVariable Long id
    ) {
        ManifestResponse res = manifestService.completeManifest(id);
        return ResponseEntity.ok(ApiResponse.success(res, "Hoàn tất chuyến xe tải"));
    }
}
