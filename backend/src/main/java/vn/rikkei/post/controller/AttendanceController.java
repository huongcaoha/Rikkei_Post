package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.attendance.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.AttendanceService;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    @PostMapping("/check-in")
    public ResponseEntity<ApiResponse<AttendanceResponse>> checkIn(
            @Valid @RequestBody CheckInRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        AttendanceResponse response = attendanceService.checkIn(request, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response, "Chấm công Check-in thành công!"));
    }

    @PostMapping("/check-out")
    public ResponseEntity<ApiResponse<AttendanceResponse>> checkOut(
            @Valid @RequestBody CheckOutRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        AttendanceResponse response = attendanceService.checkOut(request, currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response, "Chấm công Check-out thành công!"));
    }

    @GetMapping("/today")
    public ResponseEntity<ApiResponse<AttendanceResponse>> getTodayAttendance(
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        AttendanceResponse response = attendanceService.getTodayAttendance(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/my-history")
    public ResponseEntity<ApiResponse<List<AttendanceResponse>>> getMyAttendanceHistory(
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) Integer year,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<AttendanceResponse> list = attendanceService.getMyAttendanceHistory(currentUser.getId(), month, year);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/warehouse/{warehouseId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER', 'ACCOUNTANT')")
    public ResponseEntity<ApiResponse<List<AttendanceResponse>>> getWarehouseAttendance(
            @PathVariable Long warehouseId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        List<AttendanceResponse> list = attendanceService.getWarehouseAttendance(warehouseId, date, currentUser);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PostMapping("/face-profile")
    public ResponseEntity<ApiResponse<FaceProfileResponse>> registerFace(
            @Valid @RequestBody RegisterFaceRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        FaceProfileResponse response = attendanceService.registerOrUpdateFace(request, currentUser.getId(), currentUser);
        return ResponseEntity.ok(ApiResponse.success(response, "Đăng ký khuôn mặt FaceID thành công!"));
    }

    @PostMapping("/face-profile/user/{targetUserId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<FaceProfileResponse>> registerFaceByManager(
            @PathVariable Long targetUserId,
            @Valid @RequestBody RegisterFaceRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        FaceProfileResponse response = attendanceService.registerOrUpdateFaceByManager(request, targetUserId, currentUser);
        return ResponseEntity.ok(ApiResponse.success(response, "Đã cập nhật khuôn mặt FaceID cho nhân viên thành công!"));
    }

    @GetMapping("/face-profile/user/{targetUserId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'BRANCH_MANAGER', 'POST_OFFICE_MANAGER')")
    public ResponseEntity<ApiResponse<FaceProfileResponse>> getFaceProfileByManager(
            @PathVariable Long targetUserId
    ) {
        FaceProfileResponse response = attendanceService.getFaceProfile(targetUserId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/face-profile")
    public ResponseEntity<ApiResponse<FaceProfileResponse>> getFaceProfile(
            @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        FaceProfileResponse response = attendanceService.getFaceProfile(currentUser.getId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
