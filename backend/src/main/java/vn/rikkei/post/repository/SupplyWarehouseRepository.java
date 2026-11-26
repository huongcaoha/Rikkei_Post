package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.SupplyWarehouse;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplyWarehouseRepository extends JpaRepository<SupplyWarehouse, Long> {
    Optional<SupplyWarehouse> findByCode(String code);
    List<SupplyWarehouse> findByStatusOrderByCreatedAtDesc(String status);
    List<SupplyWarehouse> findAllByOrderByCreatedAtDesc();
    boolean existsByCode(String code);
}
