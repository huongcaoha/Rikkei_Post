package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.supply.SupplyDto;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.SupplyService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SupplyServiceImpl implements SupplyService {

    private final SupplyWarehouseRepository warehouseRepository;
    private final SupplyItemRepository itemRepository;
    private final SupplyInventoryRepository inventoryRepository;
    private final SupplyTicketRepository ticketRepository;
    private final EquipmentRecallTicketRepository recallRepository;
    private final UserRepository userRepository;
    private final WarehouseRepository postOfficeRepository;
    private final vn.rikkei.post.service.NotificationService notificationService;

    // ================= KHO VẬT TƯ =================

    @Override
    @Transactional(readOnly = true)
    public List<SupplyWarehouse> getAllWarehouses() {
        return warehouseRepository.findAllByOrderByCreatedAtDesc();
    }

    @Override
    @Transactional(readOnly = true)
    public SupplyWarehouse getWarehouseById(Long id) {
        return warehouseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho vật tư ID: " + id));
    }

    @Override
    @Transactional
    public SupplyWarehouse createWarehouse(SupplyDto.CreateWarehouseRequest req, Long userId) {
        String cleanCode = req.getCode().trim().toUpperCase();
        if (warehouseRepository.existsByCode(cleanCode)) {
            throw new IllegalArgumentException("Mã kho vật tư [" + cleanCode + "] đã tồn tại!");
        }

        SupplyWarehouse wh = SupplyWarehouse.builder()
                .code(cleanCode)
                .name(req.getName().trim())
                .address(req.getAddress().trim())
                .googleMapsUrl(req.getGoogleMapsUrl())
                .latitude(req.getLatitude())
                .longitude(req.getLongitude())
                .managerId(req.getManagerId())
                .managerName(req.getManagerName())
                .managerPhone(req.getManagerPhone())
                .status(req.getStatus() != null && !req.getStatus().isBlank() ? req.getStatus().trim().toUpperCase() : "ACTIVE")
                .notes(req.getNotes())
                .build();

        SupplyWarehouse saved = warehouseRepository.save(wh);
        log.info("Đã tạo mới kho vật tư: {} ({})", saved.getName(), saved.getCode());
        return saved;
    }

    @Override
    @Transactional
    public SupplyWarehouse updateWarehouse(Long id, SupplyDto.CreateWarehouseRequest req, Long userId) {
        SupplyWarehouse wh = getWarehouseById(id);

        if (req.getCode() != null && !req.getCode().isBlank()) {
            String cleanCode = req.getCode().trim().toUpperCase();
            if (!cleanCode.equalsIgnoreCase(wh.getCode()) && warehouseRepository.existsByCode(cleanCode)) {
                throw new IllegalArgumentException("Mã kho vật tư [" + cleanCode + "] đã tồn tại!");
            }
            wh.setCode(cleanCode);
        }

        if (req.getName() != null && !req.getName().isBlank()) wh.setName(req.getName().trim());
        if (req.getAddress() != null && !req.getAddress().isBlank()) wh.setAddress(req.getAddress().trim());
        if (req.getGoogleMapsUrl() != null) wh.setGoogleMapsUrl(req.getGoogleMapsUrl());
        if (req.getLatitude() != null) wh.setLatitude(req.getLatitude());
        if (req.getLongitude() != null) wh.setLongitude(req.getLongitude());
        if (req.getManagerId() != null) wh.setManagerId(req.getManagerId());
        if (req.getManagerName() != null) wh.setManagerName(req.getManagerName());
        if (req.getManagerPhone() != null) wh.setManagerPhone(req.getManagerPhone());
        if (req.getStatus() != null && !req.getStatus().isBlank()) wh.setStatus(req.getStatus().trim().toUpperCase());
        if (req.getNotes() != null) wh.setNotes(req.getNotes());

        return warehouseRepository.save(wh);
    }

    @Override
    @Transactional
    public void deleteWarehouse(Long id) {
        SupplyWarehouse wh = getWarehouseById(id);
        List<SupplyInventory> invList = inventoryRepository.findByWarehouseId(id);
        int totalStock = invList.stream().mapToInt(SupplyInventory::getQuantity).sum();
        if (totalStock > 0) {
            throw new IllegalStateException("Kho vật tư [" + wh.getName() + "] hiện còn tồn kho " + totalStock + " vật tư, không thể xóa!");
        }
        warehouseRepository.delete(wh);
    }

    // ================= DANH MỤC VẬT TƯ =================

    @Override
    @Transactional(readOnly = true)
    public List<SupplyItem> getAllItems(String category) {
        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            return itemRepository.findByCategoryOrderByItemNameAsc(category.trim().toUpperCase());
        }
        return itemRepository.findAllByOrderByCreatedAtDesc();
    }

    @Override
    @Transactional(readOnly = true)
    public SupplyItem getItemById(Long id) {
        return itemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy vật tư ID: " + id));
    }

    @Override
    @Transactional
    public SupplyItem createItem(SupplyDto.CreateItemRequest req, Long userId) {
        String cleanCode = req.getItemCode().trim().toUpperCase();
        if (itemRepository.existsByItemCode(cleanCode)) {
            throw new IllegalArgumentException("Mã vật tư [" + cleanCode + "] đã tồn tại!");
        }

        SupplyItem item = SupplyItem.builder()
                .itemCode(cleanCode)
                .itemName(req.getItemName().trim())
                .category(req.getCategory().trim().toUpperCase())
                .unit(req.getUnit().trim())
                .specifications(req.getSpecifications())
                .standardPrice(req.getStandardPrice() != null ? req.getStandardPrice() : BigDecimal.ZERO)
                .minStockAlert(req.getMinStockAlert() != null ? req.getMinStockAlert() : 5)
                .isActive(req.getIsActive() != null ? req.getIsActive() : true)
                .build();

        return itemRepository.save(item);
    }

    @Override
    @Transactional
    public SupplyItem updateItem(Long id, SupplyDto.CreateItemRequest req, Long userId) {
        SupplyItem item = getItemById(id);

        if (req.getItemCode() != null && !req.getItemCode().isBlank()) {
            String cleanCode = req.getItemCode().trim().toUpperCase();
            if (!cleanCode.equalsIgnoreCase(item.getItemCode()) && itemRepository.existsByItemCode(cleanCode)) {
                throw new IllegalArgumentException("Mã vật tư [" + cleanCode + "] đã tồn tại!");
            }
            item.setItemCode(cleanCode);
        }

        if (req.getItemName() != null && !req.getItemName().isBlank()) item.setItemName(req.getItemName().trim());
        if (req.getCategory() != null && !req.getCategory().isBlank()) item.setCategory(req.getCategory().trim().toUpperCase());
        if (req.getUnit() != null && !req.getUnit().isBlank()) item.setUnit(req.getUnit().trim());
        if (req.getSpecifications() != null) item.setSpecifications(req.getSpecifications());
        if (req.getStandardPrice() != null) item.setStandardPrice(req.getStandardPrice());
        if (req.getMinStockAlert() != null) item.setMinStockAlert(req.getMinStockAlert());
        if (req.getIsActive() != null) item.setIsActive(req.getIsActive());

        return itemRepository.save(item);
    }

    // ================= TỒN KHO =================

    @Override
    @Transactional(readOnly = true)
    public List<SupplyDto.InventoryDetailDto> getInventories(Long warehouseId, String category) {
        List<SupplyInventory> list;
        if (warehouseId != null) {
            list = inventoryRepository.findByWarehouseId(warehouseId);
        } else {
            list = inventoryRepository.findAll();
        }

        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            String cleanCat = category.trim().toUpperCase();
            list = list.stream().filter(inv -> inv.getItem() != null && cleanCat.equalsIgnoreCase(inv.getItem().getCategory())).toList();
        }

        return list.stream().map(inv -> {
            SupplyItem item = inv.getItem();
            SupplyWarehouse wh = inv.getWarehouse();
            int minAlert = item != null && item.getMinStockAlert() != null ? item.getMinStockAlert() : 5;
            boolean isLow = inv.getQuantity() <= minAlert;

            return SupplyDto.InventoryDetailDto.builder()
                    .id(inv.getId())
                    .warehouseId(wh != null ? wh.getId() : null)
                    .warehouseName(wh != null ? wh.getName() : null)
                    .itemId(item != null ? item.getId() : null)
                    .itemCode(item != null ? item.getItemCode() : null)
                    .itemName(item != null ? item.getItemName() : null)
                    .category(item != null ? item.getCategory() : null)
                    .unit(item != null ? item.getUnit() : null)
                    .quantity(inv.getQuantity())
                    .damagedQuantity(inv.getDamagedQuantity())
                    .minStockAlert(minAlert)
                    .isLowStock(isLow)
                    .updatedAt(inv.getUpdatedAt())
                    .build();
        }).toList();
    }

    @Override
    @Transactional
    public SupplyInventory updateInventoryQuantity(Long warehouseId, Long itemId, int quantity, int damagedQuantity) {
        SupplyWarehouse wh = getWarehouseById(warehouseId);
        SupplyItem item = getItemById(itemId);

        SupplyInventory inv = inventoryRepository.findByWarehouseIdAndItemId(warehouseId, itemId)
                .orElse(SupplyInventory.builder()
                        .warehouse(wh)
                        .item(item)
                        .quantity(0)
                        .damagedQuantity(0)
                        .build());

        inv.setQuantity(quantity);
        inv.setDamagedQuantity(damagedQuantity);
        inv.setLastRestockedAt(LocalDateTime.now());
        return inventoryRepository.save(inv);
    }

    // ================= PHIẾU XUẤT NHẬP KHO =================

    @Override
    @Transactional(readOnly = true)
    public List<SupplyDto.SupplyTicketResponse> getTickets(String ticketType, Long warehouseId) {
        List<SupplyTicket> list;
        if (warehouseId != null) {
            list = ticketRepository.findByWarehouseIdOrderByCreatedAtDesc(warehouseId);
        } else if (ticketType != null && !ticketType.isBlank() && !"ALL".equalsIgnoreCase(ticketType)) {
            list = ticketRepository.findByTicketTypeOrderByCreatedAtDesc(ticketType.trim().toUpperCase());
        } else {
            list = ticketRepository.findAllByOrderByCreatedAtDesc();
        }
        return list.stream().map(this::mapToTicketResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public SupplyDto.SupplyTicketResponse getTicketById(Long id) {
        SupplyTicket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiếu xuất/nhập ID: " + id));
        return mapToTicketResponse(ticket);
    }

    @Override
    @Transactional
    public SupplyDto.SupplyTicketResponse createTicket(SupplyDto.CreateTicketRequest req, Long userId) {
        SupplyWarehouse warehouse = getWarehouseById(req.getWarehouseId());
        String type = req.getTicketType().trim().toUpperCase();
        if (!List.of("IMPORT", "EXPORT").contains(type)) {
            throw new IllegalArgumentException("Loại phiếu không hợp lệ (chỉ chấp nhận IMPORT hoặc EXPORT)");
        }

        User creator = userId != null ? userRepository.findById(userId).orElse(null) : null;

        String prefix = "IMPORT".equalsIgnoreCase(type) ? "PN_VT_" : "PX_VT_";
        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        int randSeq = (int) (1000 + Math.random() * 9000);
        String ticketCode = prefix + datePart + "_" + randSeq;

        String initialStatus = "EXPORT".equalsIgnoreCase(type) ? "CHO_XAC_NHAN" : "COMPLETED";

        SupplyTicket ticket = SupplyTicket.builder()
                .ticketCode(ticketCode)
                .ticketType(type)
                .warehouse(warehouse)
                .targetPostOfficeId(req.getTargetPostOfficeId())
                .targetPostOfficeName(req.getTargetPostOfficeName())
                .partnerOrSupplier(req.getPartnerOrSupplier())
                .reason(req.getReason())
                .status(initialStatus)
                .creatorId(userId)
                .creatorName(creator != null ? creator.getFullName() : "Quản lý kho")
                .notes(req.getNotes())
                .build();

        int totalQty = 0;
        List<SupplyTicketItem> ticketItems = new ArrayList<>();

        for (SupplyDto.TicketItemRequest itemReq : req.getItems()) {
            SupplyItem item = getItemById(itemReq.getItemId());
            int qty = itemReq.getQuantity();
            if (qty <= 0) {
                throw new IllegalArgumentException("Số lượng cho vật tư [" + item.getItemName() + "] phải lớn hơn 0!");
            }

            // Cập nhật tồn kho
            SupplyInventory inv = inventoryRepository.findByWarehouseIdAndItemId(warehouse.getId(), item.getId())
                    .orElse(SupplyInventory.builder()
                            .warehouse(warehouse)
                            .item(item)
                            .quantity(0)
                            .damagedQuantity(0)
                            .build());

            if ("EXPORT".equalsIgnoreCase(type)) {
                if (inv.getQuantity() < qty) {
                    throw new IllegalArgumentException("Vật tư [" + item.getItemName() + "] trong kho chỉ còn " 
                            + inv.getQuantity() + " " + item.getUnit() + ", không đủ số lượng xuất " + qty + "!");
                }
                inv.setQuantity(inv.getQuantity() - qty);
            } else {
                inv.setQuantity(inv.getQuantity() + qty);
                inv.setLastRestockedAt(LocalDateTime.now());
            }
            inventoryRepository.save(inv);

            SupplyTicketItem ti = SupplyTicketItem.builder()
                    .ticket(ticket)
                    .item(item)
                    .itemCode(item.getItemCode())
                    .itemName(item.getItemName())
                    .unit(item.getUnit())
                    .quantity(qty)
                    .unitPrice(itemReq.getUnitPrice() != null ? itemReq.getUnitPrice() : item.getStandardPrice())
                    .notes(itemReq.getNotes())
                    .build();

            ticketItems.add(ti);
            totalQty += qty;
        }

        ticket.setTotalQuantity(totalQty);
        ticket.setItems(ticketItems);
        SupplyTicket saved = ticketRepository.save(ticket);
        log.info("Đã tạo phiếu {} mã: {} tổng số lượng: {}", type, saved.getTicketCode(), totalQty);

        // Nếu là phiếu xuất cấp phát cho bưu cục, gửi thông báo đến quản lý bưu cục đích
        if ("EXPORT".equalsIgnoreCase(type) && req.getTargetPostOfficeId() != null) {
            String title = "📦 Phiếu xuất vật tư mới: " + saved.getTicketCode();
            String content = "Kho [" + warehouse.getName() + "] vừa xuất cấp phát " + totalQty 
                    + " vật tư, thiết bị cho bưu cục của bạn. Vui lòng kiểm đếm và bấm xác nhận nhận đủ đồ.";
            List<User> targetStaff = userRepository.findAll().stream()
                    .filter(u -> req.getTargetPostOfficeId().equals(u.getAssignedPostOfficeId()))
                    .toList();
            if (!targetStaff.isEmpty()) {
                for (User u : targetStaff) {
                    notificationService.createNotification(u.getId(), title, content, "SUPPLY_EXPORT", "/wms/supplies");
                }
            } else {
                notificationService.notifyUsersByRole("ROLE_POST_OFFICE_MANAGER", title, content, "SUPPLY_EXPORT", "/wms/supplies");
            }
        }

        return mapToTicketResponse(saved);
    }

    @Override
    @Transactional
    public SupplyDto.SupplyTicketResponse confirmReceivedTicket(Long id, SupplyDto.ConfirmReceivedTicketRequest req, Long userId) {
        SupplyTicket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiếu xuất/nhập ID: " + id));

        if ("COMPLETED".equalsIgnoreCase(ticket.getStatus())) {
            throw new IllegalStateException("Phiếu [" + ticket.getTicketCode() + "] đã ở trạng thái Hoàn thành, không thể sửa đổi hoặc thao tác lại!");
        }

        User receiver = userId != null ? userRepository.findById(userId).orElse(null) : null;
        String receiverName = receiver != null ? receiver.getFullName() : "Quản lý bưu cục";

        ticket.setStatus("COMPLETED");
        ticket.setReceivedByUserId(userId);
        ticket.setReceivedByName(receiverName);
        ticket.setReceivedAt(LocalDateTime.now());
        if (req != null && req.getNotes() != null && !req.getNotes().isBlank()) {
            ticket.setReceivedNotes(req.getNotes().trim());
        }

        SupplyTicket saved = ticketRepository.save(ticket);
        log.info("Phiếu {} đã được xác nhận nhận đủ đồ bởi {}", saved.getTicketCode(), receiverName);

        // Gửi thông báo đến người tạo phiếu xuất hoặc Quản lý kho vật tư
        String title = "✅ Đã nhận đủ vật tư: " + saved.getTicketCode();
        String content = "Bưu cục [" + (saved.getTargetPostOfficeName() != null ? saved.getTargetPostOfficeName() : "Đích") 
                + "] đã kiểm đếm và bấm xác nhận nhận đủ toàn bộ " + saved.getTotalQuantity() + " vật tư, thiết bị.";
        if (saved.getCreatorId() != null) {
            notificationService.createNotification(saved.getCreatorId(), title, content, "SUPPLY_CONFIRMED", "/wms/supplies");
        }
        notificationService.notifyUsersByRole("ROLE_INVENTORY_MANAGER", title, content, "SUPPLY_CONFIRMED", "/wms/supplies");

        return mapToTicketResponse(saved);
    }

    private SupplyDto.SupplyTicketResponse mapToTicketResponse(SupplyTicket ticket) {
        if (ticket == null) return null;
        SupplyWarehouse wh = ticket.getWarehouse();
        List<SupplyDto.SupplyTicketItemResponse> itemResponses = new ArrayList<>();
        if (ticket.getItems() != null) {
            for (SupplyTicketItem ti : ticket.getItems()) {
                itemResponses.add(SupplyDto.SupplyTicketItemResponse.builder()
                        .id(ti.getId())
                        .itemId(ti.getItem() != null ? ti.getItem().getId() : null)
                        .itemCode(ti.getItemCode() != null ? ti.getItemCode() : (ti.getItem() != null ? ti.getItem().getItemCode() : null))
                        .itemName(ti.getItemName() != null ? ti.getItemName() : (ti.getItem() != null ? ti.getItem().getItemName() : null))
                        .unit(ti.getUnit() != null ? ti.getUnit() : (ti.getItem() != null ? ti.getItem().getUnit() : null))
                        .quantity(ti.getQuantity())
                        .unitPrice(ti.getUnitPrice())
                        .notes(ti.getNotes())
                        .build());
            }
        }

        return SupplyDto.SupplyTicketResponse.builder()
                .id(ticket.getId())
                .ticketCode(ticket.getTicketCode())
                .ticketType(ticket.getTicketType())
                .warehouseId(wh != null ? wh.getId() : null)
                .warehouseCode(wh != null ? wh.getCode() : null)
                .warehouseName(wh != null ? wh.getName() : null)
                .targetPostOfficeId(ticket.getTargetPostOfficeId())
                .targetPostOfficeName(ticket.getTargetPostOfficeName())
                .partnerOrSupplier(ticket.getPartnerOrSupplier())
                .reason(ticket.getReason())
                .status(ticket.getStatus())
                .creatorId(ticket.getCreatorId())
                .creatorName(ticket.getCreatorName())
                .receivedByUserId(ticket.getReceivedByUserId())
                .receivedByName(ticket.getReceivedByName())
                .receivedAt(ticket.getReceivedAt())
                .receivedNotes(ticket.getReceivedNotes())
                .totalQuantity(ticket.getTotalQuantity())
                .notes(ticket.getNotes())
                .items(itemResponses)
                .createdAt(ticket.getCreatedAt())
                .updatedAt(ticket.getUpdatedAt())
                .build();
    }

    // ================= PHIẾU THU HỒI ĐỒ HỎNG =================

    @Override
    @Transactional(readOnly = true)
    public List<EquipmentRecallTicket> getRecallTickets(String status, Long postOfficeId) {
        if (postOfficeId != null) {
            return recallRepository.findByPostOfficeIdOrderByCreatedAtDesc(postOfficeId);
        }
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            return recallRepository.findByStatusOrderByCreatedAtDesc(status.trim().toUpperCase());
        }
        return recallRepository.findAllByOrderByCreatedAtDesc();
    }

    @Override
    @Transactional(readOnly = true)
    public EquipmentRecallTicket getRecallTicketById(Long id) {
        return recallRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy phiếu thu hồi ID: " + id));
    }

    @Override
    @Transactional
    public EquipmentRecallTicket createRecallTicket(SupplyDto.CreateRecallRequest req, Long userId) {
        User requester = userId != null ? userRepository.findById(userId).orElse(null) : null;

        String poName = req.getPostOfficeName();
        if (poName == null || poName.isBlank()) {
            Warehouse po = postOfficeRepository.findById(req.getPostOfficeId()).orElse(null);
            if (po != null) poName = po.getName();
            else if (requester != null && requester.getPostOfficeName() != null) poName = requester.getPostOfficeName();
            else poName = "Bưu cục ID " + req.getPostOfficeId();
        }

        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyMMdd"));
        int randSeq = (int) (1000 + Math.random() * 9000);
        String ticketCode = "TH_" + datePart + "_" + randSeq;

        EquipmentRecallTicket ticket = EquipmentRecallTicket.builder()
                .ticketCode(ticketCode)
                .postOfficeId(req.getPostOfficeId())
                .postOfficeName(poName)
                .equipmentName(req.getEquipmentName().trim())
                .supplyItemId(req.getSupplyItemId())
                .quantity(req.getQuantity() != null && req.getQuantity() > 0 ? req.getQuantity() : 1)
                .serialNumber(req.getSerialNumber())
                .damageDescription(req.getDamageDescription().trim())
                .status("CHO_THU_HOI") // Trạng thái mặc định ban đầu
                .requesterId(userId)
                .requesterName(requester != null ? requester.getFullName() : "Quản lý bưu cục")
                .requesterPhone(req.getRequesterPhone() != null ? req.getRequesterPhone() : (requester != null ? requester.getPhoneNumber() : null))
                .build();

        EquipmentRecallTicket saved = recallRepository.save(ticket);
        log.info("Bưu cục {} đã tạo phiếu thu hồi đồ hỏng mã: {} - {} (Trạng thái: CHO_THU_HOI)", 
                poName, saved.getTicketCode(), saved.getEquipmentName());
        return saved;
    }

    @Override
    @Transactional
    public EquipmentRecallTicket resolveRecallTicket(Long id, SupplyDto.ResolveRecallRequest req, Long userId) {
        EquipmentRecallTicket ticket = getRecallTicketById(id);
        if ("DA_THU_HOI".equalsIgnoreCase(ticket.getStatus())) {
            throw new IllegalStateException("Phiếu thu hồi [" + ticket.getTicketCode() + "] đã ở trạng thái ĐÃ THU HỒI trước đó!");
        }

        User resolver = userId != null ? userRepository.findById(userId).orElse(null) : null;

        ticket.setStatus("DA_THU_HOI");
        ticket.setResolvedById(userId);
        ticket.setResolvedByName(resolver != null ? resolver.getFullName() : "Quản lý kho vật tư");
        ticket.setResolvedAt(LocalDateTime.now());
        ticket.setResolutionNotes(req.getResolutionNotes().trim());

        EquipmentRecallTicket saved = recallRepository.save(ticket);
        log.info("Quản lý kho đã thu hồi thành công tài sản hỏng phiếu: {} (Trạng thái: DA_THU_HOI)", saved.getTicketCode());
        return saved;
    }

    // ================= DASHBOARD KPI =================

    @Override
    @Transactional(readOnly = true)
    public SupplyDto.DashboardStats getDashboardStats() {
        long totalWarehouses = warehouseRepository.count();
        long totalItems = itemRepository.count();

        List<SupplyInventory> allInv = inventoryRepository.findAll();
        long totalInStock = allInv.stream().mapToLong(SupplyInventory::getQuantity).sum();
        long totalDamaged = allInv.stream().mapToLong(SupplyInventory::getDamagedQuantity).sum();

        long pendingRecalls = recallRepository.countByStatus("CHO_THU_HOI");
        long resolvedRecalls = recallRepository.countByStatus("DA_THU_HOI");

        long importTickets = ticketRepository.findAll().stream()
                .filter(t -> "IMPORT".equalsIgnoreCase(t.getTicketType())).count();
        long exportTickets = ticketRepository.findAll().stream()
                .filter(t -> "EXPORT".equalsIgnoreCase(t.getTicketType())).count();

        List<SupplyDto.InventoryDetailDto> lowStockAlerts = allInv.stream()
                .filter(inv -> {
                    SupplyItem item = inv.getItem();
                    int min = item != null && item.getMinStockAlert() != null ? item.getMinStockAlert() : 5;
                    return inv.getQuantity() <= min;
                })
                .map(inv -> {
                    SupplyItem item = inv.getItem();
                    SupplyWarehouse wh = inv.getWarehouse();
                    return SupplyDto.InventoryDetailDto.builder()
                            .id(inv.getId())
                            .warehouseId(wh != null ? wh.getId() : null)
                            .warehouseName(wh != null ? wh.getName() : null)
                            .itemId(item != null ? item.getId() : null)
                            .itemCode(item != null ? item.getItemCode() : null)
                            .itemName(item != null ? item.getItemName() : null)
                            .category(item != null ? item.getCategory() : null)
                            .unit(item != null ? item.getUnit() : null)
                            .quantity(inv.getQuantity())
                            .damagedQuantity(inv.getDamagedQuantity())
                            .minStockAlert(item != null ? item.getMinStockAlert() : 5)
                            .isLowStock(true)
                            .updatedAt(inv.getUpdatedAt())
                            .build();
                })
                .toList();

        return SupplyDto.DashboardStats.builder()
                .totalWarehouses(totalWarehouses)
                .totalItems(totalItems)
                .totalInStock(totalInStock)
                .totalDamaged(totalDamaged)
                .pendingRecallTickets(pendingRecalls)
                .resolvedRecallTickets(resolvedRecalls)
                .totalImportTickets(importTickets)
                .totalExportTickets(exportTickets)
                .lowStockAlerts(lowStockAlerts)
                .build();
    }
}
