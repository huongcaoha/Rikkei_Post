package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.PaymentVoucher;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentVoucherRepository extends JpaRepository<PaymentVoucher, Long>, JpaSpecificationExecutor<PaymentVoucher> {
    Optional<PaymentVoucher> findByVoucherCode(String voucherCode);
    List<PaymentVoucher> findByCreatedByUserIdOrderByCreatedAtDesc(Long userId);
    List<PaymentVoucher> findByWarehouseIdOrderByCreatedAtDesc(Long warehouseId);

    @Query("SELECT COALESCE(SUM(v.amount), 0) FROM PaymentVoucher v WHERE v.voucherType = 'PAYMENT' AND v.status = 'APPROVED' AND v.createdAt >= :startDate AND v.createdAt <= :endDate")
    BigDecimal sumApprovedPayments(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    @Query("SELECT COALESCE(SUM(v.amount), 0) FROM PaymentVoucher v WHERE v.voucherType = 'RECEIPT' AND v.status = 'APPROVED' AND v.createdAt >= :startDate AND v.createdAt <= :endDate")
    BigDecimal sumApprovedReceipts(@Param("startDate") LocalDateTime startDate, @Param("endDate") LocalDateTime endDate);

    long countByStatus(String status);
}
