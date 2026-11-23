package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.Province;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProvinceRepository extends JpaRepository<Province, Integer> {
    List<Province> findByIsActiveTrueOrderByDisplayOrderAscNameAsc();
    Optional<Province> findByCode(String code);
}
