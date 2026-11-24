package vn.rikkei.post.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.WalletTransaction;

import java.util.List;
import java.util.Optional;

@Repository
public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, Long> {
    Optional<WalletTransaction> findByTransactionCode(String transactionCode);

    Page<WalletTransaction> findByMerchantIdOrderByCreatedAtDesc(Long merchantId, Pageable pageable);

    List<WalletTransaction> findTop20ByMerchantIdOrderByCreatedAtDesc(Long merchantId);
}
