package vn.rikkei.post.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Thực thể Phiếu Xuất / Nhập Kho Vật Tư & Trang Thiết Bị
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "supply_tickets", indexes = {
    @Index(name = "idx_st_code", columnList = "ticket_code"),
    @Index(name = "idx_st_type", columnList = "ticket_type"),
    @Index(name = "idx_st_wh", columnList = "warehouse_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class SupplyTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_code", unique = true, nullable = false, length = 50)
    private String ticketCode; // e.g. "PN_VT_241126_01", "PX_VT_241126_01"

    /**
     * Loại phiếu:
     * - IMPORT: Nhập kho từ Nhà cung cấp / Đối tác
     * - EXPORT: Xuất kho cấp phát cho Bưu cục / Kho vận
     */
    @Column(name = "ticket_type", nullable = false, length = 20)
    private String ticketType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private SupplyWarehouse warehouse;

    /**
     * Nơi nhận (nếu là phiếu xuất cấp phát cho bưu cục)
     */
    @Column(name = "target_post_office_id")
    private Long targetPostOfficeId;

    @Column(name = "target_post_office_name", length = 150)
    private String targetPostOfficeName;

    /**
     * Đơn vị cung cấp / Đối tác giao hàng (nếu là phiếu nhập)
     */
    @Column(name = "partner_or_supplier", length = 150)
    private String partnerOrSupplier;

    @Column(name = "reason", columnDefinition = "TEXT")
    private String reason; // Lý do xuất/nhập

    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "COMPLETED"; // COMPLETED, CHO_XAC_NHAN, CANCELLED

    @Column(name = "creator_id")
    private Long creatorId;

    @Column(name = "creator_name", length = 100)
    private String creatorName;

    @Column(name = "received_by_user_id")
    private Long receivedByUserId;

    @Column(name = "received_by_name", length = 100)
    private String receivedByName;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Column(name = "received_notes", columnDefinition = "TEXT")
    private String receivedNotes;

    @Column(name = "total_quantity", nullable = false)
    @Builder.Default
    private Integer totalQuantity = 0;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "ticket", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SupplyTicketItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
