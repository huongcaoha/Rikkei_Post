package vn.rikkei.post.service;

import vn.rikkei.post.dto.staff.CreateStaffRequest;
import vn.rikkei.post.dto.staff.StaffUserResponse;
import vn.rikkei.post.dto.staff.UpdateStaffRequest;
import vn.rikkei.post.security.CustomUserDetails;

import java.util.List;

public interface StaffManagementService {
    List<String> getAssignableRoles(CustomUserDetails currentUser);
    List<StaffUserResponse> getStaffList(CustomUserDetails currentUser, String roleFilter, Integer provinceFilter, Long postOfficeFilter);
    StaffUserResponse getStaffById(Long id, CustomUserDetails currentUser);
    StaffUserResponse createStaff(CreateStaffRequest request, CustomUserDetails currentUser);
    StaffUserResponse updateStaff(Long id, UpdateStaffRequest request, CustomUserDetails currentUser);
    StaffUserResponse toggleStaffStatus(Long id, CustomUserDetails currentUser);
    void deleteStaff(Long id, CustomUserDetails currentUser);
}
