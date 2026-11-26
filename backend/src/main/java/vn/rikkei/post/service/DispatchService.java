package vn.rikkei.post.service;

import vn.rikkei.post.dto.dispatch.*;
import vn.rikkei.post.dto.wms.MasterBagResponse;

import java.time.LocalDateTime;
import java.util.List;

public interface DispatchService {

    List<DispatchOrderResponse> getDispatchOrders(
            Long originWarehouseId,
            Long destWarehouseId,
            String status,
            LocalDateTime startDate,
            LocalDateTime endDate,
            Long currentUserId,
            List<String> currentUserRoles
    );

    DispatchOrderResponse getDispatchById(Long id, Long currentUserId, List<String> currentUserRoles);

    DispatchOrderResponse getDispatchByCode(String code, Long currentUserId, List<String> currentUserRoles);

    DispatchOrderResponse createDispatchOrder(CreateDispatchOrderRequest request, Long userId, List<String> userRoles);

    DispatchOrderResponse updateDispatchOrder(Long id, UpdateDispatchOrderRequest request, Long userId);

    DispatchOrderResponse updateDispatchStatus(Long id, UpdateDispatchStatusRequest request, Long userId, List<String> userRoles);

    DispatchOrderResponse scanBagInbound(Long dispatchId, String bagCode, Long warehouseId, Long userId);

    DispatchOrderResponse driverLoadBag(Long dispatchId, String bagCode, Long driverId, List<String> userRoles);

    List<MasterBagResponse> getAvailableBagsForDispatch(Long originWarehouseId, Long destWarehouseId);
}
