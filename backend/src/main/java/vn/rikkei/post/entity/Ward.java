package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Thực thể Xã / Phường / Thị trấn của Việt Nam
 * Trực thuộc Tỉnh/Thành phố (province_id), phục vụ giao nhận chặng cuối (Last-mile)
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "wards", indexes = {
    @Index(name = "idx_wards_province_id", columnList = "province_id"),
    @Index(name = "idx_wards_name", columnList = "name")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ward {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "province_id", nullable = false)
    private Integer provinceId;

    @Column(name = "name", length = 150, nullable = false)
    private String name; // e.g. "Phường Dịch Vọng Hậu", "Phường Bến Nghé"

    @Column(name = "district_name", length = 150)
    private String districtName; // e.g. "Quận Cầu Giấy", "Quận 1", "Quận Hải Châu"

    @Column(name = "code", length = 30)
    private String code;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
