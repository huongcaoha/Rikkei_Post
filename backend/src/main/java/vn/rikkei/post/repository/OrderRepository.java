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

    java.util.List<Order> findByAssignedShipperId(Long shipperId);
    java.util.List<Order> findByAssignedShipperIdAndCurrentStatusIn(Long shipperId, java.util.List<String> statuses);
    java.util.List<Order> findByAssignedPostOfficeId(Long postOfficeId);
    java.util.List<Order> findByAssignedPostOfficeIdAndAssignedShipperId(Long postOfficeId, Long shipperId);
    boolean existsByTrackingCode(String trackingCode);
    long countByMerchantId(Long merchantId);
    long countByAssignedShipperIdAndCurrentStatus(Long shipperId, String status);
}
