package vn.rikkei.post.service;

import vn.rikkei.post.dto.warehouse.WarehouseRequest;
import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Ward;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.security.CustomUserDetails;

import java.util.List;

public interface LocationService {
    List<Province> getAllProvinces();
    List<Ward> getWardsByProvinceId(Integer provinceId);
    List<Ward> searchWards(Integer provinceId, String keyword);
    List<Warehouse> getWarehouses(Integer provinceId);
    List<Warehouse> getAllWarehouses(CustomUserDetails currentUser);
    Warehouse createWarehouse(WarehouseRequest request, CustomUserDetails currentUser);
    Warehouse updateWarehouse(Long id, WarehouseRequest request, CustomUserDetails currentUser);
    Warehouse toggleWarehouseStatus(Long id, CustomUserDetails currentUser);
}
