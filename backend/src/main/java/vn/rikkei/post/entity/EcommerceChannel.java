package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "ecommerce_channels", indexes = {
        @Index(name = "idx_ecom_api_key", columnList = "api_key"),
        @Index(name = "idx_ecom_user_id", columnList = "user_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EcommerceChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "platform", nullable = false, length = 50)
    private String platform; // SHOPEE, LAZADA, TIKTOK, TIKI, CUSTOM

    @Column(name = "channel_name", nullable = false, length = 150)
    private String channelName;

    @Column(name = "shop_id", length = 100)
    private String shopId;

    @Column(name = "api_key", unique = true, nullable = false, length = 120)
    private String apiKey;

    @Column(name = "api_secret", length = 120)
    private String apiSecret;

    @Column(name = "webhook_url", columnDefinition = "TEXT")
    private String webhookUrl;

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "ACTIVE"; // ACTIVE, PAUSED

    @Column(name = "total_orders_synced", nullable = false)
    @Builder.Default
    private Integer totalOrdersSynced = 0;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
