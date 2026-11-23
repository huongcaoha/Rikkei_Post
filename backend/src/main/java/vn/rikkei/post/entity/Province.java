package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Thực thể Tỉnh / Thành phố trực thuộc Trung ương của Việt Nam
 * Lưu trữ danh mục 63 tỉnh thành chuẩn Tổng cục Thống kê (GSO)
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "provinces", indexes = {
        @Index(name = "idx_provinces_code", columnList = "code"),
        @Index(name = "idx_provinces_region", columnList = "region")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Province {

    @Id
    private Integer id; // Mã tỉnh chuẩn GSO: 1 (Hà Nội), 79 (TP.HCM), 48 (Đà Nẵng)...

    @Column(name = "code", length = 20, nullable = false, unique = true)
    private String code; // e.g. "HN", "SG", "DNA", "HP", "CT"

    @Column(name = "name", length = 100, nullable = false)
    private String name; // e.g. "Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng"

    @Column(name = "region", length = 20, nullable = false)
    private String region; // "NORTH", "CENTRAL", "SOUTH" - Phục vụ định tuyến & tính cước vùng

    @Column(name = "display_order")
    private Integer displayOrder;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;
}
