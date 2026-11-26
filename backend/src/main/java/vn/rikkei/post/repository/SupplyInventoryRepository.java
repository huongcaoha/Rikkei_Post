package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.SupplyInventory;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplyInventoryRepository extends JpaRepository<SupplyInventory, Long> {
    List<SupplyInventory> findByWarehouseId(Long warehouseId);
    List<SupplyInventory> findByItemId(Long itemId);
    Optional<SupplyInventory> findByWarehouseIdAndItemId(Long warehouseId, Long itemId);
}
