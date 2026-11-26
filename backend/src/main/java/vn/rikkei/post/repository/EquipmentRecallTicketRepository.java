package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.EquipmentRecallTicket;

import java.util.List;
import java.util.Optional;

@Repository
public interface EquipmentRecallTicketRepository extends JpaRepository<EquipmentRecallTicket, Long> {
    Optional<EquipmentRecallTicket> findByTicketCode(String ticketCode);
    List<EquipmentRecallTicket> findByStatusOrderByCreatedAtDesc(String status);
    List<EquipmentRecallTicket> findByPostOfficeIdOrderByCreatedAtDesc(Long postOfficeId);
    List<EquipmentRecallTicket> findAllByOrderByCreatedAtDesc();
    long countByStatus(String status);
}
