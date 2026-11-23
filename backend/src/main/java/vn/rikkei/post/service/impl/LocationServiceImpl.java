package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.warehouse.WarehouseRequest;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Ward;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.ProvinceRepository;
import vn.rikkei.post.repository.WardRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.LocationService;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class LocationServiceImpl implements LocationService {

    private final ProvinceRepository provinceRepository;
    private final WardRepository wardRepository;
    private final WarehouseRepository warehouseRepository;

    @Override
    @Transactional(readOnly = true)
    public List<Province> getAllProvinces() {
        return provinceRepository.findByIsActiveTrueOrderByDisplayOrderAscNameAsc();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ward> getWardsByProvinceId(Integer provinceId) {
        if (provinceId == null) {
            return List.of();
        }
        return wardRepository.findByProvinceIdAndIsActiveTrueOrderByNameAsc(provinceId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Ward> searchWards(Integer provinceId, String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return getWardsByProvinceId(provinceId);
        }
        if (provinceId != null) {
            return wardRepository.findByProvinceIdAndNameContainingIgnoreCaseAndIsActiveTrue(provinceId, keyword.trim());
        }
        return wardRepository.findByNameContainingIgnoreCaseAndIsActiveTrue(keyword.trim());
    }

    @Override
    @Transactional(readOnly = true)
    public List<Warehouse> getWarehouses(Integer provinceId) {
        if (provinceId != null) {
            return warehouseRepository.findByProvinceIdAndIsActiveTrue(provinceId);
        }
        return warehouseRepository.findByIsActiveTrue();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Warehouse> getAllWarehouses(CustomUserDetails currentUser) {
        if (currentUser == null) {
            return warehouseRepository.findByIsActiveTrue();
        }

        boolean isAdmin = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        boolean isBranchManager = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_BRANCH_MANAGER".equals(a.getAuthority()));

        if (isAdmin) {
            return warehouseRepository.findAll();
        } else if (isBranchManager && currentUser.getManagedProvinceId() != null) {
            return warehouseRepository.findByProvinceId(currentUser.getManagedProvinceId());
        }

        return warehouseRepository.findByIsActiveTrue();
    }

    @Override
    @Transactional
    public Warehouse createWarehouse(WarehouseRequest request, CustomUserDetails currentUser) {
        validateWarehouseManageAuthority(currentUser, request.getProvinceId(), "tạo kho/bưu cục mới");

        final String cleanCode = request.getCode().trim().toUpperCase();
        if (warehouseRepository.findByCode(cleanCode).isPresent()) {
            throw new IllegalArgumentException("Mã kho/bưu cục [" + cleanCode + "] đã tồn tại trên hệ thống! Vui lòng chọn mã khác.");
        }

        Warehouse warehouse = Warehouse.builder()
                .code(cleanCode)
                .name(request.getName().trim())
                .type(request.getType().trim().toUpperCase())
                .provinceId(request.getProvinceId())
                .districtId(request.getDistrictId() != null ? request.getDistrictId() : 0)
                .address(request.getAddress().trim())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .capacityPackages(request.getCapacityPackages() != null ? request.getCapacityPackages() : 50000)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        Warehouse saved = warehouseRepository.save(warehouse);
        log.info("Người dùng {} đã tạo kho/bưu cục mới: {} - {}", currentUser.getUsername(), saved.getCode(), saved.getName());
        return saved;
    }

    @Override
    @Transactional
    public Warehouse updateWarehouse(Long id, WarehouseRequest request, CustomUserDetails currentUser) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho/bưu cục với ID: " + id));

        validateWarehouseManageAuthority(currentUser, warehouse.getProvinceId(), "chỉnh sửa thông tin kho/bưu cục");
        if (!warehouse.getProvinceId().equals(request.getProvinceId())) {
            validateWarehouseManageAuthority(currentUser, request.getProvinceId(), "chuyển kho/bưu cục sang tỉnh khác");
        }

        final String cleanCode = request.getCode().trim().toUpperCase();
        if (!warehouse.getCode().equalsIgnoreCase(cleanCode)) {
            if (warehouseRepository.findByCode(cleanCode).isPresent()) {
                throw new IllegalArgumentException("Mã kho/bưu cục [" + cleanCode + "] đã tồn tại trên hệ thống!");
            }
            warehouse.setCode(cleanCode);
        }

        warehouse.setName(request.getName().trim());
        warehouse.setType(request.getType().trim().toUpperCase());
        warehouse.setProvinceId(request.getProvinceId());
        if (request.getDistrictId() != null) {
            warehouse.setDistrictId(request.getDistrictId());
        }
        warehouse.setAddress(request.getAddress().trim());
        warehouse.setLatitude(request.getLatitude());
        warehouse.setLongitude(request.getLongitude());
        if (request.getCapacityPackages() != null) {
            warehouse.setCapacityPackages(request.getCapacityPackages());
        }
        if (request.getIsActive() != null) {
            warehouse.setIsActive(request.getIsActive());
        }

        Warehouse saved = warehouseRepository.save(warehouse);
        log.info("Người dùng {} đã cập nhật kho/bưu cục: {} - {}", currentUser.getUsername(), saved.getCode(), saved.getName());
        return saved;
    }

    @Override
    @Transactional
    public Warehouse toggleWarehouseStatus(Long id, CustomUserDetails currentUser) {
        Warehouse warehouse = warehouseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho/bưu cục với ID: " + id));

        validateWarehouseManageAuthority(currentUser, warehouse.getProvinceId(), "thay đổi trạng thái kho/bưu cục");

        warehouse.setIsActive(!warehouse.getIsActive());
        Warehouse saved = warehouseRepository.save(warehouse);
        log.info("Người dùng {} đã đổi trạng thái kho/bưu cục {} sang isActive={}",
                currentUser.getUsername(), saved.getCode(), saved.getIsActive());
        return saved;
    }

    private void validateWarehouseManageAuthority(CustomUserDetails currentUser, Integer targetProvinceId, String actionName) {
        if (currentUser == null) {
            throw new AccessDeniedException("Yêu cầu đăng nhập để thực hiện tác vụ này!");
        }

        boolean isAdmin = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        boolean isBranchManager = currentUser.getAuthorities().stream().anyMatch(a -> "ROLE_BRANCH_MANAGER".equals(a.getAuthority()));

        if (!isAdmin && !isBranchManager) {
            throw new AccessDeniedException("Chỉ Quản trị viên (Admin) hoặc Quản lý chi nhánh mới có quyền " + actionName + "!");
        }

        if (isBranchManager && !isAdmin) {
            if (currentUser.getManagedProvinceId() == null || !currentUser.getManagedProvinceId().equals(targetProvinceId)) {
                throw new AccessDeniedException("Quản lý chi nhánh chỉ có quyền " + actionName + " thuộc tỉnh/thành phố chi nhánh mình được phân công quản lý!");
            }
        }
    }
}
