package vn.rikkei.post.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.ShipperCashSubmission;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShipperCashSubmissionRepository extends JpaRepository<ShipperCashSubmission, Long>, JpaSpecificationExecutor<ShipperCashSubmission> {

    Optional<ShipperCashSubmission> findBySubmissionCode(String submissionCode);

    Optional<ShipperCashSubmission> findByPayosOrderCode(Long payosOrderCode);

    List<ShipperCashSubmission> findByShipperIdOrderByCreatedAtDesc(Long shipperId);

    Page<ShipperCashSubmission> findByShipperIdOrderByCreatedAtDesc(Long shipperId, Pageable pageable);

    Page<ShipperCashSubmission> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ShipperCashSubmission> findByPostOfficeIdOrderByCreatedAtDesc(Long postOfficeId, Pageable pageable);
}
