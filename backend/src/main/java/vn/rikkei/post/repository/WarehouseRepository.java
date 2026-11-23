package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.Warehouse;

import java.util.List;
import java.util.Optional;

@Repository
public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {
    Optional<Warehouse> findByCode(String code);
    List<Warehouse> findByProvinceId(Integer provinceId);
    List<Warehouse> findByProvinceIdAndIsActiveTrue(Integer provinceId);
    List<Warehouse> findByIsActiveTrue();
}
