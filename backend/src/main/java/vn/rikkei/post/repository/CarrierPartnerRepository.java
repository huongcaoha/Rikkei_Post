package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.CarrierPartner;

import java.util.List;
import java.util.Optional;

@Repository
public interface CarrierPartnerRepository extends JpaRepository<CarrierPartner, Long> {
    Optional<CarrierPartner> findByPartnerCode(String partnerCode);

    List<CarrierPartner> findByStatus(String status);
}
