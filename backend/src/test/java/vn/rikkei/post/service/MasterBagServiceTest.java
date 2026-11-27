package vn.rikkei.post.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import vn.rikkei.post.dto.wms.CreateMasterBagRequest;
import vn.rikkei.post.dto.wms.MasterBagResponse;
import vn.rikkei.post.dto.wms.SealMasterBagRequest;
import vn.rikkei.post.entity.MasterBag;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.entity.Truck;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.kafka.MasterBagKafkaProducer;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.impl.MasterBagServiceImpl;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MasterBagServiceTest {

    @Mock
    private MasterBagRepository masterBagRepository;
    @Mock
    private BagItemRepository bagItemRepository;
    @Mock
    private WarehouseRepository warehouseRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private OrderTrackingLogRepository trackingLogRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ShipmentManifestRepository manifestRepository;
    @Mock
    private WebSocketNotificationService webSocketNotificationService;
    @Mock
    private TruckRepository truckRepository;
    @Mock
    private MasterBagKafkaProducer kafkaProducer;
    @Mock
    private RedisService redisService;
    @Mock
    private DispatchOrderItemRepository dispatchOrderItemRepository;

    @InjectMocks
    private MasterBagServiceImpl masterBagService;

    private Warehouse originWh;
    private Warehouse destWh;
    private User driver;
    private Truck truck;

    @BeforeEach
    void setUp() {
        originWh = Warehouse.builder().id(1L).name("Bưu cục Hoài Đức").code("WH_HDU").build();
        destWh = Warehouse.builder().id(2L).name("Kho Hub Hà Nội").code("WH_HUB_HN").build();

        driver = User.builder()
                .id(10L)
                .username("driver1")
                .fullName("Nguyễn Văn Tài Xế")
                .phoneNumber("0988776655")
                .roles(Set.of(Role.builder().roleName("ROLE_TRUCK_DRIVER").build()))
                .build();

        truck = Truck.builder()
                .id(100L)
                .licensePlate("29C-12345")
                .truckType("5_TONS")
                .currentDriverId(10L)
                .status("AT_WAREHOUSE")
                .build();
    }

    @Test
    @DisplayName("Tạo bao tải: mặc định driver và truck phải là null")
    void testCreateBag_DefaultDriverAndTruckNull() {
        CreateMasterBagRequest request = new CreateMasterBagRequest();
        request.setOriginWarehouseId(1L);
        request.setDestWarehouseId(2L);
        request.setSealNumber("SEAL-TEST-01");
        request.setNotes("Bao thử nghiệm");

        when(warehouseRepository.findById(1L)).thenReturn(Optional.of(originWh));
        when(warehouseRepository.findById(2L)).thenReturn(Optional.of(destWh));
        when(masterBagRepository.existsByBagCode(anyString())).thenReturn(false);
        when(masterBagRepository.save(any(MasterBag.class))).thenAnswer(invocation -> {
            MasterBag b = invocation.getArgument(0);
            b.setId(1L);
            return b;
        });

        MasterBagResponse response = masterBagService.createBag(request, 1L);

        assertNotNull(response);
        assertEquals("OPEN", response.getStatus());
        assertNull(response.getAssignedDriverId());
        assertNull(response.getAssignedDriverName());
        assertNull(response.getAssignedTruckPlate());
    }

    @Test
    @DisplayName("Tài xế quét mã bao kẹp chì (SEALED): tự động gán tên tài xế và xe tải, chuyển IN_TRANSIT")
    void testDriverScanTransit_AssignsDriverAndTruckAutomatically() {
        MasterBag sealedBag = MasterBag.builder()
                .id(1L)
                .bagCode("BAG20261126001")
                .sealNumber("SEAL-001")
                .originWarehouse(originWh)
                .destWarehouse(destWh)
                .status("SEALED")
                .totalItems(2)
                .totalWeightKg(BigDecimal.valueOf(1.5))
                .assignedDriverId(null)
                .assignedDriverName(null)
                .build();

        when(masterBagRepository.findByBagCode("BAG20261126001")).thenReturn(Optional.of(sealedBag));
        when(userRepository.findById(10L)).thenReturn(Optional.of(driver));
        when(truckRepository.findByCurrentDriverId(10L)).thenReturn(List.of(truck));
        when(masterBagRepository.save(any(MasterBag.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(bagItemRepository.findByMasterBagIdOrderByScannedAtDesc(1L)).thenReturn(Collections.emptyList());

        MasterBagResponse res = masterBagService.driverScanTransit("BAG20261126001", 10L);

        assertNotNull(res);
        assertEquals("IN_TRANSIT", res.getStatus());
        assertEquals(10L, res.getAssignedDriverId());
        assertEquals("Nguyễn Văn Tài Xế", res.getAssignedDriverName());
        assertEquals("0988776655", res.getAssignedDriverPhone());
        assertEquals("29C-12345", res.getAssignedTruckPlate());
        assertEquals("IN_TRANSIT", truck.getStatus());
        verify(kafkaProducer, times(1)).sendTransitEvent(any());
    }

    @Test
    @DisplayName("Tài xế khác quét bao đã có tài xế nhận: báo AccessDeniedException")
    void testDriverScanTransit_AlreadyAssignedToAnotherDriver() {
        MasterBag bag = MasterBag.builder()
                .id(1L)
                .bagCode("BAG20261126002")
                .originWarehouse(originWh)
                .destWarehouse(destWh)
                .status("SEALED")
                .assignedDriverId(99L)
                .assignedDriverName("Tài xế khác")
                .build();

        when(masterBagRepository.findByBagCode("BAG20261126002")).thenReturn(Optional.of(bag));
        when(userRepository.findById(10L)).thenReturn(Optional.of(driver));

        assertThrows(AccessDeniedException.class, () -> {
            masterBagService.driverScanTransit("BAG20261126002", 10L);
        });
    }

    @Test
    @DisplayName("getDriverBags: gọi repository tìm cả bao đã nhận và bao SEALED chưa gán")
    void testGetDriverBags() {
        when(masterBagRepository.findDriverTasksWithAvailableBags(10L)).thenReturn(Collections.emptyList());

        List<MasterBagResponse> list = masterBagService.getDriverBags(10L);

        assertNotNull(list);
        verify(masterBagRepository, times(1)).findDriverTasksWithAvailableBags(10L);
    }
}
