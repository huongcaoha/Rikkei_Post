package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Thực thể Vai trò Người dùng (Role)
 * Thuộc tính: id, roleName, description
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "roles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "role_name", unique = true, nullable = false, length = 50)
    private String roleName; // e.g., "ROLE_MERCHANT", "ROLE_SHIPPER", "ROLE_WAREHOUSE_STAFF", "ROLE_DISPATCHER", "ROLE_ACCOUNTANT", "ROLE_ADMIN"

    @Column(name = "description", length = 255)
    private String description;
}
