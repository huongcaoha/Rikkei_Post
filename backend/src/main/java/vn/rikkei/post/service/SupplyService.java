package vn.rikkei.post.service;

import vn.rikkei.post.dto.supply.SupplyDto;
import vn.rikkei.post.entity.*;

import java.util.List;

public interface SupplyService {

    // Kho vật tư
    List<SupplyWarehouse> getAllWarehouses();
    SupplyWarehouse getWarehouseById(Long id);
    SupplyWarehouse createWarehouse(SupplyDto.CreateWarehouseRequest request, Long userId);
    SupplyWarehouse updateWarehouse(Long id, SupplyDto.CreateWarehouseRequest request, Long userId);
    void deleteWarehouse(Long id);

    // Danh mục vật tư
    List<SupplyItem> getAllItems(String category);
    SupplyItem getItemById(Long id);
    SupplyItem createItem(SupplyDto.CreateItemRequest request, Long userId);
    SupplyItem updateItem(Long id, SupplyDto.CreateItemRequest request, Long userId);

    // Tồn kho
    List<SupplyDto.InventoryDetailDto> getInventories(Long warehouseId, String category);
    SupplyInventory updateInventoryQuantity(Long warehouseId, Long itemId, int quantity, int damagedQuantity);

    // Phiếu xuất nhập kho
    List<SupplyTicket> getTickets(String ticketType, Long warehouseId);
    SupplyTicket getTicketById(Long id);
    SupplyTicket createTicket(SupplyDto.CreateTicketRequest request, Long userId);

    // Phiếu thu hồi đồ hỏng
    List<EquipmentRecallTicket> getRecallTickets(String status, Long postOfficeId);
    EquipmentRecallTicket getRecallTicketById(Long id);
    EquipmentRecallTicket createRecallTicket(SupplyDto.CreateRecallRequest request, Long userId);
    EquipmentRecallTicket resolveRecallTicket(Long id, SupplyDto.ResolveRecallRequest request, Long userId);

    // Dashboard KPI
    SupplyDto.DashboardStats getDashboardStats();
}
