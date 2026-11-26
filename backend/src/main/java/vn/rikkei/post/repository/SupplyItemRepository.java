package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.SupplyItem;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplyItemRepository extends JpaRepository<SupplyItem, Long> {
    Optional<SupplyItem> findByItemCode(String itemCode);
    List<SupplyItem> findByCategoryOrderByItemNameAsc(String category);
    List<SupplyItem> findByIsActiveTrueOrderByCategoryAscItemNameAsc();
    List<SupplyItem> findAllByOrderByCreatedAtDesc();
    boolean existsByItemCode(String itemCode);
}
