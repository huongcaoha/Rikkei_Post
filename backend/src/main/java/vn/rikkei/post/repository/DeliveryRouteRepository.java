package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.DeliveryRoute;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeliveryRouteRepository extends JpaRepository<DeliveryRoute, Long> {

    Optional<DeliveryRoute> findByRouteCode(String routeCode);

    List<DeliveryRoute> findByProvinceId(Integer provinceId);

    List<DeliveryRoute> findByPostOfficeId(Long postOfficeId);

    List<DeliveryRoute> findByAssignedShipperId(Long shipperId);

    List<DeliveryRoute> findByProvinceIdAndIsActiveTrue(Integer provinceId);

    List<DeliveryRoute> findByPostOfficeIdAndIsActiveTrue(Long postOfficeId);

    @Query("SELECT r FROM DeliveryRoute r WHERE r.provinceId = :provinceId AND LOWER(r.wardName) LIKE LOWER(CONCAT('%', :wardName, '%')) AND r.isActive = true")
    List<DeliveryRoute> findMatchingRoutes(@Param("provinceId") Integer provinceId, @Param("wardName") String wardName);
}
