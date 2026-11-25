package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.MasterBag;

import java.util.List;
import java.util.Optional;

@Repository
public interface MasterBagRepository extends JpaRepository<MasterBag, Long> {

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    Optional<MasterBag> findByBagCode(String bagCode);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    Optional<MasterBag> findBySealNumber(String sealNumber);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    @Override
    Optional<MasterBag> findById(Long id);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    List<MasterBag> findAllByOrderByCreatedAtDesc();

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    List<MasterBag> findByOriginWarehouseIdOrderByCreatedAtDesc(Long originWarehouseId);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    List<MasterBag> findByDestWarehouseIdOrderByCreatedAtDesc(Long destWarehouseId);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    List<MasterBag> findByManifestId(Long manifestId);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    List<MasterBag> findByStatus(String status);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    List<MasterBag> findByAssignedDriverIdOrderByCreatedAtDesc(Long assignedDriverId);

    @EntityGraph(attributePaths = {"originWarehouse", "destWarehouse"})
    List<MasterBag> findByDestWarehouseIdAndStatusInOrderByCreatedAtDesc(Long destWarehouseId, List<String> statuses);

    boolean existsByBagCode(String bagCode);
    boolean existsBySealNumber(String sealNumber);
}
