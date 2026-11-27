package vn.rikkei.post.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.Order;

import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    Optional<Order> findByTrackingCode(String trackingCode);
    Page<Order> findByMerchantId(Long merchantId, Pageable pageable);
    Page<Order> findByMerchantIdAndCurrentStatus(Long merchantId, String currentStatus, Pageable pageable);
    Page<Order> findByCurrentStatus(String currentStatus, Pageable pageable);
    Page<Order> findByAssignedShipperId(Long shipperId, Pageable pageable);
    Page<Order> findByAssignedShipperIdAndCurrentStatus(Long shipperId, String currentStatus, Pageable pageable);
    Page<Order> findByAssignedPostOfficeId(Long postOfficeId, Pageable pageable);
    Page<Order> findByAssignedPostOfficeIdAndCurrentStatus(Long postOfficeId, String currentStatus, Pageable pageable);
    Page<Order> findBySenderProvinceIdOrReceiverProvinceId(Integer senderProv, Integer receiverProv, Pageable pageable);

    @Query("SELECT o FROM Order o WHERE (o.senderProvinceId = :provId OR o.receiverProvinceId = :provId) AND (:status IS NULL OR :status = 'ALL' OR o.currentStatus = :status)")
    Page<Order> findByBranchProvinceAndStatus(@Param("provId") Integer provId, @Param("status") String status, Pageable pageable);

    @Query("SELECT o FROM Order o WHERE " +
           "(o.assignedPostOfficeId = :poId " +
           " OR (:poKeyword <> '' AND (LOWER(COALESCE(o.receiverWardName, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')) " +
           "     OR LOWER(COALESCE(o.receiverAddress, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')) " +
           "     OR LOWER(COALESCE(o.senderWardName, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')) " +
           "     OR LOWER(COALESCE(o.senderAddress, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')))) " +
           " OR o.trackingCode IN (SELECT DISTINCT otl.trackingCode FROM OrderTrackingLog otl WHERE otl.locationId = :poId)) " +
           "AND (:status IS NULL OR :status = 'ALL' OR o.currentStatus = :status)")
    Page<Order> findByPostOfficeScope(@Param("poId") Long poId, @Param("poKeyword") String poKeyword, @Param("status") String status, Pageable pageable);

    @Query("SELECT o FROM Order o WHERE " +
           "(o.assignedPostOfficeId = :poId " +
           " OR (:poKeyword <> '' AND (LOWER(COALESCE(o.receiverWardName, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')) " +
           "     OR LOWER(COALESCE(o.receiverAddress, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')) " +
           "     OR LOWER(COALESCE(o.senderWardName, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')) " +
           "     OR LOWER(COALESCE(o.senderAddress, '')) LIKE LOWER(CONCAT('%', :poKeyword, '%')))) " +
           " OR o.trackingCode IN (SELECT DISTINCT otl.trackingCode FROM OrderTrackingLog otl WHERE otl.locationId = :poId))")
    java.util.List<Order> findByPostOfficeScopeList(@Param("poId") Long poId, @Param("poKeyword") String poKeyword);

    java.util.List<Order> findByAssignedShipperId(Long shipperId);
    java.util.List<Order> findByAssignedShipperIdAndCurrentStatusIn(Long shipperId, java.util.List<String> statuses);
    java.util.List<Order> findByAssignedPostOfficeId(Long postOfficeId);
    java.util.List<Order> findByAssignedPostOfficeIdAndAssignedShipperId(Long postOfficeId, Long shipperId);
    java.util.List<Order> findByMerchantIdAndCurrentStatusAndIsReconciledFalse(Long merchantId, String currentStatus);
    java.util.List<Order> findByCurrentStatusAndIsReconciledFalse(String currentStatus);
    java.util.List<Order> findByTrackingCodeIn(java.util.List<String> trackingCodes);
    boolean existsByTrackingCode(String trackingCode);
    long countByMerchantId(Long merchantId);
    long countByAssignedShipperIdAndCurrentStatus(Long shipperId, String status);

    @Query("SELECT COALESCE(SUM(o.codAmount), 0) FROM Order o WHERE o.currentStatus = 'DELIVERED' AND o.deliveredAt >= :startDate AND o.deliveredAt <= :endDate")
    java.math.BigDecimal sumDeliveredCodAmount(@Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT COALESCE(SUM(o.totalFee), 0) FROM Order o WHERE o.createdAt >= :startDate AND o.createdAt <= :endDate")
    java.math.BigDecimal sumTotalShippingFee(@Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.assignedShipperId = :shipperId AND o.currentStatus = 'DELIVERED' AND o.deliveredAt >= :startDate AND o.deliveredAt <= :endDate")
    long countShipperDeliveredInPeriod(@Param("shipperId") Long shipperId, @Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.assignedShipperId = :shipperId AND o.pickupCompletedAt >= :startDate AND o.pickupCompletedAt <= :endDate")
    long countShipperPickedInPeriod(@Param("shipperId") Long shipperId, @Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT COUNT(o) FROM Order o WHERE o.assignedShipperId = :shipperId AND o.currentStatus = 'DELIVERY_FAILED' AND o.updatedAt >= :startDate AND o.updatedAt <= :endDate")
    long countShipperFailedInPeriod(@Param("shipperId") Long shipperId, @Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);

    @Query("SELECT COALESCE(SUM(o.totalFee), 0) FROM Order o WHERE o.assignedPostOfficeId = :poId AND o.createdAt >= :startDate AND o.createdAt <= :endDate")
    java.math.BigDecimal sumPostOfficeRevenueInPeriod(@Param("poId") Long poId, @Param("startDate") java.time.LocalDateTime startDate, @Param("endDate") java.time.LocalDateTime endDate);
}
