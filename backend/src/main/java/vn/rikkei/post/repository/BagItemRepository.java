package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.BagItem;

import java.util.List;
import java.util.Optional;

@Repository
public interface BagItemRepository extends JpaRepository<BagItem, Long> {
    List<BagItem> findByMasterBagIdOrderByScannedAtDesc(Long masterBagId);
    Optional<BagItem> findByTrackingCode(String trackingCode);
    boolean existsByMasterBagIdAndTrackingCode(Long masterBagId, String trackingCode);
    void deleteByMasterBagIdAndTrackingCode(Long masterBagId, String trackingCode);
}
