package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import vn.rikkei.post.dto.ecommerce.*;
import vn.rikkei.post.dto.order.CreateOrderRequest;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.entity.EcommerceChannel;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.OrderTrackingLog;
import vn.rikkei.post.repository.EcommerceChannelRepository;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.OrderTrackingLogRepository;
import vn.rikkei.post.service.EcommerceIntegrationService;
import vn.rikkei.post.service.OrderService;
import vn.rikkei.post.service.PricingService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EcommerceIntegrationServiceImpl implements EcommerceIntegrationService {

    private final EcommerceChannelRepository channelRepository;
    private final OrderService orderService;
    private final OrderRepository orderRepository;
    private final OrderTrackingLogRepository trackingLogRepository;
    private final PricingService pricingService;

    @Override
    public List<EcommerceChannel> getChannels(Long userId) {
        return channelRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Override
    @Transactional
    public EcommerceChannel createChannel(CreateChannelRequest request, Long userId) {
        String apiKey = "rkp_" + request.getPlatform().toLowerCase() + "_" + UUID.randomUUID().toString().replace("-", "");
        String apiSecret = "sec_" + UUID.randomUUID().toString().replace("-", "");

        EcommerceChannel channel = EcommerceChannel.builder()
                .userId(userId)
                .platform(request.getPlatform().toUpperCase())
                .channelName(request.getChannelName())
                .shopId(request.getShopId())
                .apiKey(apiKey)
                .apiSecret(apiSecret)
                .webhookUrl(request.getWebhookUrl())
                .status("ACTIVE")
                .totalOrdersSynced(0)
                .build();

        return channelRepository.save(channel);
    }

    @Override
    @Transactional
    public EcommerceChannel regenerateApiKey(Long channelId, Long userId) {
        EcommerceChannel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết nối sàn!"));

        if (!channel.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền thao tác trên kết nối này!");
        }

        channel.setApiKey("rkp_" + channel.getPlatform().toLowerCase() + "_" + UUID.randomUUID().toString().replace("-", ""));
        channel.setApiSecret("sec_" + UUID.randomUUID().toString().replace("-", ""));
        return channelRepository.save(channel);
    }

    @Override
    @Transactional
    public EcommerceChannel toggleChannelStatus(Long channelId, Long userId) {
        EcommerceChannel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết nối sàn!"));

        if (!channel.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền thao tác trên kết nối này!");
        }

        channel.setStatus("ACTIVE".equalsIgnoreCase(channel.getStatus()) ? "PAUSED" : "ACTIVE");
        return channelRepository.save(channel);
    }

    @Override
    @Transactional
    public void deleteChannel(Long channelId, Long userId) {
        EcommerceChannel channel = channelRepository.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết nối sàn!"));

        if (!channel.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền thao tác trên kết nối này!");
        }

        channelRepository.delete(channel);
    }

    @Override
    @Transactional
    public EcommerceOrderSyncResponse syncOrderFromPlatform(String apiKey, EcommerceOrderSyncRequest request) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu X-API-KEY xác thực sàn TMĐT!");
        }

        EcommerceChannel channel = channelRepository.findByApiKey(apiKey.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "API Key sàn TMĐT không hợp lệ!"));

        if (!"ACTIVE".equalsIgnoreCase(channel.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Kênh kết nối sàn " + channel.getPlatform() + " hiện đang tạm ngưng!");
        }

        // Chuyển đổi payload sang CreateOrderRequest của hệ thống Rikkei Post
        CreateOrderRequest orderReq = CreateOrderRequest.builder()
                .senderName(request.getSenderName())
                .senderPhone(request.getSenderPhone())
                .senderAddress(request.getSenderAddress())
                .senderProvinceId(request.getSenderProvinceId())
                .senderDistrictId(request.getSenderDistrictId())
                .senderWardName(request.getSenderWardName() != null ? request.getSenderWardName() : "Trung tâm")
                .receiverName(request.getReceiverName())
                .receiverPhone(request.getReceiverPhone())
                .receiverAddress(request.getReceiverAddress())
                .receiverProvinceId(request.getReceiverProvinceId())
                .receiverDistrictId(request.getReceiverDistrictId())
                .receiverWardName(request.getReceiverWardName())
                .itemName(request.getItemName())
                .itemValue(request.getItemValue() != null ? request.getItemValue() : BigDecimal.ZERO)
                .actualWeightGram(request.getActualWeightGram())
                .lengthCm(request.getLengthCm() != null ? request.getLengthCm() : 15)
                .widthCm(request.getWidthCm() != null ? request.getWidthCm() : 15)
                .heightCm(request.getHeightCm() != null ? request.getHeightCm() : 10)
                .codAmount(request.getCodAmount() != null ? request.getCodAmount() : BigDecimal.ZERO)
                .paymentParty(request.getPaymentParty() != null ? request.getPaymentParty() : "RECEIVER")
                .serviceType(request.getServiceType() != null ? request.getServiceType() : "STANDARD")
                .pickupType("DOOR_PICKUP")
                .notes("[Đơn sàn " + channel.getPlatform() + " #" + request.getEcommerceOrderId() + "] " + (request.getNotes() != null ? request.getNotes() : ""))
                .build();

        OrderResponse orderRes = orderService.createOrder(orderReq, channel.getUserId());

        // Cập nhật thống kê kênh
        channel.setTotalOrdersSynced(channel.getTotalOrdersSynced() + 1);
        channel.setLastSyncedAt(LocalDateTime.now());
        channelRepository.save(channel);

        return EcommerceOrderSyncResponse.builder()
                .success(true)
                .trackingCode(orderRes.getTrackingCode())
                .ecommerceOrderId(request.getEcommerceOrderId())
                .orderStatus(orderRes.getCurrentStatus())
                .shippingFee(orderRes.getShippingFee())
                .codAmount(orderRes.getCodAmount())
                .sortingHub(orderRes.getRoutingCode() != null ? orderRes.getRoutingCode() : "Hub Rikkei Post")
                .labelUrl("https://huongcaoha.site/orders/print/" + orderRes.getTrackingCode())
                .createdAt(LocalDateTime.now())
                .message("Tiếp nhận đơn hàng từ sàn " + channel.getPlatform() + " thành công!")
                .build();
    }

    @Override
    public EcommerceShippingRateResponse calculateShippingRate(EcommerceShippingRateRequest request) {
        CalculatePriceRequest priceReq = CalculatePriceRequest.builder()
                .senderProvinceId(request.getFromProvinceId())
                .receiverProvinceId(request.getToProvinceId())
                .actualWeightGram(request.getWeightGram())
                .serviceType(request.getServiceType() != null ? request.getServiceType() : "STANDARD")
                .build();

        PriceEstimateResponse estimate = pricingService.calculatePrice(priceReq);

        return EcommerceShippingRateResponse.builder()
                .shippingFee(estimate.getTotalFee())
                .codFee(BigDecimal.ZERO)
                .insuranceFee(BigDecimal.ZERO)
                .totalAmount(estimate.getTotalFee())
                .estimatedDays(estimate.getEstimatedDeliveryHours() != null ? Math.max(1, estimate.getEstimatedDeliveryHours() / 24) : 2)
                .serviceType(request.getServiceType())
                .carrierName("Rikkei Post Express Logistics")
                .build();
    }

    @Override
    public OrderResponse getTrackingForPlatform(String apiKey, String trackingCode) {
        validateApiKey(apiKey);
        return orderService.getOrderByTrackingCode(trackingCode);
    }

    @Override
    @Transactional
    public boolean cancelOrderForPlatform(String apiKey, String trackingCode, String reason) {
        validateApiKey(apiKey);

        Order order = orderRepository.findByTrackingCode(trackingCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy mã vận đơn: " + trackingCode));

        if (!"CREATED".equals(order.getCurrentStatus()) && !"PENDING_PICKUP".equals(order.getCurrentStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể hủy đơn hàng do đơn đã được lấy hoặc đang trung chuyển!");
        }

        order.setCurrentStatus("CANCELLED");
        orderRepository.save(order);

        OrderTrackingLog log = OrderTrackingLog.builder()
                .trackingCode(order.getTrackingCode())
                .status("CANCELLED")
                .locationName("Cổng tích hợp sàn TMĐT")
                .description("Sàn TMĐT yêu cầu hủy vận đơn. Lý do: " + (reason != null ? reason : "Khách hủy đơn"))
                .actorName("ECOMMERCE_PARTNER_API")
                .createdAt(LocalDateTime.now())
                .build();
        trackingLogRepository.save(log);

        return true;
    }

    private EcommerceChannel validateApiKey(String apiKey) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Thiếu X-API-KEY xác thực!");
        }
        EcommerceChannel channel = channelRepository.findByApiKey(apiKey.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "API Key không hợp lệ!"));

        if (!"ACTIVE".equalsIgnoreCase(channel.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Kênh kết nối sàn " + channel.getPlatform() + " đang tạm ngưng!");
        }
        return channel;
    }
}
