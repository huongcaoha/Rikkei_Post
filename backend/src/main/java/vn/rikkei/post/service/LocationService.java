package vn.rikkei.post.service;

import vn.rikkei.post.entity.Province;
import vn.rikkei.post.entity.Ward;
import vn.rikkei.post.entity.Warehouse;

import java.util.List;

public interface LocationService {
    List<Province> getAllProvinces();
    List<Ward> getWardsByProvinceId(Integer provinceId);
    List<Ward> searchWards(Integer provinceId, String keyword);
    List<Warehouse> getWarehouses(Integer provinceId);
}
