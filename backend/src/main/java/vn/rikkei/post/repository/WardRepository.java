package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.Ward;

import java.util.List;

@Repository
public interface WardRepository extends JpaRepository<Ward, Long> {
    List<Ward> findByProvinceIdAndIsActiveTrueOrderByNameAsc(Integer provinceId);
    List<Ward> findByProvinceIdAndNameContainingIgnoreCaseAndIsActiveTrue(Integer provinceId, String keyword);
    List<Ward> findByNameContainingIgnoreCaseAndIsActiveTrue(String keyword);
}
