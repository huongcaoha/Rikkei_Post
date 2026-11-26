package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Thực thể Tuyến đường / Khu vực giao nhận (Delivery Route / Service Area)
 * Dùng để Quản lý Kho / Bưu cục phân chia địa bàn phụ trách cho từng Bưu tá (Shipper).
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "delivery_routes", indexes = {
    @Index(name = "idx_route_code", columnList = "route_code"),
    @Index(name = "idx_route_post_office", columnList = "post_office_id"),
    @Index(name = "idx_route_shipper", columnList = "assigned_shipper_id"),
    @Index(name = "idx_route_province", columnList = "province_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "route_code", nullable = false, unique = true, length = 50)
    private String routeCode; // e.g. "ROUTE_HN_CG_01"

    @Column(name = "route_name", nullable = false, length = 150)
    private String routeName; // e.g. "Tuyến Cầu Giấy 01 - Duy Tân & Trần Thái Tông"

    /**
     * Loại tuyến đường:
     * - MOTORBIKE_DELIVERY: Tuyến phân công cho Shipper giao hàng bằng xe máy
     * - TRUCK_TRANSFER: Tuyến phân công cho Tài xế ô tô gom hàng hoặc chở hàng trung chuyển Hub
     */
    @Column(name = "route_type", length = 30)
    @Builder.Default
    private String routeType = "MOTORBIKE_DELIVERY";

    @Column(name = "province_id", nullable = false)
    private Integer provinceId;

    @Column(name = "province_name", length = 100)
    private String provinceName;

    @Column(name = "district_name", length = 100)
    private String districtName;

    @Column(name = "ward_name", length = 100)
    private String wardName;

    @Column(name = "post_office_id", nullable = false)
    private Long postOfficeId; // Kho / Bưu cục phụ trách

    @Column(name = "post_office_name", length = 150)
    private String postOfficeName;

    @Column(name = "assigned_shipper_id")
    private Long assignedShipperId; // Shipper được phân công phụ trách

    @Column(name = "assigned_shipper_name", length = 100)
    private String assignedShipperName;

    @Column(name = "assigned_shipper_phone", length = 20)
    private String assignedShipperPhone;

    @Column(name = "street_keywords", columnDefinition = "TEXT")
    private String streetKeywords; // Các tuyến đường phụ trách (e.g. "Duy Tân, Trần Thái Tông, Tôn Thất Thuyết, Dịch Vọng Hậu")

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

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
