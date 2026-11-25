package vn.rikkei.post.service;

import vn.rikkei.post.dto.attendance.*;
import vn.rikkei.post.security.CustomUserDetails;

import java.time.LocalDate;
import java.util.List;

public interface AttendanceService {
    AttendanceResponse checkIn(CheckInRequest request, Long userId);
    AttendanceResponse checkOut(CheckOutRequest request, Long userId);
    AttendanceResponse getTodayAttendance(Long userId);
    List<AttendanceResponse> getMyAttendanceHistory(Long userId, Integer month, Integer year);
    List<AttendanceResponse> getWarehouseAttendance(Long warehouseId, LocalDate date, CustomUserDetails currentUser);
    FaceProfileResponse registerOrUpdateFace(RegisterFaceRequest request, Long userId);
    FaceProfileResponse getFaceProfile(Long userId);
}
