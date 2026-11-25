package vn.rikkei.post.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import vn.rikkei.post.dto.attendance.CheckInRequest;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.AttendanceRecordRepository;
import vn.rikkei.post.repository.EmployeeFaceProfileRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.impl.AttendanceServiceImpl;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AttendanceServiceTest {

    @Mock
    private AttendanceRecordRepository attendanceRepository;

    @Mock
    private EmployeeFaceProfileRepository faceProfileRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WarehouseRepository warehouseRepository;

    private AttendanceService attendanceService;

    @BeforeEach
    void setUp() {
        attendanceService = new AttendanceServiceImpl(
                attendanceRepository,
                faceProfileRepository,
                userRepository,
                warehouseRepository
        );
    }

    @Test
    @DisplayName("Từ chối check-in khi vị trí cách xa kho bưu cục (> 800m)")
    void testCheckIn_RejectsFarDistance() {
        User user = User.builder()
                .id(10L)
                .fullName("Nguyễn Văn A")
                .assignedPostOfficeId(1L)
                .roles(Set.of(Role.builder().roleName("ROLE_SHIPPER").build()))
                .build();

        // Kho ở Cầu Giấy Hà Nội (21.0285, 105.7823)
        Warehouse warehouse = Warehouse.builder()
                .id(1L)
                .name("Bưu cục Cầu Giấy")
                .latitude(21.0285)
                .longitude(105.7823)
                .build();

        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(warehouseRepository.findById(1L)).thenReturn(Optional.of(warehouse));

        // Người dùng ở vị trí cách xa kho ~10km (21.1285, 105.8823)
        CheckInRequest request = new CheckInRequest();
        request.setLat(21.1285);
        request.setLng(105.8823);
        request.setPhotoBase64("data:image/jpeg;base64,sample");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            attendanceService.checkIn(request, 10L);
        });

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("Vị trí không hợp lệ"));
    }

    @Test
    @DisplayName("Từ chối check-in khi chưa có hồ sơ khuôn mặt FaceID mẫu")
    void testCheckIn_RejectsWhenNoFaceProfile() {
        User user = User.builder()
                .id(10L)
                .fullName("Nguyễn Văn A")
                .assignedPostOfficeId(1L)
                .roles(Set.of(Role.builder().roleName("ROLE_SHIPPER").build()))
                .build();

        // Kho ở Cầu Giấy Hà Nội
        Warehouse warehouse = Warehouse.builder()
                .id(1L)
                .name("Bưu cục Cầu Giấy")
                .latitude(21.0285)
                .longitude(105.7823)
                .build();

        when(userRepository.findById(10L)).thenReturn(Optional.of(user));
        when(warehouseRepository.findById(1L)).thenReturn(Optional.of(warehouse));
        when(faceProfileRepository.findByUserId(10L)).thenReturn(Optional.empty());

        // Tọa độ hợp lệ (ngay tại kho)
        CheckInRequest request = new CheckInRequest();
        request.setLat(21.0285);
        request.setLng(105.7823);
        request.setPhotoBase64("data:image/jpeg;base64,sample");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            attendanceService.checkIn(request, 10L);
        });

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertTrue(ex.getReason().contains("chưa được Quản lý bưu cục hoặc Admin đăng ký khuôn mặt"));
    }

    @Test
    @DisplayName("Shipper không có quyền tự đăng ký hoặc thay đổi ảnh FaceID (403 Forbidden)")
    void testRegisterFace_ShipperForbidden() {
        User userEntity = User.builder()
                .id(10L)
                .username("shipper1")
                .fullName("Nguyễn Văn Shipper")
                .password("pass")
                .phoneNumber("0912345678")
                .email("shipper@test.com")
                .roles(Set.of(Role.builder().roleName("ROLE_SHIPPER").build()))
                .build();

        vn.rikkei.post.security.CustomUserDetails shipperUser = new vn.rikkei.post.security.CustomUserDetails(userEntity);
        when(userRepository.findById(10L)).thenReturn(Optional.of(userEntity));

        vn.rikkei.post.dto.attendance.RegisterFaceRequest req = new vn.rikkei.post.dto.attendance.RegisterFaceRequest();
        req.setFacePhotoBase64("sample");

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            attendanceService.registerOrUpdateFace(req, 10L, shipperUser);
        });

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("không có quyền tự đăng ký"));
    }
}
