package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.staff.CreateStaffRequest;
import vn.rikkei.post.dto.staff.StaffUserResponse;
import vn.rikkei.post.dto.staff.UpdateStaffRequest;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.ProvinceRepository;
import vn.rikkei.post.repository.RoleRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.StaffManagementService;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StaffManagementServiceImpl implements StaffManagementService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final ProvinceRepository provinceRepository;
    private final WarehouseRepository warehouseRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public List<String> getAssignableRoles(CustomUserDetails currentUser) {
        if (hasRole(currentUser, "ROLE_ADMIN")) {
            // Admin có quyền phân quyền tất cả vai trò ngoại trừ chính ROLE_ADMIN
            return List.of("ROLE_BRANCH_MANAGER", "ROLE_POST_OFFICE_MANAGER", "ROLE_SHIPPER", "ROLE_WAREHOUSE_STAFF", "ROLE_MERCHANT");
        } else if (hasRole(currentUser, "ROLE_BRANCH_MANAGER")) {
            // Quản lý chi nhánh có quyền tạo các tài khoản cấp thấp hơn thuộc địa bàn
            return List.of("ROLE_POST_OFFICE_MANAGER", "ROLE_SHIPPER", "ROLE_WAREHOUSE_STAFF");
        } else if (hasRole(currentUser, "ROLE_POST_OFFICE_MANAGER")) {
            // Quản lý bưu cục chỉ tạo shipper và nhân viên kho
            return List.of("ROLE_SHIPPER", "ROLE_WAREHOUSE_STAFF");
        }
        return Collections.emptyList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<StaffUserResponse> getStaffList(CustomUserDetails currentUser, String roleFilter, Integer provinceFilter, Long postOfficeFilter) {
        List<User> users = userRepository.findAll();

        // Lọc người dùng không phải là khách hàng vãng lai (loại trừ tài khoản chỉ có ROLE_MERCHANT đơn thuần nếu cần)
        List<User> staffUsers = users.stream()
                .filter(u -> u.getRoles().stream().anyMatch(r ->
                        !r.getRoleName().equals("ROLE_MERCHANT") || u.getRoles().size() > 1 || r.getRoleName().equals("ROLE_ADMIN")
                ))
                .collect(Collectors.toList());

        // Phân quyền dữ liệu theo vai trò người gọi:
        boolean isAdmin = hasRole(currentUser, "ROLE_ADMIN");
        boolean isBranchManager = hasRole(currentUser, "ROLE_BRANCH_MANAGER");
        boolean isPostOfficeManager = hasRole(currentUser, "ROLE_POST_OFFICE_MANAGER");

        if (isBranchManager && !isAdmin) {
            Integer managedProvId = getManagedProvinceId(currentUser);
            if (managedProvId != null) {
                staffUsers = staffUsers.stream()
                        .filter(u -> managedProvId.equals(u.getManagedProvinceId()))
                        .collect(Collectors.toList());
            }
        } else if (isPostOfficeManager && !isAdmin) {
            Long assignedPoId = getAssignedPostOfficeId(currentUser);
            if (assignedPoId != null) {
                staffUsers = staffUsers.stream()
                        .filter(u -> assignedPoId.equals(u.getAssignedPostOfficeId()))
                        .collect(Collectors.toList());
            }
        }

        // Áp dụng filters tùy chọn
        if (roleFilter != null && !roleFilter.isBlank() && !roleFilter.equals("ALL")) {
            staffUsers = staffUsers.stream()
                    .filter(u -> u.getRoles().stream().anyMatch(r -> r.getRoleName().equalsIgnoreCase(roleFilter)))
                    .collect(Collectors.toList());
        }
        if (provinceFilter != null) {
            staffUsers = staffUsers.stream()
                    .filter(u -> provinceFilter.equals(u.getManagedProvinceId()))
                    .collect(Collectors.toList());
        }
        if (postOfficeFilter != null) {
            staffUsers = staffUsers.stream()
                    .filter(u -> postOfficeFilter.equals(u.getAssignedPostOfficeId()))
                    .collect(Collectors.toList());
        }

        return staffUsers.stream().map(this::mapToResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public StaffUserResponse getStaffById(Long id, CustomUserDetails currentUser) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhân viên với ID: " + id));
        checkAccessPermission(user, currentUser);
        return mapToResponse(user);
    }

    @Override
    @Transactional
    public StaffUserResponse createStaff(CreateStaffRequest request, CustomUserDetails currentUser) {
        // Kiểm tra trùng username, phone, email
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("Tên đăng nhập '" + request.getUsername() + "' đã tồn tại!");
        }
        if (userRepository.existsByPhoneNumber(request.getPhoneNumber())) {
            throw new IllegalArgumentException("Số điện thoại '" + request.getPhoneNumber() + "' đã được sử dụng!");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email '" + request.getEmail() + "' đã được sử dụng!");
        }

        boolean isAdmin = hasRole(currentUser, "ROLE_ADMIN");
        boolean isBranchManager = hasRole(currentUser, "ROLE_BRANCH_MANAGER");
        boolean isPostOfficeManager = hasRole(currentUser, "ROLE_POST_OFFICE_MANAGER");

        // Kiểm tra phân quyền tạo vai trò:
        // 1. Không ai được phép tạo tài khoản có ROLE_ADMIN (theo yêu cầu của đề bài)
        for (String rName : request.getRoles()) {
            if ("ROLE_ADMIN".equalsIgnoreCase(rName)) {
                throw new IllegalArgumentException("Không được phép tạo tài khoản với quyền Quản trị viên (ROLE_ADMIN)!");
            }
            if (isBranchManager && !isAdmin) {
                // Quản lý chi nhánh chỉ được tạo role cấp thấp hơn (quản lý kho bưu cục, shipper, nhân viên kho)
                if ("ROLE_BRANCH_MANAGER".equalsIgnoreCase(rName)) {
                    throw new IllegalArgumentException("Quản lý chi nhánh không được phép tạo tài khoản Quản lý chi nhánh khác!");
                }
            }
            if (isPostOfficeManager && !isAdmin) {
                if ("ROLE_BRANCH_MANAGER".equalsIgnoreCase(rName) || "ROLE_POST_OFFICE_MANAGER".equalsIgnoreCase(rName)) {
                    throw new IllegalArgumentException("Quản lý bưu cục chỉ được tạo nhân viên bưu tá (Shipper) hoặc nhân viên kho!");
                }
            }
        }

        Set<Role> roles = new HashSet<>();
        for (String roleName : request.getRoles()) {
            Role role = roleRepository.findByRoleName(roleName.toUpperCase())
                    .orElseGet(() -> roleRepository.save(Role.builder()
                            .roleName(roleName.toUpperCase())
                            .description("Vai trò " + roleName)
                            .build()));
            roles.add(role);
        }

        Integer managedProvId = request.getManagedProvinceId();
        if (isBranchManager && !isAdmin) {
            managedProvId = getManagedProvinceId(currentUser);
        }

        Long assignedPoId = request.getAssignedPostOfficeId();
        if (isPostOfficeManager && !isAdmin) {
            assignedPoId = getAssignedPostOfficeId(currentUser);
        }

        String provName = null;
        if (managedProvId != null) {
            provName = provinceRepository.findById(managedProvId).map(Province::getName).orElse(null);
        }

        String poName = null;
        if (assignedPoId != null) {
            poName = warehouseRepository.findById(assignedPoId).map(Warehouse::getName).orElse(null);
        }

        User newUser = User.builder()
                .username(request.getUsername())
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .email(request.getEmail())
                .roles(roles)
                .managedProvinceId(managedProvId)
                .managedProvinceName(provName)
                .assignedPostOfficeId(assignedPoId)
                .postOfficeName(poName)
                .isActive(true)
                .build();

        User saved = userRepository.save(newUser);
        log.info("Đã tạo nhân viên mới: {} ({}) bởi user: {}", saved.getFullName(), saved.getUsername(), currentUser.getUsername());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public StaffUserResponse updateStaff(Long id, UpdateStaffRequest request, CustomUserDetails currentUser) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhân viên với ID: " + id));

        checkAccessPermission(user, currentUser);

        boolean isAdmin = hasRole(currentUser, "ROLE_ADMIN");
        boolean isBranchManager = hasRole(currentUser, "ROLE_BRANCH_MANAGER");

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getPhoneNumber() != null) user.setPhoneNumber(request.getPhoneNumber());
        if (request.getEmail() != null) user.setEmail(request.getEmail());
        if (request.getIsActive() != null) user.setIsActive(request.getIsActive());

        if (request.getNewPassword() != null && !request.getNewPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        }

        // Cập nhật Roles
        if (request.getRoles() != null && !request.getRoles().isEmpty()) {
            for (String rName : request.getRoles()) {
                if ("ROLE_ADMIN".equalsIgnoreCase(rName) && !isAdmin) {
                    throw new IllegalArgumentException("Không được gán quyền ROLE_ADMIN!");
                }
                if (isBranchManager && !isAdmin && "ROLE_BRANCH_MANAGER".equalsIgnoreCase(rName)) {
                    throw new IllegalArgumentException("Không được cấp quyền Quản lý chi nhánh!");
                }
            }

            Set<Role> newRoles = new HashSet<>();
            for (String rName : request.getRoles()) {
                Role r = roleRepository.findByRoleName(rName.toUpperCase()).orElse(null);
                if (r != null) newRoles.add(r);
            }
            user.setRoles(newRoles);
        }

        if (isAdmin && request.getManagedProvinceId() != null) {
            user.setManagedProvinceId(request.getManagedProvinceId());
            user.setManagedProvinceName(provinceRepository.findById(request.getManagedProvinceId())
                    .map(Province::getName).orElse(null));
        }

        if (request.getAssignedPostOfficeId() != null) {
            user.setAssignedPostOfficeId(request.getAssignedPostOfficeId());
            user.setPostOfficeName(warehouseRepository.findById(request.getAssignedPostOfficeId())
                    .map(Warehouse::getName).orElse(null));
        }

        User saved = userRepository.save(user);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public StaffUserResponse toggleStaffStatus(Long id, CustomUserDetails currentUser) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhân viên với ID: " + id));
        checkAccessPermission(user, currentUser);

        user.setIsActive(!Boolean.TRUE.equals(user.getIsActive()));
        User saved = userRepository.save(user);
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public void deleteStaff(Long id, CustomUserDetails currentUser) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy nhân viên với ID: " + id));
        checkAccessPermission(user, currentUser);
        userRepository.delete(user);
    }

    private void checkAccessPermission(User target, CustomUserDetails currentUser) {
        if (hasRole(currentUser, "ROLE_ADMIN")) {
            return;
        }
        if (hasRole(currentUser, "ROLE_BRANCH_MANAGER")) {
            Integer managedProvId = getManagedProvinceId(currentUser);
            if (managedProvId == null || !managedProvId.equals(target.getManagedProvinceId())) {
                throw new SecurityException("Bạn không có quyền quản trị nhân viên ngoài phạm vi chi nhánh tỉnh của mình!");
            }
            return;
        }
        if (hasRole(currentUser, "ROLE_POST_OFFICE_MANAGER")) {
            Long assignedPoId = getAssignedPostOfficeId(currentUser);
            if (assignedPoId == null || !assignedPoId.equals(target.getAssignedPostOfficeId())) {
                throw new SecurityException("Bạn không có quyền quản trị nhân viên ngoài bưu cục của mình!");
            }
            return;
        }
        throw new SecurityException("Bạn không có quyền quản trị nhân viên!");
    }

    private boolean hasRole(CustomUserDetails userDetails, String roleName) {
        if (userDetails == null || userDetails.getAuthorities() == null) return false;
        return userDetails.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase(roleName));
    }

    private Integer getManagedProvinceId(CustomUserDetails userDetails) {
        if (userDetails == null) return null;
        return userRepository.findById(userDetails.getId())
                .map(User::getManagedProvinceId)
                .orElse(null);
    }

    private Long getAssignedPostOfficeId(CustomUserDetails userDetails) {
        if (userDetails == null) return null;
        return userRepository.findById(userDetails.getId())
                .map(User::getAssignedPostOfficeId)
                .orElse(null);
    }

    private StaffUserResponse mapToResponse(User user) {
        return StaffUserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .email(user.getEmail())
                .roles(user.getRoles().stream().map(Role::getRoleName).collect(Collectors.toList()))
                .managedProvinceId(user.getManagedProvinceId())
                .managedProvinceName(user.getManagedProvinceName())
                .assignedPostOfficeId(user.getAssignedPostOfficeId())
                .postOfficeName(user.getPostOfficeName())
                .isActive(user.getIsActive())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
