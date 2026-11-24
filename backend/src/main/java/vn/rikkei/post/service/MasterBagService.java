package vn.rikkei.post.service;

import vn.rikkei.post.dto.wms.AddBagItemRequest;
import vn.rikkei.post.dto.wms.CreateMasterBagRequest;
import vn.rikkei.post.dto.wms.MasterBagResponse;
import vn.rikkei.post.dto.wms.SealMasterBagRequest;

import java.util.List;

public interface MasterBagService {
    List<MasterBagResponse> getAllBags();
    List<MasterBagResponse> getBagsByWarehouse(Long warehouseId);
    MasterBagResponse getBagById(Long id);
    MasterBagResponse getBagByCode(String bagCode);
    MasterBagResponse createBag(CreateMasterBagRequest request, Long userId);
    MasterBagResponse addItemToBag(Long bagId, AddBagItemRequest request);
    MasterBagResponse removeItemFromBag(Long bagId, String trackingCode);
    MasterBagResponse sealBag(Long bagId, SealMasterBagRequest request, Long userId);
    MasterBagResponse unsealBag(Long bagId, Long userId);
    MasterBagResponse assignDriver(Long bagId, vn.rikkei.post.dto.wms.AssignBagDriverRequest request, Long userId);
    MasterBagResponse driverScanTransit(String bagCode, Long driverId);
    MasterBagResponse hubScanInbound(String bagCode, Long hubWarehouseId, Long operatorId);
    List<MasterBagResponse> getDriverBags(Long driverId);
    List<MasterBagResponse> getIncomingBagsForHub(Long hubWarehouseId);
}
