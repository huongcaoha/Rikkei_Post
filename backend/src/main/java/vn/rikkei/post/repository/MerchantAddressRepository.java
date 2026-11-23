package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.MerchantAddress;

import java.util.List;
import java.util.Optional;

@Repository
public interface MerchantAddressRepository extends JpaRepository<MerchantAddress, Long> {
    Optional<MerchantAddress> findFirstByMerchantIdAndIsDefaultTrue(Long merchantId);
    List<MerchantAddress> findByMerchantId(Long merchantId);
}
