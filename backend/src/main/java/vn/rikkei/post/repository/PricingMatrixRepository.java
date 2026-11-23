package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.PricingMatrix;

import java.util.Optional;

@Repository
public interface PricingMatrixRepository extends JpaRepository<PricingMatrix, Long> {
    Optional<PricingMatrix> findByServiceTypeAndZoneTypeAndIsActiveTrue(String serviceType, String zoneType);
}
