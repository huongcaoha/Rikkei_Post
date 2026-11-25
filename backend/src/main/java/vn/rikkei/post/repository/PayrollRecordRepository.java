package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.PayrollRecord;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollRecordRepository extends JpaRepository<PayrollRecord, Long>, JpaSpecificationExecutor<PayrollRecord> {
    Optional<PayrollRecord> findByPayrollCode(String payrollCode);
    Optional<PayrollRecord> findByUserIdAndMonthAndYear(Long userId, Integer month, Integer year);
    List<PayrollRecord> findByMonthAndYearOrderByRoleNameAscEmployeeNameAsc(Integer month, Integer year);
    List<PayrollRecord> findByWarehouseIdAndMonthAndYearOrderByEmployeeNameAsc(Long warehouseId, Integer month, Integer year);
    List<PayrollRecord> findByUserIdOrderByYearDescMonthDesc(Long userId);
    long countByStatus(String status);

    @Query("SELECT COALESCE(SUM(p.netSalary), 0) FROM PayrollRecord p WHERE p.status = 'PAID' AND p.month = :month AND p.year = :year")
    BigDecimal sumPaidSalaries(@Param("month") Integer month, @Param("year") Integer year);
}
