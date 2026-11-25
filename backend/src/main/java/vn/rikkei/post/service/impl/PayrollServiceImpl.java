package vn.rikkei.post.service.impl;

import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.payroll.*;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.NotificationService;
import vn.rikkei.post.service.PayrollService;
import vn.rikkei.post.service.WebSocketNotificationService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class PayrollServiceImpl implements PayrollService {

    private final PayrollRecordRepository payrollRepository;
    private final AttendanceRecordRepository attendanceRepository;
    private final OrderRepository orderRepository;
    private final PaymentVoucherRepository voucherRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository warehouseRepository;
    private final NotificationService notificationService;
    private final WebSocketNotificationService webSocketNotificationService;
    private final Random random = new Random();

    @Override
    @Transactional
    public List<PayrollRecordResponse> generateMonthlyPayroll(GeneratePayrollRequest request, CustomUserDetails currentUser) {
        int month = request.getMonth();
        int year = request.getYear();
        LocalDate startMonth = LocalDate.of(year, month, 1);
        LocalDate endMonth = startMonth.plusMonths(1).minusDays(1);
        LocalDateTime startDateTime = startMonth.atStartOfDay();
        LocalDateTime endDateTime = endMonth.atTime(23, 59, 59);

        // Lấy danh sách nhân viên cần tính lương
        List<User> targetUsers = userRepository.findAll().stream()
                .filter(u -> Boolean.TRUE.equals(u.getIsActive()))
                .filter(u -> u.getRoles().stream().anyMatch(r ->
                        !r.getRoleName().equals("ROLE_MERCHANT") || u.getRoles().size() > 1
                ))
                .filter(u -> request.getWarehouseId() == null || request.getWarehouseId().equals(u.getAssignedPostOfficeId()) || u.getAssignedPostOfficeId() == null)
                .toList();

        List<PayrollRecordResponse> results = new ArrayList<>();

        for (User user : targetUsers) {
            String roleName = user.getRoles().stream()
                    .map(Role::getRoleName)
                    .filter(r -> !r.equals("ROLE_MERCHANT"))
                    .findFirst().orElse("ROLE_SHIPPER");

            Warehouse wh = user.getAssignedPostOfficeId() != null
                    ? warehouseRepository.findById(user.getAssignedPostOfficeId()).orElse(null)
                    : null;
            String whName = wh != null ? wh.getName() : "Bưu cục điều hành";
            Long whId = wh != null ? wh.getId() : 1L;

            // 1. Dữ liệu chấm công thực tế
            List<AttendanceRecord> attendanceList = attendanceRepository
                    .findByUserIdAndWorkDateBetweenOrderByWorkDateAsc(user.getId(), startMonth, endMonth);

            double actualWorkDays = attendanceList.stream()
                    .filter(a -> a.getCheckInTime() != null)
                    .count();
            // Nếu là tháng hiện tại và số ngày chấm công ít, áp dụng công chuẩn linh hoạt
            if (actualWorkDays == 0) {
                actualWorkDays = 24.0; // Dự phòng công mẫu chuẩn
            }

            double totalWorkHours = attendanceList.stream()
                    .mapToDouble(a -> a.getWorkHours() != null ? a.getWorkHours() : 8.0)
                    .sum();
            if (totalWorkHours == 0) {
                totalWorkHours = actualWorkDays * 8.0;
            }

            double overtimeHours = Math.max(0.0, totalWorkHours - (actualWorkDays * 8.0));

            // 2. Dữ liệu sản lượng Logistics
            long deliveredOrders = orderRepository.countShipperDeliveredInPeriod(user.getId(), startDateTime, endDateTime);
            long pickedOrders = orderRepository.countShipperPickedInPeriod(user.getId(), startDateTime, endDateTime);
            long failedOrders = orderRepository.countShipperFailedInPeriod(user.getId(), startDateTime, endDateTime);

            // 3. Tính toán theo công thức lương 3P đặc thù logistics
            BigDecimal baseSalaryP1;
            BigDecimal productionSalaryP2 = BigDecimal.ZERO;
            BigDecimal bonusKpiP3 = BigDecimal.ZERO;
            BigDecimal fuelAllowance = BigDecimal.ZERO;
            BigDecimal phoneAllowance = BigDecimal.ZERO;
            BigDecimal otherAllowances = BigDecimal.ZERO;
            BigDecimal violationDeductions = BigDecimal.ZERO;
            double totalTripKm = 0.0;
            int sortedPackages = 0;

            double workRatio = Math.min(1.0, actualWorkDays / 26.0);

            switch (roleName) {
                case "ROLE_SHIPPER" -> {
                    // Bưu tá: Lương khoán sản lượng chiếm 70-85% thu nhập
                    baseSalaryP1 = BigDecimal.valueOf(4500000).multiply(BigDecimal.valueOf(workRatio)).setScale(0, RoundingMode.HALF_UP);

                    // Đơn giá lũy tiến: 500 đơn đầu 4.000đ, từ đơn 501 tính 5.000đ
                    long baseDelivered = Math.min(500, deliveredOrders);
                    long extraDelivered = Math.max(0, deliveredOrders - 500);
                    long deliveryBonus = (baseDelivered * 4000) + (extraDelivered * 5000);
                    long pickupBonus = pickedOrders * 2500;
                    productionSalaryP2 = BigDecimal.valueOf(deliveryBonus + pickupBonus);

                    // Phụ cấp xăng xe & điện thoại
                    fuelAllowance = BigDecimal.valueOf(500000);
                    phoneAllowance = BigDecimal.valueOf(300000);

                    // Thưởng KPI SLA: Tỷ lệ giao thành công >= 95% thưởng 1.000.000 đ
                    long totalShipperOrders = deliveredOrders + failedOrders;
                    if (totalShipperOrders > 0) {
                        double slaRate = (double) deliveredOrders / totalShipperOrders * 100.0;
                        if (slaRate >= 95.0) bonusKpiP3 = BigDecimal.valueOf(1000000);
                        else if (slaRate >= 90.0) bonusKpiP3 = BigDecimal.valueOf(500000);
                    } else {
                        bonusKpiP3 = BigDecimal.valueOf(500000);
                    }

                    violationDeductions = BigDecimal.valueOf(failedOrders * 30000);
                }
                case "ROLE_TRUCK_DRIVER" -> {
                    // Tài xế xe tải: Theo chuyến, số km và lưu đêm
                    baseSalaryP1 = BigDecimal.valueOf(6000000).multiply(BigDecimal.valueOf(workRatio)).setScale(0, RoundingMode.HALF_UP);
                    totalTripKm = actualWorkDays * 65.0; // Trung bình 65km/ngày công
                    productionSalaryP2 = BigDecimal.valueOf(totalTripKm * 3500); // 3.500 đ/km
                    bonusKpiP3 = BigDecimal.valueOf(1500000); // Thưởng lái xe an toàn, không quá tốc độ
                    phoneAllowance = BigDecimal.valueOf(300000);
                    otherAllowances = BigDecimal.valueOf(800000); // Phụ cấp ăn ca, lưu đêm
                }
                case "ROLE_WAREHOUSE_STAFF" -> {
                    // Nhân viên kho / chia chọn: Công ca + sản lượng kiện + phụ cấp ca đêm/OT
                    baseSalaryP1 = BigDecimal.valueOf(6500000).multiply(BigDecimal.valueOf(workRatio)).setScale(0, RoundingMode.HALF_UP);
                    sortedPackages = (int) (actualWorkDays * 420); // Định mức 420 kiện/ngày
                    int extraPackages = Math.max(0, sortedPackages - (int)(actualWorkDays * 350));
                    productionSalaryP2 = BigDecimal.valueOf(extraPackages * 500); // 500 đ/kiện vượt
                    otherAllowances = BigDecimal.valueOf(overtimeHours * 50000 + 500000); // Phụ cấp độc hại & OT
                    bonusKpiP3 = BigDecimal.valueOf(800000); // Thưởng phân loại chính xác, 0 thất thoát
                }
                case "ROLE_POST_OFFICE_MANAGER" -> {
                    // Quản lý bưu cục: Lương vị trí + Thưởng KPI doanh thu bưu cục
                    baseSalaryP1 = BigDecimal.valueOf(10000000).multiply(BigDecimal.valueOf(workRatio)).setScale(0, RoundingMode.HALF_UP);
                    BigDecimal poRevenue = orderRepository.sumPostOfficeRevenueInPeriod(whId, startDateTime, endDateTime);
                    productionSalaryP2 = poRevenue.multiply(BigDecimal.valueOf(0.015)).setScale(0, RoundingMode.HALF_UP); // 1.5% doanh thu
                    bonusKpiP3 = BigDecimal.valueOf(2000000); // Thưởng bưu cục đạt chỉ tiêu SLA
                    phoneAllowance = BigDecimal.valueOf(500000);
                }
                case "ROLE_BRANCH_MANAGER" -> {
                    // Quản lý chi nhánh Tỉnh/TP
                    baseSalaryP1 = BigDecimal.valueOf(15000000).multiply(BigDecimal.valueOf(workRatio)).setScale(0, RoundingMode.HALF_UP);
                    productionSalaryP2 = BigDecimal.valueOf(3000000); // Thưởng tăng trưởng sản lượng tỉnh
                    bonusKpiP3 = BigDecimal.valueOf(3500000);
                    phoneAllowance = BigDecimal.valueOf(800000);
                }
                case "ROLE_ACCOUNTANT" -> {
                    // Kế toán hệ thống
                    baseSalaryP1 = BigDecimal.valueOf(8500000).multiply(BigDecimal.valueOf(workRatio)).setScale(0, RoundingMode.HALF_UP);
                    productionSalaryP2 = BigDecimal.valueOf(1500000); // Năng suất đối soát đúng hạn
                    bonusKpiP3 = BigDecimal.valueOf(1000000);
                    otherAllowances = BigDecimal.valueOf(800000); // Phụ cấp ăn trưa, chứng từ
                }
                default -> {
                    baseSalaryP1 = BigDecimal.valueOf(7000000).multiply(BigDecimal.valueOf(workRatio)).setScale(0, RoundingMode.HALF_UP);
                    productionSalaryP2 = BigDecimal.valueOf(1000000);
                    bonusKpiP3 = BigDecimal.valueOf(500000);
                    phoneAllowance = BigDecimal.valueOf(300000);
                }
            }

            BigDecimal totalGross = baseSalaryP1.add(productionSalaryP2).add(bonusKpiP3)
                    .add(fuelAllowance).add(phoneAllowance).add(otherAllowances);
            BigDecimal netSalary = totalGross.subtract(violationDeductions);
            if (netSalary.compareTo(BigDecimal.ZERO) < 0) {
                netSalary = BigDecimal.ZERO;
            }

            // Tạo mã phiếu lương: PR-yyMM-UserCode
            String payrollCode = String.format("PR-%02d%02d-%04d", year % 100, month, user.getId());

            // AI Explanation
            String aiExplanation = generateAiPayrollExplanation(user.getFullName(), roleName, actualWorkDays,
                    deliveredOrders, pickedOrders, totalTripKm, sortedPackages, baseSalaryP1, productionSalaryP2,
                    bonusKpiP3, fuelAllowance, phoneAllowance, otherAllowances, violationDeductions, netSalary);

            PayrollRecord record = payrollRepository.findByUserIdAndMonthAndYear(user.getId(), month, year)
                    .orElseGet(() -> PayrollRecord.builder()
                            .payrollCode(payrollCode)
                            .month(month)
                            .year(year)
                            .userId(user.getId())
                            .build());

            record.setEmployeeName(user.getFullName());
            record.setEmployeePhone(user.getPhoneNumber());
            record.setRoleName(roleName);
            record.setWarehouseId(whId);
            record.setWarehouseName(whName);
            record.setStandardWorkDays(26);
            record.setActualWorkDays(actualWorkDays);
            record.setTotalWorkHours(totalWorkHours);
            record.setOvertimeHours(overtimeHours);
            record.setDeliveredOrdersCount((int) deliveredOrders);
            record.setPickedOrdersCount((int) pickedOrders);
            record.setTotalTripKm(totalTripKm);
            record.setSortedPackagesCount(sortedPackages);

            record.setBaseSalaryP1(baseSalaryP1);
            record.setProductionSalaryP2(productionSalaryP2);
            record.setBonusKpiP3(bonusKpiP3);
            record.setFuelAllowance(fuelAllowance);
            record.setPhoneAllowance(phoneAllowance);
            record.setOtherAllowances(otherAllowances);
            record.setViolationDeductions(violationDeductions);
            record.setTotalGrossSalary(totalGross);
            record.setNetSalary(netSalary);
            record.setStatus("GENERATED");
            record.setAiExplanation(aiExplanation);

            PayrollRecord saved = payrollRepository.save(record);
            results.add(mapToResponse(saved));
        }

        log.info("AI & Hệ thống đã tạo thành công {} bảng lương tháng {}/{} cho bưu cục ID: {}",
                results.size(), month, year, request.getWarehouseId());

        // Gửi thông báo tới Quản lý kho xem lại và duyệt
        String notifMsg = String.format("AI đã tự động lập %d bảng kê lương tháng %02d/%d theo mô hình 3P. Vui lòng xem xét và duyệt gửi Kế toán!",
                results.size(), month, year);
        notificationService.notifyUsersByRole("ROLE_POST_OFFICE_MANAGER", "Bảng kê lương mới từ AI", notifMsg, "PAYROLL", "/payroll/hub-approval");
        notificationService.notifyUsersByRole("ROLE_BRANCH_MANAGER", "Bảng kê lương mới từ AI", notifMsg, "PAYROLL", "/payroll/hub-approval");

        return results;
    }

    @Override
    @Transactional
    public PayrollRecordResponse managerApprovePayroll(Long payrollId, CustomUserDetails currentUser) {
        PayrollRecord record = payrollRepository.findById(payrollId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng lương ID: " + payrollId));

        record.setStatus("PENDING_ACCOUNTANT_APPROVAL");
        record.setManagerApprovedBy(currentUser.getId());
        record.setManagerApprovedByName(currentUser.getFullName());
        record.setManagerApprovedAt(LocalDateTime.now());

        PayrollRecord saved = payrollRepository.save(record);
        log.info("Quản lý {} đã duyệt bảng lương {} [{}] gửi Kế toán.",
                currentUser.getFullName(), saved.getEmployeeName(), saved.getPayrollCode());

        // Gửi thông báo tới Kế toán
        String notif = String.format("Quản lý kho %s đã duyệt bảng lương [%s] của %s (Thực lĩnh: %,d đ). Vui lòng xét duyệt và giải ngân!",
                currentUser.getFullName(), saved.getPayrollCode(), saved.getEmployeeName(), saved.getNetSalary().longValue());
        notificationService.notifyUsersByRole("ROLE_ACCOUNTANT", "Yêu cầu duyệt lương nhân viên", notif, "PAYROLL", "/accountant/payroll");
        notificationService.notifyUsersByRole("ROLE_ADMIN", "Yêu cầu duyệt lương nhân viên", notif, "PAYROLL", "/accountant/payroll");

        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public PayrollRecordResponse accountantApproveAndDisburse(Long payrollId, CustomUserDetails currentUser) {
        PayrollRecord record = payrollRepository.findById(payrollId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy bảng lương ID: " + payrollId));

        if ("PAID".equalsIgnoreCase(record.getStatus())) {
            throw new IllegalStateException("Bảng lương này đã được chi trả trước đó!");
        }

        record.setStatus("PAID");
        record.setAccountantApprovedBy(currentUser.getId());
        record.setAccountantApprovedByName(currentUser.getFullName());
        record.setAccountantApprovedAt(LocalDateTime.now());
        record.setPaidAt(LocalDateTime.now());

        PayrollRecord saved = payrollRepository.save(record);
        log.info("Kế toán {} đã duyệt chi trả lương cho nhân viên {} [{}], số tiền: {}",
                currentUser.getFullName(), saved.getEmployeeName(), saved.getPayrollCode(), saved.getNetSalary());

        // 1. Tự động hạch toán Phiếu Chi Lương trong hệ thống kế toán
        try {
            PaymentVoucher salaryVoucher = PaymentVoucher.builder()
                    .voucherCode("PC-SALARY-" + saved.getPayrollCode())
                    .voucherType("PAYMENT")
                    .category("SALARY_ADVANCE")
                    .amount(saved.getNetSalary())
                    .title("Chi trả lương tháng " + saved.getMonth() + "/" + saved.getYear() + " - " + saved.getEmployeeName())
                    .description("Thực chi tiền lương tháng theo quyết định phê duyệt của Kế toán " + currentUser.getFullName())
                    .createdByUserId(currentUser.getId())
                    .createdByUserName(currentUser.getFullName())
                    .createdByUserRole("ROLE_ACCOUNTANT")
                    .warehouseId(saved.getWarehouseId())
                    .warehouseName(saved.getWarehouseName())
                    .status("APPROVED")
                    .approvedByUserId(currentUser.getId())
                    .approvedByUserName(currentUser.getFullName())
                    .approvedAt(LocalDateTime.now())
                    .disbursementMethod("INTERNAL_WALLET")
                    .build();
            voucherRepository.save(salaryVoucher);
        } catch (Exception e) {
            log.warn("Không thể tự động sinh phiếu chi lương: {}", e.getMessage());
        }

        // 2. Gửi thông báo tới chính nhân viên được nhận lương
        String msg = String.format("🎉 Ting ting! Lương tháng %02d/%d của bạn đã được Kế toán duyệt và giải ngân thành công. Thực lĩnh: %,d đ. Xem chi tiết phiếu lương tại mục Bảng lương cá nhân.",
                saved.getMonth(), saved.getYear(), saved.getNetSalary().longValue());
        notificationService.createNotification(saved.getUserId(), "Thông báo nhận lương tháng " + saved.getMonth() + "/" + saved.getYear(), msg, "PAYROLL", "/payroll/my");

        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public List<PayrollRecordResponse> batchAccountantApprove(List<Long> payrollIds, CustomUserDetails currentUser) {
        List<PayrollRecordResponse> list = new ArrayList<>();
        for (Long id : payrollIds) {
            try {
                list.add(accountantApproveAndDisburse(id, currentUser));
            } catch (Exception e) {
                log.warn("Lỗi khi duyệt bảng lương #{}: {}", id, e.getMessage());
            }
        }
        return list;
    }

    @Override
    @Transactional(readOnly = true)
    public List<PayrollRecordResponse> getPayrollList(Integer month, Integer year, Long warehouseId, String status, CustomUserDetails currentUser) {
        boolean isAdmin = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        boolean isAccountant = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_ACCOUNTANT".equals(a.getAuthority()));
        boolean isBranchManager = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_BRANCH_MANAGER".equals(a.getAuthority()));
        boolean isPostOfficeManager = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_POST_OFFICE_MANAGER".equals(a.getAuthority()));

        Specification<PayrollRecord> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (month != null) {
                predicates.add(cb.equal(root.get("month"), month));
            }
            if (year != null) {
                predicates.add(cb.equal(root.get("year"), year));
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(root.get("status"), status.trim().toUpperCase()));
            }

            if (isPostOfficeManager && !isAdmin && !isAccountant && currentUser.getAssignedPostOfficeId() != null) {
                predicates.add(cb.equal(root.get("warehouseId"), currentUser.getAssignedPostOfficeId()));
            } else if (warehouseId != null) {
                predicates.add(cb.equal(root.get("warehouseId"), warehouseId));
            }

            query.orderBy(cb.desc(root.get("year")), cb.desc(root.get("month")), cb.asc(root.get("roleName")), cb.asc(root.get("employeeName")));
            return cb.and(predicates.toArray(new Predicate[0]));
        };

        return payrollRepository.findAll(spec).stream().map(this::mapToResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PayrollRecordResponse getMyPayroll(Integer month, Integer year, Long userId) {
        int m = month != null ? month : LocalDate.now().getMonthValue();
        int y = year != null ? year : LocalDate.now().getYear();

        return payrollRepository.findByUserIdAndMonthAndYear(userId, m, y)
                .map(this::mapToResponse)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public AccountantDashboardResponse getAccountantDashboard(LocalDate startDate, LocalDate endDate, CustomUserDetails currentUser) {
        LocalDateTime startDateTime = startDate != null ? startDate.atStartOfDay() : LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime endDateTime = endDate != null ? endDate.atTime(23, 59, 59) : LocalDateTime.now();

        // 1. Tổng tiền COD thu hộ từ khách hàng
        BigDecimal totalCod = orderRepository.sumDeliveredCodAmount(startDateTime, endDateTime);

        // 2. Tổng cước vận chuyển thu được của tất cả đơn hàng
        BigDecimal totalShipping = orderRepository.sumTotalShippingFee(startDateTime, endDateTime);

        // 3. Tổng tiền phải chi trả cho Khách hàng / Shop (sau khi đã trừ cước vận chuyển)
        BigDecimal totalMerchantPayable = totalCod.subtract(totalShipping.multiply(BigDecimal.valueOf(0.35)));
        if (totalMerchantPayable.compareTo(BigDecimal.ZERO) < 0) {
            totalMerchantPayable = BigDecimal.ZERO;
        }

        // 4. Tổng số tiền đã chi (Phiếu chi đã duyệt + Lương nhân viên đã giải ngân)
        BigDecimal approvedPayments = voucherRepository.sumApprovedPayments(startDateTime, endDateTime);
        BigDecimal approvedReceipts = voucherRepository.sumApprovedReceipts(startDateTime, endDateTime);
        BigDecimal paidSalaries = payrollRepository.sumPaidSalaries(startDateTime.getMonthValue(), startDateTime.getYear());
        BigDecimal totalExpenses = approvedPayments.add(paidSalaries);

        // 5. Lợi nhuận ròng tiền ship = Tổng cước thu được - Tổng chi phí hoạt động & lương
        BigDecimal netProfit = totalShipping.subtract(totalExpenses);

        // 6. Số lượng chờ duyệt
        long pendingVouchers = voucherRepository.countByStatus("PENDING");
        long pendingPayroll = payrollRepository.countByStatus("PENDING_ACCOUNTANT_APPROVAL");

        // 7. Thống kê theo danh mục chi
        Map<String, BigDecimal> breakdown = new HashMap<>();
        breakdown.put("Lương & Thưởng nhân sự", paidSalaries);
        breakdown.put("Chi phí vận hành bưu cục", approvedPayments.multiply(BigDecimal.valueOf(0.4)).setScale(0, RoundingMode.HALF_UP));
        breakdown.put("Xăng dầu & Cầu đường", approvedPayments.multiply(BigDecimal.valueOf(0.35)).setScale(0, RoundingMode.HALF_UP));
        breakdown.put("Sửa chữa xe & Thiết bị", approvedPayments.multiply(BigDecimal.valueOf(0.25)).setScale(0, RoundingMode.HALF_UP));

        return AccountantDashboardResponse.builder()
                .totalCodCollected(totalCod)
                .totalMerchantPayable(totalMerchantPayable)
                .totalShippingRevenue(totalShipping)
                .totalExpenses(totalExpenses)
                .netProfit(netProfit)
                .pendingVouchersCount(pendingVouchers)
                .pendingPayrollCount(pendingPayroll)
                .approvedReceiptsAmount(approvedReceipts)
                .approvedPaymentsAmount(approvedPayments)
                .paidSalariesAmount(paidSalaries)
                .expenseBreakdownByCategory(breakdown)
                .build();
    }

    private String generateAiPayrollExplanation(
            String name, String role, double workDays, long delivered, long picked,
            double km, int sorted, BigDecimal p1, BigDecimal p2, BigDecimal p3,
            BigDecimal fuel, BigDecimal phone, BigDecimal other, BigDecimal deductions, BigDecimal net
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append("### 🤖 Báo cáo giải trình tính lương thông minh (Chuẩn 3P Logistics)\n\n");
        sb.append(String.format("- **Họ tên**: %s | **Vị trí**: `%s`\n", name, role));
        sb.append(String.format("- **Ngày công thực tế**: **%.1f** / 26 công chuẩn (tính từ máy chấm công FaceID & GPS).\n\n", workDays));

        sb.append("#### 1. Cấu trúc lương 3P:\n");
        sb.append(String.format("- **P1 (Vị trí / Lương cứng)**: %,d đ\n", p1.longValue()));
        sb.append(String.format("- **P2 (Lương sản lượng)**: %,d đ\n", p2.longValue()));
        if ("ROLE_SHIPPER".equals(role)) {
            sb.append(String.format("  * Số đơn giao thành công: %d đơn\n", delivered));
            sb.append(String.format("  * Số đơn lấy hàng thành công: %d đơn\n", picked));
        } else if ("ROLE_TRUCK_DRIVER".equals(role)) {
            sb.append(String.format("  * Quãng đường luân chuyển: %.1f km\n", km));
        } else if ("ROLE_WAREHOUSE_STAFF".equals(role)) {
            sb.append(String.format("  * Số kiện/bao chia chọn: %d kiện\n", sorted));
        }
        sb.append(String.format("- **P3 (Thưởng hiệu quả KPI & SLA)**: %,d đ\n\n", p3.longValue()));

        sb.append("#### 2. Phụ cấp & Khấu trừ:\n");
        long totalAllowance = fuel.add(phone).add(other).longValue();
        sb.append(String.format("- **Tổng phụ cấp**: %,d đ (Xăng xe: %,d đ, Điện thoại: %,d đ, Khác: %,d đ)\n",
                totalAllowance, fuel.longValue(), phone.longValue(), other.longValue()));
        if (deductions.compareTo(BigDecimal.ZERO) > 0) {
            sb.append(String.format("- **Khấu trừ vi phạm / Giao trễ**: -%,d đ\n", deductions.longValue()));
        }

        sb.append(String.format("\n💰 **THỰC LĨNH**: **%,d đ**", net.longValue()));
        return sb.toString();
    }

    private PayrollRecordResponse mapToResponse(PayrollRecord r) {
        return PayrollRecordResponse.builder()
                .id(r.getId())
                .payrollCode(r.getPayrollCode())
                .month(r.getMonth())
                .year(r.getYear())
                .userId(r.getUserId())
                .employeeName(r.getEmployeeName())
                .employeePhone(r.getEmployeePhone())
                .roleName(r.getRoleName())
                .warehouseId(r.getWarehouseId())
                .warehouseName(r.getWarehouseName())
                .standardWorkDays(r.getStandardWorkDays())
                .actualWorkDays(r.getActualWorkDays())
                .totalWorkHours(r.getTotalWorkHours())
                .overtimeHours(r.getOvertimeHours())
                .deliveredOrdersCount(r.getDeliveredOrdersCount())
                .pickedOrdersCount(r.getPickedOrdersCount())
                .totalTripKm(r.getTotalTripKm())
                .sortedPackagesCount(r.getSortedPackagesCount())
                .baseSalaryP1(r.getBaseSalaryP1())
                .productionSalaryP2(r.getProductionSalaryP2())
                .bonusKpiP3(r.getBonusKpiP3())
                .fuelAllowance(r.getFuelAllowance())
                .phoneAllowance(r.getPhoneAllowance())
                .otherAllowances(r.getOtherAllowances())
                .violationDeductions(r.getViolationDeductions())
                .codPendingHolding(r.getCodPendingHolding())
                .totalGrossSalary(r.getTotalGrossSalary())
                .netSalary(r.getNetSalary())
                .status(r.getStatus())
                .aiExplanation(r.getAiExplanation())
                .managerApprovedBy(r.getManagerApprovedBy())
                .managerApprovedByName(r.getManagerApprovedByName())
                .managerApprovedAt(r.getManagerApprovedAt())
                .accountantApprovedBy(r.getAccountantApprovedBy())
                .accountantApprovedByName(r.getAccountantApprovedByName())
                .accountantApprovedAt(r.getAccountantApprovedAt())
                .paidAt(r.getPaidAt())
                .createdAt(r.getCreatedAt())
                .updatedAt(r.getUpdatedAt())
                .build();
    }
}
