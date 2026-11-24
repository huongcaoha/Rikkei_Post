package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.MasterBag;

import java.util.List;
import java.util.Optional;

@Repository
public interface MasterBagRepository extends JpaRepository<MasterBag, Long> {
    Optional<MasterBag> findByBagCode(String bagCode);
    Optional<MasterBag> findBySealNumber(String sealNumber);
    List<MasterBag> findAllByOrderByCreatedAtDesc();
    List<MasterBag> findByOriginWarehouseIdOrderByCreatedAtDesc(Long originWarehouseId);
    List<MasterBag> findByDestWarehouseIdOrderByCreatedAtDesc(Long destWarehouseId);
    List<MasterBag> findByManifestId(Long manifestId);
    List<MasterBag> findByStatus(String status);
    boolean existsByBagCode(String bagCode);
    boolean existsBySealNumber(String sealNumber);
}
