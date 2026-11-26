package vn.rikkei.post.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import vn.rikkei.post.dto.dispatch.CreateDispatchOrderRequest;
import vn.rikkei.post.dto.dispatch.DispatchOrderResponse;
import vn.rikkei.post.dto.dispatch.UpdateDispatchStatusRequest;
import vn.rikkei.post.entity.*;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.impl.DispatchServiceImpl;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DispatchServiceTest {

    @Mock
    private DispatchOrderRepository dispatchOrderRepository;
    @Mock
    private DispatchOrderItemRepository dispatchOrderItemRepository;
    @Mock
    private MasterBagRepository masterBagRepository;
    @Mock
    private BagItemRepository bagItemRepository;
    @Mock
    private WarehouseRepository warehouseRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TruckRepository truckRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderTrackingLogRepository trackingLogRepository;
    @Mock
    private WebSocketNotificationService webSocketNotificationService;
    @Mock
    private RedisService redisService;

    @InjectMocks
    private DispatchServiceImpl dispatchService;

    private Warehouse originWh;
    private Warehouse destWh;
    private User driver;
    private User manager;
    private Truck truck;

    @BeforeEach
    void setUp() {
        originWh = Warehouse.builder().id(1L).name("Bưu cục Hoài Đức").code("WH_HDU").type("HUB").build();
        destWh = Warehouse.builder().id(2L).name("Kho Hub Hà Nội").code("WH_HUB_HN").type("HUB").build();

        driver = User.builder()
                .id(10L)
                .username("driver1")
                .fullName("Nguyễn Văn Tài Xế")
                .phoneNumber("0988776655")
                .roles(Set.of(Role.builder().roleName("ROLE_TRUCK_DRIVER").build()))
                .build();

        manager = User.builder()
                .id(20L)
                .username("manager1")
                .fullName("Trần Quản Lý Kho")
                .phoneNumber("0912345678")
                .roles(Set.of(Role.builder().roleName("ROLE_POST_OFFICE_MANAGER").build()))
                .build();

        truck = Truck.builder()
                .id(100L)
                .licensePlate("29C-88888")
                .truckType("5_TONS")
                .currentDriverId(10L)
                .status("AT_WAREHOUSE")
                .build();
    }

    @Test
    @DisplayName("Quản lý kho tạo lệnh điều vận thành công không cần nạp trước bao tải")
    void testCreateDispatchOrder_ByManager_WithoutBags_Success() {
        CreateDispatchOrderRequest request = CreateDispatchOrderRequest.builder()
                .originWarehouseId(1L)
                .destWarehouseId(2L)
                .driverId(10L)
                .truckId(100L)
                .notes("Chuyến xe sáng")
                .departureTime(LocalDateTime.now())
                .bagCodes(null)
                .build();

        when(warehouseRepository.findById(1L)).thenReturn(Optional.of(originWh));
        when(warehouseRepository.findById(2L)).thenReturn(Optional.of(destWh));
        when(userRepository.findById(10L)).thenReturn(Optional.of(driver));
        when(userRepository.findById(20L)).thenReturn(Optional.of(manager));
        when(truckRepository.findById(100L)).thenReturn(Optional.of(truck));
        when(dispatchOrderRepository.existsByDispatchCode(anyString())).thenReturn(false);
        when(dispatchOrderRepository.save(any(DispatchOrder.class))).thenAnswer(inv -> {
            DispatchOrder d = inv.getArgument(0);
            d.setId(1L);
            d.setItems(new ArrayList<>());
            return d;
        });

        DispatchOrderResponse res = dispatchService.createDispatchOrder(
                request, 20L, List.of("ROLE_POST_OFFICE_MANAGER")
        );

        assertNotNull(res);
        assertEquals(0, res.getTotalBags());
        assertEquals("PICKED_UP", res.getStatus());
        assertEquals(10L, res.getDriverId());
        verify(dispatchOrderRepository, atLeastOnce()).save(any(DispatchOrder.class));
    }

    @Test
    @DisplayName("Tài xế thuần túy cố tạo lệnh điều vận -> bị AccessDeniedException")
    void testCreateDispatchOrder_ByTruckDriver_ThrowsAccessDenied() {
        CreateDispatchOrderRequest request = CreateDispatchOrderRequest.builder()
                .originWarehouseId(1L)
                .destWarehouseId(2L)
                .driverId(10L)
                .build();

        assertThrows(AccessDeniedException.class, () -> {
            dispatchService.createDispatchOrder(request, 10L, List.of("ROLE_TRUCK_DRIVER"));
        });
    }

    @Test
    @DisplayName("Tài xế thực hiện quét nạp bao tải lên xe mang đi: bao tải chuyển IN_TRANSIT")
    void testDriverLoadBag_Success() {
        DispatchOrder dispatch = DispatchOrder.builder()
                .id(1L)
                .dispatchCode("DO261126-1001")
                .originWarehouse(originWh)
                .destWarehouse(destWh)
                .driver(driver)
                .driverName("Nguyễn Văn Tài Xế")
                .driverPhone("0988776655")
                .truck(truck)
                .truckPlate("29C-88888")
                .status("PICKED_UP")
                .totalBags(0)
                .totalItems(0)
                .totalWeightKg(BigDecimal.ZERO)
                .items(new ArrayList<>())
                .build();

        MasterBag bag = MasterBag.builder()
                .id(50L)
                .bagCode("BAG261126-001")
                .sealNumber("SEAL-999")
                .originWarehouse(originWh)
                .destWarehouse(destWh)
                .status("SEALED")
                .totalItems(3)
                .totalWeightKg(BigDecimal.valueOf(2.5))
                .build();

        when(dispatchOrderRepository.findById(1L)).thenReturn(Optional.of(dispatch));
        when(masterBagRepository.findByBagCode("BAG261126-001")).thenReturn(Optional.of(bag));
        when(dispatchOrderRepository.save(any(DispatchOrder.class))).thenAnswer(inv -> inv.getArgument(0));
        when(bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(50L)).thenReturn(Collections.emptyList());

        DispatchOrderResponse res = dispatchService.driverLoadBag(
                1L, "BAG261126-001", 10L, List.of("ROLE_TRUCK_DRIVER")
        );

        assertNotNull(res);
        assertEquals(1, res.getTotalBags());
        assertEquals("IN_TRANSIT", res.getStatus());
        assertEquals("IN_TRANSIT", bag.getStatus());
        assertEquals(10L, bag.getAssignedDriverId());
        assertEquals("29C-88888", bag.getAssignedTruckPlate());
    }

    @Test
    @DisplayName("Chuyển trạng thái COMPLETED khi còn bao tải chưa nhập kho đích -> Bị chặn với lỗi rõ ràng")
    void testUpdateDispatchStatus_Completed_WhenBagsNotReceived_ThrowsException() {
        DispatchOrderItem unreceivedItem = DispatchOrderItem.builder()
                .id(1L)
                .bagCode("BAG261126-001")
                .isReceivedAtDest(false)
                .build();

        DispatchOrder dispatch = DispatchOrder.builder()
                .id(1L)
                .dispatchCode("DO261126-1002")
                .originWarehouse(originWh)
                .destWarehouse(destWh)
                .driver(driver)
                .status("IN_TRANSIT")
                .items(List.of(unreceivedItem))
                .build();

        when(dispatchOrderRepository.findById(1L)).thenReturn(Optional.of(dispatch));

        UpdateDispatchStatusRequest req = new UpdateDispatchStatusRequest();
        req.setStatus("COMPLETED");

        IllegalStateException ex = assertThrows(IllegalStateException.class, () -> {
            dispatchService.updateDispatchStatus(1L, req, 10L, List.of("ROLE_TRUCK_DRIVER"));
        });

        assertTrue(ex.getMessage().contains("chưa được kho đích"));
    }

    @Test
    @DisplayName("Chuyển trạng thái COMPLETED khi 100% bao tải đã nhập kho đích -> Thành công")
    void testUpdateDispatchStatus_Completed_WhenAllBagsReceived_Success() {
        DispatchOrderItem receivedItem = DispatchOrderItem.builder()
                .id(1L)
                .bagCode("BAG261126-001")
                .isReceivedAtDest(true)
                .build();

        DispatchOrder dispatch = DispatchOrder.builder()
                .id(1L)
                .dispatchCode("DO261126-1003")
                .originWarehouse(originWh)
                .destWarehouse(destWh)
                .driver(driver)
                .truck(truck)
                .status("IN_TRANSIT")
                .items(List.of(receivedItem))
                .build();

        when(dispatchOrderRepository.findById(1L)).thenReturn(Optional.of(dispatch));
        when(dispatchOrderRepository.save(any(DispatchOrder.class))).thenAnswer(inv -> inv.getArgument(0));

        UpdateDispatchStatusRequest req = new UpdateDispatchStatusRequest();
        req.setStatus("COMPLETED");

        DispatchOrderResponse res = dispatchService.updateDispatchStatus(
                1L, req, 10L, List.of("ROLE_TRUCK_DRIVER")
        );

        assertNotNull(res);
        assertEquals("COMPLETED", res.getStatus());
        assertEquals("AT_WAREHOUSE", truck.getStatus());
    }
}
