package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.AttendanceRecord;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {
    Optional<AttendanceRecord> findByUserIdAndWorkDate(Long userId, LocalDate workDate);
    List<AttendanceRecord> findByUserIdAndWorkDateBetweenOrderByWorkDateAsc(Long userId, LocalDate startDate, LocalDate endDate);
    List<AttendanceRecord> findByWarehouseIdAndWorkDateOrderByCheckInTimeDesc(Long warehouseId, LocalDate workDate);
    List<AttendanceRecord> findByWarehouseIdAndWorkDateBetweenOrderByWorkDateAsc(Long warehouseId, LocalDate startDate, LocalDate endDate);
    long countByUserIdAndWorkDateBetweenAndStatusIn(Long userId, LocalDate startDate, LocalDate endDate, List<String> statuses);
}
