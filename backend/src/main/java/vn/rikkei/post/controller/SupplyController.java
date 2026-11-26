package vn.rikkei.post.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.rikkei.post.dto.common.ApiResponse;
import vn.rikkei.post.dto.supply.SupplyDto;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.security.CustomUserDetails;
import vn.rikkei.post.service.SupplyService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/supplies")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER', 'POST_OFFICE_MANAGER', 'BRANCH_MANAGER', 'WAREHOUSE_STAFF')")
public class SupplyController {

    private final SupplyService supplyService;

    // ================= DASHBOARD =================

    @GetMapping("/dashboard/stats")
    public ResponseEntity<ApiResponse<SupplyDto.DashboardStats>> getDashboardStats() {
        SupplyDto.DashboardStats stats = supplyService.getDashboardStats();
        return ResponseEntity.ok(ApiResponse.success(stats));
    }

    // ================= KHO VẬT TƯ =================

    @GetMapping("/warehouses")
    public ResponseEntity<ApiResponse<List<SupplyWarehouse>>> getAllWarehouses() {
        List<SupplyWarehouse> list = supplyService.getAllWarehouses();
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/warehouses/{id}")
    public ResponseEntity<ApiResponse<SupplyWarehouse>> getWarehouseById(@PathVariable Long id) {
        SupplyWarehouse wh = supplyService.getWarehouseById(id);
        return ResponseEntity.ok(ApiResponse.success(wh));
    }

    @PostMapping("/warehouses")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER')")
    public ResponseEntity<ApiResponse<SupplyWarehouse>> createWarehouse(
            @Valid @RequestBody SupplyDto.CreateWarehouseRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        SupplyWarehouse wh = supplyService.createWarehouse(request, userId);
        return ResponseEntity.ok(ApiResponse.success(wh, "Tạo mới kho vật tư thành công"));
    }

    @PutMapping("/warehouses/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER')")
    public ResponseEntity<ApiResponse<SupplyWarehouse>> updateWarehouse(
            @PathVariable Long id,
            @Valid @RequestBody SupplyDto.CreateWarehouseRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        SupplyWarehouse wh = supplyService.updateWarehouse(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(wh, "Cập nhật kho vật tư thành công"));
    }

    @DeleteMapping("/warehouses/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteWarehouse(@PathVariable Long id) {
        supplyService.deleteWarehouse(id);
        return ResponseEntity.ok(ApiResponse.success(null, "Đã xóa kho vật tư thành công"));
    }

    // ================= DANH MỤC VẬT TƯ =================

    @GetMapping("/items")
    public ResponseEntity<ApiResponse<List<SupplyItem>>> getAllItems(
            @RequestParam(required = false) String category
    ) {
        List<SupplyItem> list = supplyService.getAllItems(category);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/items/{id}")
    public ResponseEntity<ApiResponse<SupplyItem>> getItemById(@PathVariable Long id) {
        SupplyItem item = supplyService.getItemById(id);
        return ResponseEntity.ok(ApiResponse.success(item));
    }

    @PostMapping("/items")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER')")
    public ResponseEntity<ApiResponse<SupplyItem>> createItem(
            @Valid @RequestBody SupplyDto.CreateItemRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        SupplyItem item = supplyService.createItem(request, userId);
        return ResponseEntity.ok(ApiResponse.success(item, "Tạo mới danh mục vật tư thành công"));
    }

    @PutMapping("/items/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER')")
    public ResponseEntity<ApiResponse<SupplyItem>> updateItem(
            @PathVariable Long id,
            @Valid @RequestBody SupplyDto.CreateItemRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        SupplyItem item = supplyService.updateItem(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(item, "Cập nhật vật tư thành công"));
    }

    // ================= TỒN KHO =================

    @GetMapping("/inventories")
    public ResponseEntity<ApiResponse<List<SupplyDto.InventoryDetailDto>>> getInventories(
            @RequestParam(required = false) Long warehouseId,
            @RequestParam(required = false) String category
    ) {
        List<SupplyDto.InventoryDetailDto> list = supplyService.getInventories(warehouseId, category);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @PutMapping("/inventories")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER')")
    public ResponseEntity<ApiResponse<SupplyInventory>> updateStock(
            @RequestBody Map<String, Object> payload
    ) {
        Long warehouseId = Long.valueOf(payload.get("warehouseId").toString());
        Long itemId = Long.valueOf(payload.get("itemId").toString());
        int quantity = Integer.parseInt(payload.get("quantity").toString());
        int damagedQuantity = payload.containsKey("damagedQuantity") ? Integer.parseInt(payload.get("damagedQuantity").toString()) : 0;

        SupplyInventory inv = supplyService.updateInventoryQuantity(warehouseId, itemId, quantity, damagedQuantity);
        return ResponseEntity.ok(ApiResponse.success(inv, "Cập nhật số lượng tồn kho thành công"));
    }

    // ================= PHIẾU XUẤT NHẬP KHO =================

    @GetMapping("/tickets")
    public ResponseEntity<ApiResponse<List<SupplyDto.SupplyTicketResponse>>> getTickets(
            @RequestParam(required = false) String ticketType,
            @RequestParam(required = false) Long warehouseId
    ) {
        List<SupplyDto.SupplyTicketResponse> list = supplyService.getTickets(ticketType, warehouseId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<ApiResponse<SupplyDto.SupplyTicketResponse>> getTicketById(@PathVariable Long id) {
        SupplyDto.SupplyTicketResponse ticket = supplyService.getTicketById(id);
        return ResponseEntity.ok(ApiResponse.success(ticket));
    }

    @PostMapping("/tickets")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER')")
    public ResponseEntity<ApiResponse<SupplyDto.SupplyTicketResponse>> createTicket(
            @Valid @RequestBody SupplyDto.CreateTicketRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        SupplyDto.SupplyTicketResponse ticket = supplyService.createTicket(request, userId);
        return ResponseEntity.ok(ApiResponse.success(ticket, "Tạo phiếu xuất/nhập kho thành công"));
    }

    @PostMapping("/tickets/{id}/confirm-received")
    @PreAuthorize("hasAnyRole('ADMIN', 'POST_OFFICE_MANAGER', 'INVENTORY_MANAGER', 'BRANCH_MANAGER', 'WAREHOUSE_STAFF')")
    public ResponseEntity<ApiResponse<SupplyDto.SupplyTicketResponse>> confirmReceivedTicket(
            @PathVariable Long id,
            @RequestBody(required = false) SupplyDto.ConfirmReceivedTicketRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        SupplyDto.SupplyTicketResponse ticket = supplyService.confirmReceivedTicket(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(ticket, "Đã xác nhận nhận đủ vật tư, thiết bị thành công"));
    }

    // ================= PHIẾU THU HỒI ĐỒ HỎNG =================

    @GetMapping("/recalls")
    public ResponseEntity<ApiResponse<List<EquipmentRecallTicket>>> getRecallTickets(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long postOfficeId
    ) {
        List<EquipmentRecallTicket> list = supplyService.getRecallTickets(status, postOfficeId);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/recalls/{id}")
    public ResponseEntity<ApiResponse<EquipmentRecallTicket>> getRecallById(@PathVariable Long id) {
        EquipmentRecallTicket ticket = supplyService.getRecallTicketById(id);
        return ResponseEntity.ok(ApiResponse.success(ticket));
    }

    @PostMapping("/recalls")
    public ResponseEntity<ApiResponse<EquipmentRecallTicket>> createRecallTicket(
            @Valid @RequestBody SupplyDto.CreateRecallRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        EquipmentRecallTicket ticket = supplyService.createRecallTicket(request, userId);
        return ResponseEntity.ok(ApiResponse.success(ticket, "Tạo phiếu thu hồi đồ hỏng thành công (Trạng thái: Chờ thu hồi)"));
    }

    @PostMapping("/recalls/{id}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN', 'INVENTORY_MANAGER')")
    public ResponseEntity<ApiResponse<EquipmentRecallTicket>> resolveRecallTicket(
            @PathVariable Long id,
            @Valid @RequestBody SupplyDto.ResolveRecallRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        Long userId = userDetails != null ? userDetails.getId() : 1L;
        EquipmentRecallTicket ticket = supplyService.resolveRecallTicket(id, request, userId);
        return ResponseEntity.ok(ApiResponse.success(ticket, "Đã xác nhận thu hồi thiết bị hỏng thành công"));
    }
}
