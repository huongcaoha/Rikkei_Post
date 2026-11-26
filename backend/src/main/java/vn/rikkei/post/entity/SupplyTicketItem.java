package vn.rikkei.post.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * Thực thể Chi tiết Phiếu Xuất/Nhập Vật Tư
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "supply_ticket_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SupplyTicketItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id", nullable = false)
    @JsonIgnore
    private SupplyTicket ticket;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private SupplyItem item;

    @Column(name = "item_code", length = 50)
    private String itemCode;

    @Column(name = "item_name", length = 150)
    private String itemName;

    @Column(name = "unit", length = 30)
    private String unit;

    @Column(name = "quantity", nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(name = "notes")
    private String notes;
}
