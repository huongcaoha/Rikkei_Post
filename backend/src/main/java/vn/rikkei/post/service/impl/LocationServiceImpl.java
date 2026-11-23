package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Ward;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.ProvinceRepository;
import vn.rikkei.post.repository.WardRepository;
import vn.rikkei.post.repository.WarehouseRepository;
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
}
