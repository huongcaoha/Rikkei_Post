package vn.rikkei.post.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.rikkei.post.entity.SupplyTicket;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplyTicketRepository extends JpaRepository<SupplyTicket, Long> {
    Optional<SupplyTicket> findByTicketCode(String ticketCode);
    List<SupplyTicket> findByWarehouseIdOrderByCreatedAtDesc(Long warehouseId);
    List<SupplyTicket> findByTicketTypeOrderByCreatedAtDesc(String ticketType);
    List<SupplyTicket> findAllByOrderByCreatedAtDesc();
}
