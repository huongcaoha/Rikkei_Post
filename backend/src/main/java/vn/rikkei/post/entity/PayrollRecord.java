package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payroll_records", indexes = {
    @Index(name = "idx_payroll_code", columnList = "payroll_code"),
    @Index(name = "idx_payroll_user_period", columnList = "user_id, month, year"),
    @Index(name = "idx_payroll_warehouse_period", columnList = "warehouse_id, month, year"),
    @Index(name = "idx_payroll_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayrollRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "payroll_code", unique = true, nullable = false, length = 40)
    private String payrollCode;

    @Column(name = "month", nullable = false)
    private Integer month;

    @Column(name = "year", nullable = false)
    private Integer year;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "employee_name", length = 100, nullable = false)
    private String employeeName;

    @Column(name = "employee_phone", length = 20)
    private String employeePhone;

    @Column(name = "role_name", length = 50, nullable = false)
    private String roleName;

    @Column(name = "warehouse_id")
    private Long warehouseId;

    @Column(name = "warehouse_name", length = 150)
    private String warehouseName;

    // Chấm công & ngày giờ làm việc thực tế
    @Column(name = "standard_work_days")
    @Builder.Default
    private Integer standardWorkDays = 26;

    @Column(name = "actual_work_days")
    @Builder.Default
    private Double actualWorkDays = 0.0;

    @Column(name = "total_work_hours")
    @Builder.Default
    private Double totalWorkHours = 0.0;

    @Column(name = "overtime_hours")
    @Builder.Default
    private Double overtimeHours = 0.0;

    // Sản lượng logistics thực tế
    @Column(name = "delivered_orders_count")
    @Builder.Default
    private Integer deliveredOrdersCount = 0;

    @Column(name = "picked_orders_count")
    @Builder.Default
    private Integer pickedOrdersCount = 0;

    @Column(name = "total_trip_km")
    @Builder.Default
    private Double totalTripKm = 0.0;

    @Column(name = "sorted_packages_count")
    @Builder.Default
    private Integer sortedPackagesCount = 0;

    // Cấu trúc lương 3P
    @Column(name = "base_salary_p1", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal baseSalaryP1 = BigDecimal.ZERO; // P1 - Vị trí

    @Column(name = "production_salary_p2", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal productionSalaryP2 = BigDecimal.ZERO; // P2 - Sản lượng

    @Column(name = "bonus_kpi_p3", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal bonusKpiP3 = BigDecimal.ZERO; // P3 - Hiệu suất SLA / Doanh thu

    // Phụ cấp
    @Column(name = "fuel_allowance", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal fuelAllowance = BigDecimal.ZERO;

    @Column(name = "phone_allowance", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal phoneAllowance = BigDecimal.ZERO;

    @Column(name = "other_allowances", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal otherAllowances = BigDecimal.ZERO;

    // Khấu trừ & Phạt vi phạm
    @Column(name = "violation_deductions", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal violationDeductions = BigDecimal.ZERO;

    @Column(name = "cod_pending_holding", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal codPendingHolding = BigDecimal.ZERO;

    // Tổng tiền
    @Column(name = "total_gross_salary", precision = 14, scale = 2)
    @Builder.Default
    private BigDecimal totalGrossSalary = BigDecimal.ZERO;

    @Column(name = "net_salary", precision = 14, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal netSalary = BigDecimal.ZERO;

    // Trạng thái theo chu trình 4 bước:
    // GENERATED -> PENDING_MANAGER_APPROVAL -> PENDING_ACCOUNTANT_APPROVAL -> PAID
    @Column(name = "status", length = 40, nullable = false)
    @Builder.Default
    private String status = "GENERATED";

    @Column(name = "ai_explanation", columnDefinition = "TEXT")
    private String aiExplanation;

    @Column(name = "manager_approved_by")
    private Long managerApprovedBy;

    @Column(name = "manager_approved_by_name", length = 100)
    private String managerApprovedByName;

    @Column(name = "manager_approved_at")
    private LocalDateTime managerApprovedAt;

    @Column(name = "accountant_approved_by")
    private Long accountantApprovedBy;

    @Column(name = "accountant_approved_by_name", length = 100)
    private String accountantApprovedByName;

    @Column(name = "accountant_approved_at")
    private LocalDateTime accountantApprovedAt;

    @Column(name = "paid_at")
    private LocalDateTime paidAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
