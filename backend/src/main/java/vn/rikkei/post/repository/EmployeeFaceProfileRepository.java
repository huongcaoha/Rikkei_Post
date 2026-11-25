package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.EmployeeFaceProfile;

import java.util.Optional;

@Repository
public interface EmployeeFaceProfileRepository extends JpaRepository<EmployeeFaceProfile, Long> {
    Optional<EmployeeFaceProfile> findByUserId(Long userId);
    boolean existsByUserId(Long userId);
}
