package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.PricingMatrix;

import java.util.List;
import java.util.Optional;

@Repository
public interface PricingMatrixRepository extends JpaRepository<PricingMatrix, Long> {
    Optional<PricingMatrix> findByServiceTypeAndZoneTypeAndIsActiveTrue(String serviceType, String zoneType);

    Optional<PricingMatrix> findByServiceTypeAndZoneType(String serviceType, String zoneType);

    List<PricingMatrix> findAllByOrderByServiceTypeAscZoneTypeAsc();

    boolean existsByServiceTypeAndZoneType(String serviceType, String zoneType);

    boolean existsByServiceTypeAndZoneTypeAndIdNot(String serviceType, String zoneType, Long id);
}
