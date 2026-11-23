package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.OrderTrackingLog;

import java.util.List;

@Repository
public interface OrderTrackingLogRepository extends JpaRepository<OrderTrackingLog, Long> {
    List<OrderTrackingLog> findByTrackingCodeOrderByCreatedAtDesc(String trackingCode);
}
