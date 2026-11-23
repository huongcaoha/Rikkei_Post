package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.User;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByPhoneNumber(String phoneNumber);
    Optional<User> findByEmail(String email);
    Optional<User> findFirstByEmail(String email);
    boolean existsByUsername(String username);
    boolean existsByPhoneNumber(String phoneNumber);
    boolean existsByEmail(String email);
    List<User> findByIsActiveFalseAndCreatedAtBefore(LocalDateTime threshold);
    List<User> findByManagedProvinceId(Integer provinceId);
    List<User> findByAssignedPostOfficeId(Long postOfficeId);
    List<User> findByRoles_RoleName(String roleName);
    List<User> findByRoles_RoleNameAndManagedProvinceId(String roleName, Integer provinceId);
    List<User> findByRoles_RoleNameAndAssignedPostOfficeId(String roleName, Long postOfficeId);
}
