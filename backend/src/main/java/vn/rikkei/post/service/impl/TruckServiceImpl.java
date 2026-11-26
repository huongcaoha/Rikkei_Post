package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.truck.CreateTruckRequest;
import vn.rikkei.post.dto.truck.TruckResponse;
import vn.rikkei.post.dto.truck.UpdateTruckRequest;
import vn.rikkei.post.entity.Truck;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.TruckRepository;
import vn.rikkei.post.repository.UserRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.TruckService;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TruckServiceImpl implements TruckService {

    private final TruckRepository truckRepository;
    private final WarehouseRepository warehouseRepository;
    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public List<TruckResponse> getAllTrucks(Long warehouseId, String status, String keyword) {
        List<Truck> trucks;
        if (warehouseId != null) {
            trucks = truckRepository.findByCurrentWarehouseIdOrderByCreatedAtDesc(warehouseId);
        } else if (status != null && !status.isBlank()) {
            trucks = truckRepository.findByStatusOrderByCreatedAtDesc(status.trim().toUpperCase());
        } else {
            trucks = truckRepository.findAllByOrderByCreatedAtDesc();
        }

        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim().toLowerCase();
            trucks = trucks.stream()
                    .filter(t -> (t.getLicensePlate() != null && t.getLicensePlate().toLowerCase().contains(kw))
                            || (t.getTruckType() != null && t.getTruckType().toLowerCase().contains(kw))
                            || (t.getCurrentDriverName() != null && t.getCurrentDriverName().toLowerCase().contains(kw)))
                    .toList();
        }

        return trucks.stream().map(this::mapToResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public TruckResponse getTruckById(Long id) {
        Truck truck = truckRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy xe tải ID: " + id));
        return mapToResponse(truck);
    }

    @Override
    @Transactional
    public TruckResponse createTruck(CreateTruckRequest request, Long userId) {
        String cleanPlate = request.getLicensePlate().trim().toUpperCase();
        if (truckRepository.existsByLicensePlate(cleanPlate)) {
            throw new IllegalArgumentException("Biển số xe [" + cleanPlate + "] đã tồn tại trên hệ thống!");
        }

        Warehouse warehouse = warehouseRepository.findById(request.getCurrentWarehouseId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy Kho / HUB ID: " + request.getCurrentWarehouseId()));

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
                boolean isBranchManager = user.getRoles().stream().anyMatch(r -> "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()));
                if (!isAdmin && isBranchManager && user.getManagedProvinceId() != null) {
                    if (!user.getManagedProvinceId().equals(warehouse.getProvinceId())) {
                        throw new IllegalArgumentException("Quản lý chi nhánh chỉ được thêm xe tải vào các kho bưu cục trực thuộc tỉnh/thành phố mình quản lý!");
                    }
                }
            }
        }

        User driver = null;
        if (request.getCurrentDriverId() != null) {
            driver = userRepository.findById(request.getCurrentDriverId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài xế ID: " + request.getCurrentDriverId()));
        }

        String status = (request.getStatus() != null && !request.getStatus().isBlank())
                ? request.getStatus().trim().toUpperCase()
                : "AT_WAREHOUSE";

        Truck truck = Truck.builder()
                .truckType(request.getTruckType().trim())
                .payloadKg(request.getPayloadKg())
                .licensePlate(cleanPlate)
                .currentWarehouse(warehouse)
                .status(status)
                .currentDriverId(driver != null ? driver.getId() : null)
                .currentDriverName(driver != null ? driver.getFullName() : null)
                .currentDriverPhone(driver != null ? driver.getPhoneNumber() : null)
                .notes(request.getNotes())
                .build();

        Truck saved = truckRepository.save(truck);
        log.info("Đã tạo mới xe tải {} ({}) thuộc kho {}", saved.getLicensePlate(), saved.getTruckType(), warehouse.getName());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public TruckResponse updateTruck(Long id, UpdateTruckRequest request, Long userId) {
        Truck truck = truckRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy xe tải ID: " + id));

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
                boolean isBranchManager = user.getRoles().stream().anyMatch(r -> "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()));
                if (!isAdmin && isBranchManager && user.getManagedProvinceId() != null) {
                    if (truck.getCurrentWarehouse() != null && !user.getManagedProvinceId().equals(truck.getCurrentWarehouse().getProvinceId())) {
                        throw new IllegalArgumentException("Quản lý chi nhánh chỉ được chỉnh sửa thông tin xe tải thuộc khu vực tỉnh/thành phố mình quản lý!");
                    }
                }
            }
        }

        if (request.getLicensePlate() != null && !request.getLicensePlate().isBlank()) {
            String cleanPlate = request.getLicensePlate().trim().toUpperCase();
            if (!cleanPlate.equalsIgnoreCase(truck.getLicensePlate()) && truckRepository.existsByLicensePlate(cleanPlate)) {
                throw new IllegalArgumentException("Biển số xe [" + cleanPlate + "] đã được sử dụng bởi xe khác!");
            }
            truck.setLicensePlate(cleanPlate);
        }

        if (request.getTruckType() != null && !request.getTruckType().isBlank()) {
            truck.setTruckType(request.getTruckType().trim());
        }

        if (request.getPayloadKg() != null && request.getPayloadKg() > 0) {
            truck.setPayloadKg(request.getPayloadKg());
        }

        if (request.getCurrentWarehouseId() != null) {
            Warehouse warehouse = warehouseRepository.findById(request.getCurrentWarehouseId())
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy Kho / HUB ID: " + request.getCurrentWarehouseId()));
            truck.setCurrentWarehouse(warehouse);
        }

        if (request.getStatus() != null && !request.getStatus().isBlank()) {
            truck.setStatus(request.getStatus().trim().toUpperCase());
        }

        if (request.getCurrentDriverId() != null) {
            if (request.getCurrentDriverId() == 0L) {
                truck.setCurrentDriverId(null);
                truck.setCurrentDriverName(null);
                truck.setCurrentDriverPhone(null);
            } else {
                User driver = userRepository.findById(request.getCurrentDriverId())
                        .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài xế ID: " + request.getCurrentDriverId()));
                truck.setCurrentDriverId(driver.getId());
                truck.setCurrentDriverName(driver.getFullName());
                truck.setCurrentDriverPhone(driver.getPhoneNumber());
            }
        }

        if (request.getNotes() != null) {
            truck.setNotes(request.getNotes());
        }

        Truck saved = truckRepository.save(truck);
        log.info("Đã cập nhật thông tin xe tải {} ID {}", saved.getLicensePlate(), saved.getId());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public void deleteTruck(Long id, Long userId) {
        Truck truck = truckRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy xe tải ID: " + id));

        if ("IN_TRANSIT".equalsIgnoreCase(truck.getStatus())) {
            throw new IllegalStateException("Xe tải [" + truck.getLicensePlate() + "] đang trong hành trình trung chuyển đơn hàng, không thể xóa!");
        }

        truckRepository.delete(truck);
        log.info("Đã xóa xe tải {} ID {}", truck.getLicensePlate(), id);
    }

    @Override
    @Transactional
    public TruckResponse assignDriver(Long truckId, Long driverId, Long userId) {
        Truck truck = truckRepository.findById(truckId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy xe tải ID: " + truckId));

        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getRoleName()));
                boolean isBranchManager = user.getRoles().stream().anyMatch(r -> "ROLE_BRANCH_MANAGER".equalsIgnoreCase(r.getRoleName()));
                // Quản lý kho / Nhân viên kho: chỉ được phân công xe thuộc kho trực thuộc của mình
                if (!isAdmin && !isBranchManager) {
                    if (user.getAssignedPostOfficeId() != null) {
                        if (truck.getCurrentWarehouse() == null || !user.getAssignedPostOfficeId().equals(truck.getCurrentWarehouse().getId())) {
                            throw new IllegalArgumentException("Bạn chỉ có quyền phân công tài xế cho xe tải thuộc kho bưu cục trực thuộc quản lý của bạn!");
                        }
                    }
                }
            }
        }

        if (driverId == null || driverId == 0L) {
            truck.setCurrentDriverId(null);
            truck.setCurrentDriverName(null);
            truck.setCurrentDriverPhone(null);
        } else {
            User driver = userRepository.findById(driverId)
                    .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài xế ID: " + driverId));
            boolean isDriver = driver.getRoles().stream().anyMatch(r -> "ROLE_TRUCK_DRIVER".equalsIgnoreCase(r.getRoleName()) || "ROLE_SHIPPER".equalsIgnoreCase(r.getRoleName()));
            if (!isDriver) {
                throw new IllegalArgumentException("Người dùng [" + driver.getFullName() + "] không có vai trò Tài xế xe tải (ROLE_TRUCK_DRIVER)!");
            }
            truck.setCurrentDriverId(driver.getId());
            truck.setCurrentDriverName(driver.getFullName());
            truck.setCurrentDriverPhone(driver.getPhoneNumber());
        }

        Truck saved = truckRepository.save(truck);
        log.info("Đã gán tài xế {} cho xe tải {}", saved.getCurrentDriverName(), saved.getLicensePlate());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public TruckResponse updateStatus(Long truckId, String status, Long userId) {
        Truck truck = truckRepository.findById(truckId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy xe tải ID: " + truckId));

        String cleanStatus = status != null ? status.trim().toUpperCase() : "AT_WAREHOUSE";
        truck.setStatus(cleanStatus);
        Truck saved = truckRepository.save(truck);
        return mapToResponse(saved);
    }

    private TruckResponse mapToResponse(Truck t) {
        String desc = switch (t.getStatus()) {
            case "AT_WAREHOUSE" -> "Đang ở kho";
            case "IN_TRANSIT" -> "Đang đi trung chuyển đơn hàng";
            case "MAINTENANCE" -> "Đang bảo dưỡng";
            default -> t.getStatus();
        };

        return TruckResponse.builder()
                .id(t.getId())
                .truckType(t.getTruckType())
                .payloadKg(t.getPayloadKg())
                .licensePlate(t.getLicensePlate())
                .currentWarehouseId(t.getCurrentWarehouse() != null ? t.getCurrentWarehouse().getId() : null)
                .currentWarehouseName(t.getCurrentWarehouse() != null ? t.getCurrentWarehouse().getName() : null)
                .currentWarehouseCode(t.getCurrentWarehouse() != null ? t.getCurrentWarehouse().getCode() : null)
                .currentWarehouseType(t.getCurrentWarehouse() != null ? t.getCurrentWarehouse().getType() : null)
                .status(t.getStatus())
                .statusDescription(desc)
                .currentDriverId(t.getCurrentDriverId())
                .currentDriverName(t.getCurrentDriverName())
                .currentDriverPhone(t.getCurrentDriverPhone())
                .notes(t.getNotes())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }
}
