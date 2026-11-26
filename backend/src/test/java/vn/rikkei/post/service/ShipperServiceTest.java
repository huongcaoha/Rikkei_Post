package vn.rikkei.post.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.Role;
import vn.rikkei.post.entity.User;
import vn.rikkei.post.repository.*;
import vn.rikkei.post.service.impl.ShipperServiceImpl;
import vn.payos.PayOS;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShipperServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderTrackingLogRepository trackingLogRepository;

    @Mock
    private ShipperAssignmentRepository assignmentRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private WarehouseRepository warehouseRepository;

    @Mock
    private WebSocketNotificationService webSocketNotificationService;

    @Mock
    private EmailService emailService;

    @Mock
    private ShipperCashSubmissionRepository cashSubmissionRepository;

    @Mock
    private PayOS payOS;

    @Mock
    private RedisService redisService;

    private ShipperService shipperService;

    @BeforeEach
    void setUp() {
        shipperService = new ShipperServiceImpl(
                orderRepository,
                trackingLogRepository,
                assignmentRepository,
                userRepository,
                warehouseRepository,
                webSocketNotificationService,
                emailService,
                cashSubmissionRepository,
                payOS,
                redisService
        );
    }

    @Test
    @DisplayName("Quét lấy hàng thành công không bị StackOverflowError và có evict cache")
    void testScanPickupOrder_Success_NoStackOverflow() {
        String trackingCode = "RKP123456789";
        Long shipperId = 5L;

        Role shipperRole = Role.builder().roleName("ROLE_SHIPPER").build();
        User shipper = User.builder()
                .id(shipperId)
                .username("shipper1")
                .fullName("Trần Bưu Tá")
                .phoneNumber("0988777666")
                .roles(Set.of(shipperRole))
                .build();

        Order order = Order.builder()
                .id(100L)
                .trackingCode(trackingCode)
                .currentStatus("CREATED")
                .codAmount(BigDecimal.valueOf(250000))
                .senderName("Shop Thời Trang")
                .senderPhone("0912345678")
                .senderAddress("123 Cầu Giấy")
                .build();

        when(orderRepository.findByTrackingCode(trackingCode)).thenReturn(Optional.of(order));
        when(userRepository.findById(shipperId)).thenReturn(Optional.of(shipper));
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(assignmentRepository.findByTrackingCode(trackingCode)).thenReturn(Optional.empty());

        OrderResponse response = shipperService.scanPickupOrder(shipperId, trackingCode);

        assertNotNull(response);
        assertEquals(trackingCode, response.getTrackingCode());
        assertEquals("PICKED_UP", response.getCurrentStatus());
        assertEquals("Trần Bưu Tá", response.getAssignedShipperName());

        // Kiểm tra orderRepository.save được gọi đúng 1 lần
        verify(orderRepository, times(1)).save(any(Order.class));

        // Kiểm tra redisService.evictOrderCache được gọi
        verify(redisService, times(1)).evictOrderCache(trackingCode);
    }
}
