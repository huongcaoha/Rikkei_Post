package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.Truck;

import java.util.List;
import java.util.Optional;

@Repository
public interface TruckRepository extends JpaRepository<Truck, Long> {

    Optional<Truck> findByLicensePlate(String licensePlate);

    boolean existsByLicensePlate(String licensePlate);

    List<Truck> findByCurrentWarehouseIdOrderByCreatedAtDesc(Long warehouseId);

    List<Truck> findByStatusOrderByCreatedAtDesc(String status);

    List<Truck> findAllByOrderByCreatedAtDesc();

    List<Truck> findByCurrentDriverId(Long driverId);
}
