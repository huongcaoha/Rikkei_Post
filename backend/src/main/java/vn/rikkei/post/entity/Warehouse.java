package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "warehouses", indexes = {
    @Index(name = "idx_warehouse_code", columnList = "code"),
    @Index(name = "idx_warehouse_type", columnList = "type")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Warehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 30)
    private String code; // e.g., "HUB_HN_NORTH", "SPOKE_HN_HBT"

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 50)
    private String type; // "REGIONAL_HUB", "HUB", "SPOKE_POST_OFFICE"

    @Column(name = "province_id", nullable = false)
    private Integer provinceId;

    @Column(name = "district_id", nullable = false)
    private Integer districtId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String address;

    @Column(nullable = false)
    private Double latitude;

    @Column(nullable = false)
    private Double longitude;

    @Column(name = "capacity_packages", nullable = false)
    @Builder.Default
    private Integer capacityPackages = 50000;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
