package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Bảng cấu hình chính sách phụ phí động (không hardcode vào mã nguồn)
 * Cho phép Quản trị viên tùy chỉnh các loại phụ phí và ngưỡng miễn phí vận hành
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "pricing_policy")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PricingPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Cước lấy hàng tận nơi cơ sở (Ví dụ: 15.000 đ)
    @Column(name = "door_pickup_base_fee", precision = 10, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal doorPickupBaseFee = BigDecimal.valueOf(15000);

    // Số đơn hàng tối thiểu để Shop được MIỄN PHÍ lấy hàng tận nơi (Ví dụ: 5 đơn)
    @Column(name = "free_pickup_order_threshold", nullable = false)
    @Builder.Default
    private Integer freePickupOrderThreshold = 5;

    // Ngưỡng trọng lượng tối đa đơn hàng nhỏ để áp dụng cước lấy hàng cơ sở (Ví dụ: 2000g)
    @Column(name = "bulky_weight_threshold_gram", nullable = false)
    @Builder.Default
    private Integer bulkyWeightThresholdGram = 2000;

    // Ngưỡng chiều dài tối đa đơn hàng nhỏ (Ví dụ: 40cm)
    @Column(name = "bulky_max_dimension_cm", nullable = false)
    @Builder.Default
    private Integer bulkyMaxDimensionCm = 40;

    // Ngưỡng tổng 3 chiều tối đa đơn hàng nhỏ (Ví dụ: 80cm)
    @Column(name = "bulky_sum_dimensions_cm", nullable = false)
    @Builder.Default
    private Integer bulkySumDimensionsCm = 80;

    // Phụ phí mỗi kg vượt ngưỡng đối với hàng to/cồng kềnh (Ví dụ: 5.000 đ/kg)
    @Column(name = "bulky_extra_price_per_kg", precision = 10, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal bulkyExtraPricePerKg = BigDecimal.valueOf(5000);

    // Phụ phí kích thước lớn quá khổ (chiều dài > 50cm hoặc tổng > 100cm, ví dụ: 10.000 đ)
    @Column(name = "oversize_dimension_fee", precision = 10, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal oversizeDimensionFee = BigDecimal.valueOf(10000);

    // Ngưỡng giá trị hàng hóa bắt đầu tính phí bảo hiểm khai giá (Ví dụ: 1.000.000 đ)
    @Column(name = "insurance_value_threshold", precision = 12, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal insuranceValueThreshold = BigDecimal.valueOf(1000000);

    // Tỷ lệ % phí bảo hiểm (Ví dụ: 0.005 tương đương 0.5%)
    @Column(name = "insurance_percent_rate", precision = 6, scale = 4, nullable = false)
    @Builder.Default
    private BigDecimal insurancePercentRate = BigDecimal.valueOf(0.005);
}
