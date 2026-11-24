package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.ReconciliationItem;

import java.util.List;

@Repository
public interface ReconciliationItemRepository extends JpaRepository<ReconciliationItem, Long> {
    List<ReconciliationItem> findBySheetIdOrderByIdAsc(Long sheetId);

    List<ReconciliationItem> findByTrackingCode(String trackingCode);
}
