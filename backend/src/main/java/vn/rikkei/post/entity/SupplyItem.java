package vn.rikkei.post.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Thực thể Danh mục Vật tư & Trang thiết bị (Supply & Equipment Item)
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "supply_items", indexes = {
    @Index(name = "idx_si_code", columnList = "item_code"),
    @Index(name = "idx_si_cat", columnList = "category")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SupplyItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "item_code", unique = true, nullable = false, length = 50)
    private String itemCode; // e.g. "VT_SCANNER_01", "VT_POS_02", "VT_CAN_100KG"

    @Column(name = "item_name", nullable = false, length = 150)
    private String itemName;

    /**
     * Nhóm phân loại:
     * - THIET_BI_MAY_MOC: Máy in, máy quét mã vạch, cân điện tử, camera...
     * - DUNG_CU_KHO: Xe đẩy hàng, giá kệ, kìm bấm chì, khay chia chọn...
     * - VAT_TU_DONG_GOI: Bao tải dứa, băng dính logo, màng co, nhãn dán nhiệt...
     * - DONG_PHUC: Đồng phục bưu tá, mũ bảo hiểm, áo mưa, găng tay bảo hộ...
     */
    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "unit", nullable = false, length = 30)
    private String unit; // Cái, Chiếc, Bộ, Cuộn, Hộp, Bao...

    @Column(name = "specifications", columnDefinition = "TEXT")
    private String specifications;

    @Column(name = "standard_price", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal standardPrice = BigDecimal.ZERO;

    @Column(name = "min_stock_alert", nullable = false)
    @Builder.Default
    private Integer minStockAlert = 5; // Mức tồn kho tối thiểu cảnh báo cần nhập thêm

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
