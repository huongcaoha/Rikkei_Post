package vn.rikkei.post.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Thực thể Người dùng (User) - Hỗ trợ một người dùng có NHIỀU ROLE (Many-to-Many)
 * Sử dụng JPA / Hibernate ORM tự động sinh bảng trung gian "user_role"
 * Tác giả: Nguyễn Công Hưởng
 */
@Entity
@Table(name = "users", indexes = {
    @Index(name = "idx_user_phone", columnList = "phone_number"),
    @Index(name = "idx_user_email", columnList = "email")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", unique = true, nullable = false, length = 50)
    private String username;

    @Column(name = "password", nullable = false, length = 255)
    private String password;

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(name = "phone_number", unique = true, nullable = false, length = 15)
    private String phoneNumber;

    @Column(name = "email", unique = true, nullable = false, length = 100)
    private String email;

    @Column(name = "avatar_url", length = 500)
    private String avatarUrl;

    @Column(name = "assigned_post_office_id")
    private Long assignedPostOfficeId;

    @Column(name = "post_office_name", length = 150)
    private String postOfficeName;

    @Column(name = "managed_province_id")
    private Integer managedProvinceId; // Dành cho Quản lý chi nhánh Tỉnh/Thành phố (ROLE_BRANCH_MANAGER)

    @Column(name = "managed_province_name", length = 100)
    private String managedProvinceName;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "otp", length = 10)
    private String otp;

    /**
     * Quan hệ Many-to-Many với Role:
     * ORM tự động tạo bảng trung gian "user_role" với 2 khóa ngoại:
     * - user_id (trỏ đến users.id)
     * - role_id (trỏ đến roles.id)
     * Lưu ý: KHÔNG dùng CascadeType.PERSIST vì Role là bảng danh mục độc lập đã tồn tại (tránh lỗi detached entity passed to persist).
     */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_role",
        joinColumns = @JoinColumn(name = "user_id", referencedColumnName = "id"),
        inverseJoinColumns = @JoinColumn(name = "role_id", referencedColumnName = "id")
    )
    @Builder.Default
    private Set<Role> roles = new HashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public void addRole(Role role) {
        this.roles.add(role);
    }

    public void removeRole(Role role) {
        this.roles.remove(role);
    }
}
