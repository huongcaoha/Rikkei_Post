package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.DispatchOrder;

import java.util.List;
import java.util.Optional;

@Repository
public interface DispatchOrderRepository extends JpaRepository<DispatchOrder, Long>, JpaSpecificationExecutor<DispatchOrder> {

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse", "driver", "truck"})
    Optional<DispatchOrder> findByDispatchCode(String dispatchCode);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse", "driver", "truck"})
    @Override
    Optional<DispatchOrder> findById(Long id);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse", "driver", "truck"})
    List<DispatchOrder> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse", "driver", "truck"})
    List<DispatchOrder> findByOriginWarehouseIdOrderByCreatedAtDesc(Long originWarehouseId);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse", "driver", "truck"})
    List<DispatchOrder> findByDestWarehouseIdOrderByCreatedAtDesc(Long destWarehouseId);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse", "driver", "truck"})
    List<DispatchOrder> findByDriverIdOrderByCreatedAtDesc(Long driverId);

    boolean existsByDispatchCode(String dispatchCode);
}
