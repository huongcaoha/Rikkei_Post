package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.ShipmentManifest;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShipmentManifestRepository extends JpaRepository<ShipmentManifest, Long> {
    Optional<ShipmentManifest> findByManifestCode(String manifestCode);
    List<ShipmentManifest> findAllByOrderByCreatedAtDesc();
    List<ShipmentManifest> findByOriginHubIdOrderByCreatedAtDesc(Long originHubId);
    List<ShipmentManifest> findByDestHubIdOrderByCreatedAtDesc(Long destHubId);
    List<ShipmentManifest> findByStatus(String status);
    boolean existsByManifestCode(String manifestCode);
}
