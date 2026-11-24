package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.MerchantWallet;

import java.util.Optional;

@Repository
public interface MerchantWalletRepository extends JpaRepository<MerchantWallet, Long> {
    Optional<MerchantWallet> findByMerchantId(Long merchantId);
}
