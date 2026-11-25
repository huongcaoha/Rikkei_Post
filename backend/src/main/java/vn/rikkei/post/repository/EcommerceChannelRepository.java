package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.EcommerceChannel;

import java.util.List;
import java.util.Optional;

@Repository
public interface EcommerceChannelRepository extends JpaRepository<EcommerceChannel, Long> {

    Optional<EcommerceChannel> findByApiKey(String apiKey);

    List<EcommerceChannel> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<EcommerceChannel> findByPlatformAndShopId(String platform, String shopId);
}
