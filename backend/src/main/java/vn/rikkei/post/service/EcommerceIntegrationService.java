package vn.rikkei.post.service;

import vn.rikkei.post.dto.ecommerce.*;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.entity.EcommerceChannel;

import java.util.List;

public interface EcommerceIntegrationService {

    List<EcommerceChannel> getChannels(Long userId);

    EcommerceChannel createChannel(CreateChannelRequest request, Long userId);

    EcommerceChannel regenerateApiKey(Long channelId, Long userId);

    EcommerceChannel toggleChannelStatus(Long channelId, Long userId);

    void deleteChannel(Long channelId, Long userId);

    EcommerceOrderSyncResponse syncOrderFromPlatform(String apiKey, EcommerceOrderSyncRequest request);

    EcommerceShippingRateResponse calculateShippingRate(EcommerceShippingRateRequest request);

    OrderResponse getTrackingForPlatform(String apiKey, String trackingCode);

    boolean cancelOrderForPlatform(String apiKey, String trackingCode, String reason);
}
