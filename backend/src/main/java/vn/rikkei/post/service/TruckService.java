package vn.rikkei.post.service;

import vn.rikkei.post.dto.truck.CreateTruckRequest;
import vn.rikkei.post.dto.truck.TruckResponse;
import vn.rikkei.post.dto.truck.UpdateTruckRequest;

import java.util.List;

public interface TruckService {

    List<TruckResponse> getAllTrucks(Long warehouseId, String status, String keyword);

    TruckResponse getTruckById(Long id);

    TruckResponse createTruck(CreateTruckRequest request, Long userId);

    TruckResponse updateTruck(Long id, UpdateTruckRequest request, Long userId);

    void deleteTruck(Long id, Long userId);

    TruckResponse assignDriver(Long truckId, Long driverId, Long userId);

    TruckResponse updateStatus(Long truckId, String status, Long userId);
}
