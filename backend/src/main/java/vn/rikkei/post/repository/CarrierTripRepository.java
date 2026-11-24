package vn.rikkei.post.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.CarrierTrip;

import java.util.List;
import java.util.Optional;

@Repository
public interface CarrierTripRepository extends JpaRepository<CarrierTrip, Long> {
    Optional<CarrierTrip> findByTripCode(String tripCode);

    List<CarrierTrip> findByCarrierId(Long carrierId);

    Page<CarrierTrip> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    List<CarrierTrip> findTop30ByOrderByCreatedAtDesc();
}
