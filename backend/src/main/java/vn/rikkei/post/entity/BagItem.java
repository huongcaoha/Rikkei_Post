package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "bag_items", indexes = {
    @Index(name = "idx_bag_items_bag_id", columnList = "bag_id"),
    @Index(name = "idx_bag_items_tracking_code", columnList = "tracking_code")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BagItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bag_id", nullable = false)
    private MasterBag masterBag;

    @Column(name = "tracking_code", nullable = false, length = 30)
    private String trackingCode;

    @Column(name = "weight_gram", nullable = false)
    private Integer weightGram;

    @Column(name = "item_name")
    private String itemName;

    @Column(name = "receiver_address")
    private String receiverAddress;

    @Column(name = "routing_code")
    private String routingCode;

    @CreationTimestamp
    @Column(name = "scanned_at", updatable = false)
    private LocalDateTime scannedAt;
}
