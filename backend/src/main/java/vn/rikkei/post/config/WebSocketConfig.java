package vn.rikkei.post.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Cấu hình WebSocket STOMP cập nhật trạng thái thời gian thực
 * Phục vụ real-time tracking đơn hàng và thông báo người dùng
 * Tác giả: Nguyễn Công Hưởng
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Topic broadcast công khai (ví dụ: /topic/orders/{trackingCode})
        // Queue gửi thông báo riêng tư cho từng user (/user/queue/notifications)
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Hỗ trợ cả Native WebSocket và SockJS Fallback
        registry.addEndpoint("/ws-logistics")
                .setAllowedOriginPatterns("*");
        registry.addEndpoint("/ws-logistics")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
