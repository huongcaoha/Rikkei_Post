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
            LocalDateTime endDate
    );

    DispatchOrderResponse getDispatchById(Long id);

    DispatchOrderResponse getDispatchByCode(String code);

    DispatchOrderResponse createDispatchOrder(CreateDispatchOrderRequest request, Long userId);

    DispatchOrderResponse updateDispatchOrder(Long id, UpdateDispatchOrderRequest request, Long userId);

    DispatchOrderResponse updateDispatchStatus(Long id, UpdateDispatchStatusRequest request, Long userId);

    DispatchOrderResponse scanBagInbound(Long dispatchId, String bagCode, Long warehouseId, Long userId);

    List<MasterBagResponse> getAvailableBagsForDispatch(Long originWarehouseId, Long destWarehouseId);
}
