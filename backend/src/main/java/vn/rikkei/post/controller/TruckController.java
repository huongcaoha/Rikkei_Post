package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.truck.CreateTruckRequest;
import vn.rikkei.post.dto.truck.TruckResponse;
import vn.rikkei.post.dto.truck.UpdateTruckRequest;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.TruckService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/trucks")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'WAREHOUSE_STAFF', 'TRUCK_DRIVER')")
public class TruckController {

    private final TruckService truckService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<TruckResponse>>> getAllTrucks(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword
    ) {
        List<TruckResponse> trucks = truckService.getAllTrucks(warehouseId, status, keyword);
        return ResponseEntity.ok(ApiResponse.success(trucks));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TruckResponse>> getTruckById(@PathVariable Long id) {
        TruckResponse response = truckService.getTruckById(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<ApiResponse<TruckResponse>> createTruck(
            @Valid @RequestBody CreateTruckRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        TruckResponse response = truckService.createTruck(request, userId);
        return ResponseEntity.ok(ApiResponse.success(response, "Thêm mới xe tải thành công"));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER')")
    public ResponseEntity<ApiResponse<TruckResponse>> updateTruck(
            @PathVariable Long id,
            @Valid @RequestBody UpdateTruckRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        TruckResponse response = truckService.updateTruck(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(response, "Cập nhật thông tin xe tải thành công"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteTruck(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        truckService.deleteTruck(id, userId);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa xe tải thành công"));
    }

    @PostMapping("/{id}/assign-driver")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<TruckResponse>> assignDriver(
            @PathVariable Long id,
            @RequestBody Map<String, Long> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        Long driverId = payload.get("driverId");
        TruckResponse response = truckService.assignDriver(id, driverId, userId);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã gán tài xế phụ trách xe thành công"));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ApiResponse<TruckResponse>> updateStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        String status = payload.get("status");
        TruckResponse response = truckService.updateStatus(id, status, userId);
        return ResponseEntity.ok(ApiResponse.success(response, "Cập nhật trạng thái xe tải thành công"));
    }

    @GetMapping("/drivers")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getTruckDrivers() {
        List<User> drivers = userRepository.findAll().stream()
                .filter(u -> u.getRoles().stream().anyMatch(r ->
                        "ROLE_TRUCK_DRIVER".equalsIgnoreCase(r.getRoleName())
                                || "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName())
                ))
                .toList();

        List<Map<String, Object>> result = drivers.stream().map(d -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", d.getId());
            map.put("username", d.getUsername());
            map.put("fullName", d.getFullName());
            map.put("phoneNumber", d.getPhoneNumber());
            map.put("postOfficeName", d.getPostOfficeName());
            map.put("assignedPostOfficeId", d.getAssignedPostOfficeId());
            return map;
        }).toList();

        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
