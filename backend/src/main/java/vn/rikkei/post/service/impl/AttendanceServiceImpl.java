package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.rikkei.post.dto.attendance.*;
import vn.rikkei.post.entity.AttendanceRecord;
import vn.rikkei.post.entity.EmployeeFaceProfile;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.AttendanceRecordRepository;
import vn.rikkei.post.repository.EmployeeFaceProfileRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.AttendanceService;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceServiceImpl implements AttendanceService {

    private final AttendanceRecordRepository attendanceRepository;
    private final EmployeeFaceProfileRepository faceProfileRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;

    private static final double MAX_ALLOWED_DISTANCE_KM = 0.8; // Bán kính tối đa 800m quanh kho bưu cục
    private static final double MIN_FACE_SIMILARITY_THRESHOLD = 70.0; // Ngưỡng nhận diện khớp khuôn mặt >= 70%

    @Override
    @Transactional
    public AttendanceResponse checkIn(CheckInRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin nhân viên!"));

        LocalDate today = LocalDate.now();
        Optional<AttendanceRecord> existingOpt = attendanceRepository.findByUserIdAndWorkDate(userId, today);
        if (existingOpt.isPresent() && existingOpt.get().getCheckInTime() != null) {
            throw new IllegalStateException("Bạn đã thực hiện Check-in ngày hôm nay lúc: " + existingOpt.get().getCheckInTime().toLocalTime());
        }

        // 1. Kiểm tra tọa độ GPS từ thiết bị
        if (request.getLat() == null || request.getLng() == null
                || (Math.abs(request.getLat()) < 0.0001 && Math.abs(request.getLng()) < 0.0001)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể xác định tọa độ GPS của bạn! Vui lòng bật định vị trên thiết bị và bấm 'Cập nhật GPS'.");
        }

        // 2. Xác định kho bưu cục và kiểm tra bán kính địa lý (Geofencing)
        Warehouse wh = resolveUserWarehouse(user);
        if (wh == null || wh.getLatitude() == null || wh.getLongitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Tài khoản của bạn chưa được phân công bưu cục công tác hoặc kho chưa có tọa độ GPS! Vui lòng liên hệ quản lý để gán bưu cục trước khi chấm công.");
        }

        double distanceKm = calculateDistanceKm(request.getLat(), request.getLng(), wh.getLatitude(), wh.getLongitude());
        if (distanceKm > MAX_ALLOWED_DISTANCE_KM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Vị trí không hợp lệ! Bạn đang cách kho '%s' %.2f km (vượt quá bán kính cho phép %.2f km / %d mét). Chấm công bị từ chối! Vui lòng có mặt tại kho bưu cục để thực hiện.",
                            wh.getName(), distanceKm, MAX_ALLOWED_DISTANCE_KM, (int) (MAX_ALLOWED_DISTANCE_KM * 1000)));
        }

        // 3. Nhận diện và đối chiếu khuôn mặt FaceID chính chủ
        FaceVerificationResult faceResult = verifyFace(userId, request.getPhotoBase64());
        if (!faceResult.isMatched()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Xác thực khuôn mặt thất bại! Khuôn mặt không khớp với hồ sơ FaceID đã đăng ký (Độ khớp đạt %.1f%%, yêu cầu >= %.1f%%). Vui lòng không chấm công hộ người khác!",
                            faceResult.similarityScore(), MIN_FACE_SIMILARITY_THRESHOLD));
        }

        // 4. Lưu bản ghi chấm công hợp lệ
        LocalDateTime now = LocalDateTime.now();
        String status = now.toLocalTime().isAfter(LocalTime.of(8, 30)) ? "LATE" : "CHECKED_IN";

        String primaryRole = user.getRoles().stream()
                .map(r -> r.getRoleName())
                .filter(r -> !r.equals("ROLE_MERCHANT"))
                .findFirst().orElse("ROLE_SHIPPER");

        AttendanceRecord record = existingOpt.orElseGet(() -> AttendanceRecord.builder()
                .userId(userId)
                .employeeName(user.getFullName())
                .roleName(primaryRole)
                .warehouseId(wh.getId())
                .warehouseName(wh.getName())
                .workDate(today)
                .build());

        record.setCheckInTime(now);
        record.setCheckInPhotoUrl(request.getPhotoBase64());
        record.setCheckInLat(request.getLat());
        record.setCheckInLng(request.getLng());
        record.setDistanceFromWarehouseKm(Math.round(distanceKm * 100.0) / 100.0);
        record.setIsLocationValid(true);
        record.setIsFaceMatched(true);
        record.setFaceMatchConfidence(faceResult.similarityScore());
        record.setStatus(status);
        record.setNotes(request.getNotes() != null ? request.getNotes().trim() : null);

        AttendanceRecord saved = attendanceRepository.save(record);
        log.info("Nhân viên {} check-in thành công: kho={}, status={}, distance={}km, faceMatch={}%",
                user.getFullName(), wh.getName(), status, record.getDistanceFromWarehouseKm(), faceResult.similarityScore());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public AttendanceResponse checkOut(CheckOutRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin nhân viên!"));

        LocalDate today = LocalDate.now();
        AttendanceRecord record = attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .orElseThrow(() -> new IllegalStateException("Bạn chưa thực hiện Check-in ngày hôm nay! Vui lòng Check-in trước khi Check-out."));

        if (record.getCheckOutTime() != null) {
            throw new IllegalStateException("Bạn đã hoàn thành Check-out ngày hôm nay lúc: " + record.getCheckOutTime().toLocalTime());
        }

        // 1. Kiểm tra tọa độ GPS từ thiết bị
        if (request.getLat() == null || request.getLng() == null
                || (Math.abs(request.getLat()) < 0.0001 && Math.abs(request.getLng()) < 0.0001)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể xác định tọa độ GPS của bạn! Vui lòng bật định vị trên thiết bị và bấm 'Cập nhật GPS'.");
        }

        // 2. Xác định kho bưu cục và kiểm tra bán kính địa lý (Geofencing)
        Warehouse wh = resolveUserWarehouse(user);
        if (wh == null || wh.getLatitude() == null || wh.getLongitude() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Tài khoản của bạn chưa được phân công bưu cục công tác hoặc kho chưa có tọa độ GPS! Vui lòng liên hệ quản lý để gán bưu cục trước khi chấm công.");
        }

        double distanceKm = calculateDistanceKm(request.getLat(), request.getLng(), wh.getLatitude(), wh.getLongitude());
        if (distanceKm > MAX_ALLOWED_DISTANCE_KM) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Vị trí không hợp lệ! Bạn đang cách kho '%s' %.2f km (vượt quá bán kính cho phép %.2f km / %d mét). Chấm công bị từ chối! Vui lòng có mặt tại kho bưu cục để thực hiện.",
                            wh.getName(), distanceKm, MAX_ALLOWED_DISTANCE_KM, (int) (MAX_ALLOWED_DISTANCE_KM * 1000)));
        }

        // 3. Nhận diện và đối chiếu khuôn mặt FaceID chính chủ
        FaceVerificationResult faceResult = verifyFace(userId, request.getPhotoBase64());
        if (!faceResult.isMatched()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Xác thực khuôn mặt thất bại! Khuôn mặt không khớp với hồ sơ FaceID đã đăng ký (Độ khớp đạt %.1f%%, yêu cầu >= %.1f%%). Vui lòng không chấm công hộ người khác!",
                            faceResult.similarityScore(), MIN_FACE_SIMILARITY_THRESHOLD));
        }

        // 4. Lưu bản ghi Check-out hợp lệ và tính thời gian làm việc
        LocalDateTime now = LocalDateTime.now();
        record.setCheckOutTime(now);
        record.setCheckOutPhotoUrl(request.getPhotoBase64());
        record.setCheckOutLat(request.getLat());
        record.setCheckOutLng(request.getLng());

        if (record.getCheckInTime() != null) {
            Duration duration = Duration.between(record.getCheckInTime(), now);
            double hours = (double) duration.toMinutes() / 60.0;
            record.setWorkHours(BigDecimal.valueOf(hours).setScale(2, RoundingMode.HALF_UP).doubleValue());
        }

        String status = now.toLocalTime().isBefore(LocalTime.of(17, 0)) ? "EARLY_LEAVE" : "COMPLETED";
        record.setStatus(status);

        if (request.getNotes() != null && !request.getNotes().isBlank()) {
            String currentNotes = record.getNotes() != null ? record.getNotes() + " | " : "";
            record.setNotes(currentNotes + "Checkout note: " + request.getNotes().trim());
        }

        AttendanceRecord saved = attendanceRepository.save(record);
        log.info("Nhân viên {} check-out thành công: status={}, workHours={}",
                user.getFullName(), status, record.getWorkHours());
        return mapToResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public AttendanceResponse getTodayAttendance(Long userId) {
        LocalDate today = LocalDate.now();
        return attendanceRepository.findByUserIdAndWorkDate(userId, today)
                .map(this::mapToResponse)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceResponse> getMyAttendanceHistory(Long userId, Integer month, Integer year) {
        int m = month != null ? month : LocalDate.now().getMonthValue();
        int y = year != null ? year : LocalDate.now().getYear();

        LocalDate startDate = LocalDate.of(y, m, 1);
        LocalDate endDate = startDate.plusMonths(1).minusDays(1);

        return attendanceRepository.findByUserIdAndWorkDateBetweenOrderByWorkDateAsc(userId, startDate, endDate).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AttendanceResponse> getWarehouseAttendance(Long warehouseId, LocalDate date, CustomUserDetails currentUser) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return attendanceRepository.findByWarehouseIdAndWorkDateOrderByCheckInTimeDesc(warehouseId, targetDate).stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional
    public FaceProfileResponse registerOrUpdateFace(RegisterFaceRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy thông tin nhân viên!"));

        if (request.getFacePhotoBase64() == null || request.getFacePhotoBase64().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chụp ảnh khuôn mặt trước khi đăng ký!");
        }

        BufferedImage img = decodeBase64ToImage(request.getFacePhotoBase64());
        if (img == null || img.getWidth() < 50 || img.getHeight() < 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Dữ liệu ảnh khuôn mặt mẫu không hợp lệ! Vui lòng chụp lại rõ nét.");
        }

        EmployeeFaceProfile profile = faceProfileRepository.findByUserId(userId)
                .orElseGet(() -> EmployeeFaceProfile.builder().userId(userId).build());

        profile.setFacePhotoUrl(request.getFacePhotoBase64());
        profile.setFaceFeatures("ENROLLED_DHASH_NCC");

        EmployeeFaceProfile saved = faceProfileRepository.save(profile);
        log.info("Đã cập nhật hồ sơ khuôn mặt nhân viên: {} (ID: {})", user.getFullName(), userId);

        return FaceProfileResponse.builder()
                .id(saved.getId())
                .userId(saved.getUserId())
                .facePhotoUrl(saved.getFacePhotoUrl())
                .isRegistered(true)
                .createdAt(saved.getCreatedAt())
                .updatedAt(saved.getUpdatedAt())
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public FaceProfileResponse getFaceProfile(Long userId) {
        return faceProfileRepository.findByUserId(userId)
                .map(p -> FaceProfileResponse.builder()
                        .id(p.getId())
                        .userId(p.getUserId())
                        .facePhotoUrl(p.getFacePhotoUrl())
                        .isRegistered(true)
                        .createdAt(p.getCreatedAt())
                        .updatedAt(p.getUpdatedAt())
                        .build())
                .orElse(FaceProfileResponse.builder()
                        .userId(userId)
                        .isRegistered(false)
                        .build());
    }

    private Warehouse resolveUserWarehouse(User user) {
        if (user.getAssignedPostOfficeId() != null) {
            Warehouse wh = warehouseRepository.findById(user.getAssignedPostOfficeId()).orElse(null);
            if (wh != null) return wh;
        }
        if (user.getManagedProvinceId() != null) {
            List<Warehouse> list = warehouseRepository.findByProvinceIdAndIsActiveTrue(user.getManagedProvinceId());
            if (!list.isEmpty()) {
                return list.get(0);
            }
        }
        if (user.getPostOfficeName() != null && !user.getPostOfficeName().isBlank()) {
            String pName = user.getPostOfficeName().toLowerCase().trim();
            List<Warehouse> list = warehouseRepository.findByIsActiveTrue();
            for (Warehouse w : list) {
                String wName = w.getName().toLowerCase().trim();
                if (wName.contains(pName) || pName.contains(wName)) {
                    return w;
                }
            }
        }
        List<Warehouse> all = warehouseRepository.findByIsActiveTrue();
        return all.isEmpty() ? null : all.get(0);
    }

    private FaceVerificationResult verifyFace(Long userId, String photoBase64) {
        if (photoBase64 == null || photoBase64.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vui lòng chụp ảnh khuôn mặt trước khi thực hiện chấm công!");
        }

        Optional<EmployeeFaceProfile> profileOpt = faceProfileRepository.findByUserId(userId);
        if (profileOpt.isEmpty() || profileOpt.get().getFacePhotoUrl() == null || profileOpt.get().getFacePhotoUrl().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bạn chưa đăng ký khuôn mặt mẫu FaceID! Vui lòng chuyển sang tab 'Hồ sơ khuôn mặt mẫu' để đăng ký khuôn mặt chính chủ trước khi chấm công.");
        }

        String baselinePhoto = profileOpt.get().getFacePhotoUrl();
        double similarity = computeImageSimilarity(baselinePhoto, photoBase64);
        boolean matched = similarity >= MIN_FACE_SIMILARITY_THRESHOLD;
        return new FaceVerificationResult(matched, similarity);
    }

    /**
     * Thuật toán so khớp tương đồng ảnh khuôn mặt:
     * Kết hợp Difference Hash (dHash 32x32) và Normalized Cross-Correlation (NCC) trên vùng khuôn mặt trung tâm.
     * Trả về độ tương đồng từ 0% đến 100%.
     */
    private double computeImageSimilarity(String imgBase64A, String imgBase64B) {
        try {
            BufferedImage imgA = decodeBase64ToImage(imgBase64A);
            BufferedImage imgB = decodeBase64ToImage(imgBase64B);
            if (imgA == null || imgB == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Dữ liệu ảnh chụp không hợp lệ hoặc không thể phân tích! Vui lòng chụp lại rõ nét.");
            }

            int size = 32;
            int[][] grayA = toGrayscaleMatrix(imgA, size, size);
            int[][] grayB = toGrayscaleMatrix(imgB, size, size);

            // 1. Difference Hash (dHash) trên toàn bộ ma trận (32x31 = 992 bits)
            int dHashDiff = 0;
            int totalDHashBits = size * (size - 1);
            for (int r = 0; r < size; r++) {
                for (int c = 0; c < size - 1; c++) {
                    boolean bitA = grayA[r][c] > grayA[r][c + 1];
                    boolean bitB = grayB[r][c] > grayB[r][c + 1];
                    if (bitA != bitB) {
                        dHashDiff++;
                    }
                }
            }
            double dHashScore = 100.0 * (1.0 - ((double) dHashDiff / totalDHashBits));

            // 2. So sánh vùng trung tâm khuôn mặt (Center 60%: rows 6..25, cols 6..25 = 20x20 pixels)
            // Đây là vùng tập trung các đặc trưng quan trọng: mắt, mũi, miệng
            int centerStart = 6;
            int centerEnd = 26;
            int centerPixels = (centerEnd - centerStart) * (centerEnd - centerStart);
            long sumDiff = 0;
            double meanA = 0;
            double meanB = 0;
            for (int r = centerStart; r < centerEnd; r++) {
                for (int c = centerStart; c < centerEnd; c++) {
                    meanA += grayA[r][c];
                    meanB += grayB[r][c];
                    sumDiff += Math.abs(grayA[r][c] - grayB[r][c]);
                }
            }
            meanA /= centerPixels;
            meanB /= centerPixels;

            // Normalized Cross-Correlation (NCC) trên vùng trung tâm
            double num = 0.0;
            double denA = 0.0;
            double denB = 0.0;
            for (int r = centerStart; r < centerEnd; r++) {
                for (int c = centerStart; c < centerEnd; c++) {
                    double a = grayA[r][c] - meanA;
                    double b = grayB[r][c] - meanB;
                    num += a * b;
                    denA += a * a;
                    denB += b * b;
                }
            }
            double ncc = (denA > 0 && denB > 0) ? (num / (Math.sqrt(denA) * Math.sqrt(denB))) : 0.0;
            double nccScore = Math.max(0.0, Math.min(100.0, ((ncc + 1.0) / 2.0) * 100.0));

            // Pixel Intensity Difference Score trên vùng trung tâm (0-100)
            double avgDiff = (double) sumDiff / centerPixels;
            double pixelDiffScore = Math.max(0.0, 100.0 - (avgDiff / 255.0 * 100.0));

            // Kết hợp có trọng số:
            // 40% dHash cấu trúc đường nét + 35% NCC tương quan + 25% độ tương đồng pixel trung tâm
            double totalScore = (0.40 * dHashScore) + (0.35 * nccScore) + (0.25 * pixelDiffScore);

            // Giới hạn trong khoảng [0.0, 99.9]
            double finalScore = Math.min(99.9, Math.max(0.0, totalScore));
            return Math.round(finalScore * 10.0) / 10.0;
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            log.error("Lỗi thuật toán so khớp khuôn mặt: ", e);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không thể xử lý ảnh khuôn mặt để đối soát! Vui lòng chụp lại rõ nét.");
        }
    }

    private BufferedImage decodeBase64ToImage(String base64Data) {
        try {
            String clean = base64Data;
            if (clean.contains(",")) {
                clean = clean.substring(clean.indexOf(",") + 1);
            }
            byte[] bytes = Base64.getDecoder().decode(clean);
            return ImageIO.read(new ByteArrayInputStream(bytes));
        } catch (Exception e) {
            return null;
        }
    }

    private int[][] toGrayscaleMatrix(BufferedImage src, int width, int height) {
        BufferedImage resized = new BufferedImage(width, height, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g2d = resized.createGraphics();
        g2d.drawImage(src.getScaledInstance(width, height, Image.SCALE_SMOOTH), 0, 0, null);
        g2d.dispose();

        int[][] matrix = new int[height][width];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                matrix[y][x] = resized.getRaster().getSample(x, y, 0);
            }
        }
        return matrix;
    }

    private double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
        final int R = 6371; // Bán kính Trái Đất (km)
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2) * Math.sin(lonDistance / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private AttendanceResponse mapToResponse(AttendanceRecord r) {
        return AttendanceResponse.builder()
                .id(r.getId())
                .userId(r.getUserId())
                .employeeName(r.getEmployeeName())
                .roleName(r.getRoleName())
                .warehouseId(r.getWarehouseId())
                .warehouseName(r.getWarehouseName())
                .workDate(r.getWorkDate())
                .checkInTime(r.getCheckInTime())
                .checkOutTime(r.getCheckOutTime())
                .checkInPhotoUrl(r.getCheckInPhotoUrl())
                .checkOutPhotoUrl(r.getCheckOutPhotoUrl())
                .checkInLat(r.getCheckInLat())
                .checkInLng(r.getCheckInLng())
                .checkOutLat(r.getCheckOutLat())
                .checkOutLng(r.getCheckOutLng())
                .distanceFromWarehouseKm(r.getDistanceFromWarehouseKm())
                .isLocationValid(r.getIsLocationValid())
                .isFaceMatched(r.getIsFaceMatched())
                .faceMatchConfidence(r.getFaceMatchConfidence())
                .workHours(r.getWorkHours())
                .status(r.getStatus())
                .notes(r.getNotes())
                .createdAt(r.getCreatedAt())
                .build();
    }

    private record FaceVerificationResult(boolean isMatched, double similarityScore) {}
}
