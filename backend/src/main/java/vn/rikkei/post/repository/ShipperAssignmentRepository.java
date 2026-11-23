package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.ShipperAssignment;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShipperAssignmentRepository extends JpaRepository<ShipperAssignment, Long> {
    Optional<ShipperAssignment> findByTrackingCode(String trackingCode);
    List<ShipperAssignment> findByShipperIdAndStatus(Long shipperId, String status);
    List<ShipperAssignment> findByShipperId(Long shipperId);
}
