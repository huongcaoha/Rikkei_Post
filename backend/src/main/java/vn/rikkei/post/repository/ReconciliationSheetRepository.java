package vn.rikkei.post.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.ReconciliationSheet;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReconciliationSheetRepository extends JpaRepository<ReconciliationSheet, Long> {
    Optional<ReconciliationSheet> findBySheetCode(String sheetCode);

    Page<ReconciliationSheet> findByMerchantIdOrderByCreatedAtDesc(Long merchantId, Pageable pageable);

    Page<ReconciliationSheet> findByMerchantIdAndStatusOrderByCreatedAtDesc(Long merchantId, String status, Pageable pageable);

    Page<ReconciliationSheet> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    List<ReconciliationSheet> findTop10ByOrderByCreatedAtDesc();
}
