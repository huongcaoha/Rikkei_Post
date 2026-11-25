package vn.rikkei.post.dto.payroll;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayrollRecordResponse {
    private Long id;
    private String payrollCode;
    private Integer month;
    private Integer year;
    private Long userId;
    private String employeeName;
    private String employeePhone;
    private String roleName;
    private Long warehouseId;
    private String warehouseName;

    private Integer standardWorkDays;
    private Double actualWorkDays;
    private Double totalWorkHours;
    private Double overtimeHours;

    private Integer deliveredOrdersCount;
    private Integer pickedOrdersCount;
    private Double totalTripKm;
    private Integer sortedPackagesCount;

    private BigDecimal baseSalaryP1;
    private BigDecimal productionSalaryP2;
    private BigDecimal bonusKpiP3;
    private BigDecimal fuelAllowance;
    private BigDecimal phoneAllowance;
    private BigDecimal otherAllowances;
    private BigDecimal violationDeductions;
    private BigDecimal codPendingHolding;
    private BigDecimal totalGrossSalary;
    private BigDecimal netSalary;

    private String status;
    private String aiExplanation;

    private Long managerApprovedBy;
    private String managerApprovedByName;
    private LocalDateTime managerApprovedAt;

    private Long accountantApprovedBy;
    private String accountantApprovedByName;
    private LocalDateTime accountantApprovedAt;

    private LocalDateTime paidAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
