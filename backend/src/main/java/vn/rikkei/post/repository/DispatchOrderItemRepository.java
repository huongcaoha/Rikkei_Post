package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.DispatchOrderItem;

import java.util.List;
import java.util.Optional;

@Repository
public interface DispatchOrderItemRepository extends JpaRepository<DispatchOrderItem, Long> {

    @EntityGraph(attributePaths = {"masterBag"})
    List<DispatchOrderItem> findByDispatchOrderIdOrderByScannedAtAsc(Long dispatchOrderId);

    @EntityGraph(attributePaths = {"dispatchOrder", "masterBag"})
    Optional<DispatchOrderItem> findByDispatchOrderIdAndBagCode(Long dispatchOrderId, String bagCode);

    @EntityGraph(attributePaths = {"dispatchOrder", "masterBag"})
    Optional<DispatchOrderItem> findFirstByBagCodeOrderByScannedAtDesc(String bagCode);

    boolean existsByDispatchOrderIdAndBagCode(Long dispatchOrderId, String bagCode);
}
