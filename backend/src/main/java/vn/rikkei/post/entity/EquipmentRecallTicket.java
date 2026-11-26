package vn.rikkei.post.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Thực thể Phiếu Thu Hồi Đồ Dùng, Máy Móc Hỏng của các Kho Bưu Cục
 * Yêu cầu:
 * - Các đồ dùng, máy móc hỏng của các kho bưu cục thì cần phải viết phiếu thu hồi
 *   gửi quản lý kho với trạng thái chờ thu hồi (CHO_THU_HOI).
 * - Sau khi thu hồi thì phiếu thu hồi đó sẽ chuyển trạng thái đã thu hồi (DA_THU_HOI).
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "equipment_recall_tickets", indexes = {
    @Index(name = "idx_ert_code", columnList = "ticket_code"),
    @Index(name = "idx_ert_po", columnList = "post_office_id"),
    @Index(name = "idx_ert_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class EquipmentRecallTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_code", unique = true, nullable = false, length = 50)
    private String ticketCode; // e.g. "TH_241126_001"

    /**
     * Bưu cục lập phiếu báo hỏng cần thu hồi
     */
    @Column(name = "post_office_id", nullable = false)
    private Long postOfficeId;

    @Column(name = "post_office_name", nullable = false, length = 150)
    private String postOfficeName;

    /**
     * Tên đồ dùng, máy móc hỏng
     */
    @Column(name = "equipment_name", nullable = false, length = 150)
    private String equipmentName; // e.g. "Máy in nhiệt đơn hàng Xprinter XP-420B bị cháy nguồn"

    @Column(name = "supply_item_id")
    private Long supplyItemId; // Tham chiếu đến danh mục vật tư nếu có

    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    @Column(name = "serial_number", length = 100)
    private String serialNumber; // Số seri máy móc

    @Column(name = "damage_description", nullable = false, columnDefinition = "TEXT")
    private String damageDescription; // Mô tả tình trạng hỏng, nguyên nhân

    /**
     * Trạng thái phiếu thu hồi:
     * - CHO_THU_HOI: Chờ thu hồi (Khi bưu cục mới viết phiếu gửi lên)
     * - DA_THU_HOI: Đã thu hồi (Khi Quản lý kho vật tư đã tiếp nhận và thu hồi tài sản về)
     */
    @Column(name = "status", nullable = false, length = 30)
    @Builder.Default
    private String status = "CHO_THU_HOI";

    // Người lập phiếu yêu cầu thu hồi (Quản lý bưu cục)
    @Column(name = "requester_id")
    private Long requesterId;

    @Column(name = "requester_name", length = 100)
    private String requesterName;

    @Column(name = "requester_phone", length = 20)
    private String requesterPhone;

    // Người xử lý thu hồi (Quản lý kho vật tư)
    @Column(name = "resolved_by_id")
    private Long resolvedById;

    @Column(name = "resolved_by_name", length = 100)
    private String resolvedByName;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes; // Hướng xử lý: nhập kho phế liệu, thanh lý, hoặc gửi hãng bảo hành

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
