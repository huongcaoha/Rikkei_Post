# TÀI LIỆU THIẾT KẾ KIẾN TRÚC HỆ THỐNG (ARCHITECTURE DESIGN DOCUMENT)
## NỀN TẢNG CHUYỂN PHÁT NHANH RIKKEI_POST (CODE-FIRST, WEBSOCKET & SPRING AI)

---

| **Thuộc tính** | **Nội dung** |
| :--- | :--- |
| **Dự án** | **Rikkei_Post** - Smart Express Logistics Platform |
| **Tác giả thiết kế** | **Nguyễn Công Hưởng** (Solo Fullstack Lead, Microservices & AI Architect) |
| **Nền tảng Ngôn ngữ** | **Java 21 LTS** |
| **Framework Backend** | **Spring Boot 4.1.x**, **Spring Security**, **JPA / Hibernate (Code-First)**, **Spring AI 2.0 (GA)** |
| **Real-time & Message**| **WebSocket (STOMP over SockJS)**, **Apache Kafka**, **Redis Cache & Redisson Locks** |
| **Email & Notification**| **Spring Boot Starter Mail** (Tích hợp MailHog / SMTP Server) |
| **Công nghệ Frontend**| **ReactJS 18+**, **TypeScript**, **Tailwind CSS**, **Ant Design**, **Google Maps API SDK** |

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG CỦA NGUYỄN CÔNG HƯỞNG

Dự án được kiến trúc theo mô hình **Code-First Microservices** linh hoạt. Các class Entity Java đóng vai trò là "Single Source of Truth", Hibernate tự động sinh cấu trúc bảng bên cơ sở dữ liệu.

```
                                    +-----------------------------------------------+
                                    |         CLIENT APPLICATION (ReactJS)          |
                                    | [Customer Portal] [WMS Desktop] [Shipper Web] |
                                    +-----------------------+-----------------------+
                                                            |
                                                            | HTTPS / WSS
                                                            v
+-------------------------------------------------------------------------------------------------------------------+
|                                    API GATEWAY (Spring Cloud Gateway :8080)                                       |
|  - JWT Authentication Filter        - Redis Rate Limiter          - CORS Configuration     - WebSocket Relay Route|
+-----------------------------------------------------------+-------------------------------------------------------+
                                                            |
             +----------------------+-----------------------+----------------------+-----------------------+
             |                      |                       |                      |                       |
             v                      v                       v                      v                       v
   +------------------+   +------------------+   +--------------------+   +-------------------+   +--------------------+
   |   auth-service   |   |  order-service   |   |    wms-service     |   |    tms-service    |   |  billing-service   |
   | (User-Role N-N,  |   | (Dynamic Pricing,|   | (Inbound/Outbound, |   | (Dispatching,     |   | (COD Reconcile,    |
   |  JWT, Password)  |   |  State Machine)  |   |  Master Bag, Seal) |   |  Linehaul, POD)   |   |  Wallet, Balance)  |
   +--------+---------+   +--------+---------+   +---------+----------+   +---------+---------+   +---------+----------+
            |                      |                       |                        |                       |
            +----------------------+-----------------------+------------------------+-----------------------+
                                                           |
                                                           | Hibernate Code-First (ddl-auto=update)
                                                           v
                                            +-------------------------------+
                                            |       PostgreSQL 15+          |
                                            |  (Auto-generated Tables,      |
                                            |   user_role Join Table)       |
                                            +-------------------------------+
                                                           |
                                                           | Event-Driven Kafka
                                                           v
+-------------------------------------------------------------------------------------------------------------------+
|                                            APACHE KAFKA MESSAGE BROKER                                            |
|   Topics: order-events | tracking-events | manifest-events | cod-events | notify-events                           |
+----------------------------------------------------------+--------------------------------------------------------+
                                                           |
             +---------------------------------------------+----------------------------------------+
             |                                                                                      |
             v                                                                                      v
   +--------------------+                                                                 +--------------------+
   |  tracking-service  |                                                                 |  ai-optim-service  |
   | (Kafka Consumer,   |                                                                 | (Spring AI 2.0 GA, |
   |  WebSocket STOMP)  |                                                                 |  VRP Route Solver) |
   +---------+----------+                                                                 +---------+----------+
             |                                                                                      |
             +---------------------------------------------+----------------------------------------+
                                                           |
                                                           v
                                            +-------------------------------+
                                            |  COMMUNICATION & CACHE LAYER  |
                                            | - WebSocket (/ws-logistics)   |
                                            | - Spring Mail (MailHog:1025)  |
                                            | - Redis Cache (Pricing, Geo)  |
                                            | - MinIO (POD Images:9000)     |
                                            +-------------------------------+
```

---

## 2. THIẾT KẾ WEBSOCKET REAL-TIME TRẠNG THÁI GIAO HÀNG

### 2.1. Cấu hình WebSocket STOMP
```java
package vn.rikkei.post.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Topic broadcast công khai và Queue gửi riêng cho từng user
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Endpoint kết nối WebSocket từ ReactJS Client
        registry.addEndpoint("/ws-logistics")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
}
```

### 2.2. Luồng cập nhật Real-time
1. Khi bưu tá thực hiện giao hàng thành công trên Mobile Web $\rightarrow$ Gửi request `POST /api/v1/tms/deliveries/{trackingCode}/pod`.
2. Backend lưu ảnh POD lên MinIO, cập nhật trạng thái đơn hàng sang `DELIVERED`.
3. Bắn event lên Kafka `tracking-events`.
4. WebSocket Controller kích hoạt:
   ```java
   messagingTemplate.convertAndSend("/topic/orders/" + trackingCode, deliveryEvent);
   ```
5. Tất cả màn hình Web Customer Portal của chủ shop và người nhận đang mở sẽ tự động hiển thị trạng thái "Giao thành công" kèm ảnh POD mà không cần tải lại trang.

---

## 3. THIẾT KẾ ĐỘNG CƠ GỬI EMAIL TỰ ĐỘNG VỚI SPRING MAIL

### 3.1. Cấu hình Mail trong `application.yml`
```yaml
spring:
  mail:
    host: localhost
    port: 1025 # MailHog port
    username: ""
    password: ""
    properties:
      mail:
        smtp:
          auth: false
          starttls:
            enable: false
```

### 3.2. Service gửi Email tự động
```java
package vn.rikkei.post.service;

import java.io.File;

public interface EmailService {
    void sendOrderCreatedEmail(String toEmail, String trackingCode, String receiverName, Double fee);
    void sendDeliverySuccessEmail(String toEmail, String trackingCode, String podImageUrl);
    void sendCodReconciliationEmail(String toEmail, String sheetCode, Double netPayout, File attachment);
    void sendOtpEmail(String toEmail, String otpCode);
}
```

---

## 4. TÍCH HỢP SPRING AI 2.0 (BẢN GA CHÍNH THỨC)

Khác với các phiên bản Milestone/Snapshot thử nghiệm, **Spring AI 2.0 GA** cung cấp bộ công cụ ổn định cho việc giao tiếp với các mô hình ngôn ngữ lớn (LLMs như Gemini, OpenAI):
- Sử dụng `ChatClient` theo phong cách fluent API:
  ```java
  var response = chatClient.prompt()
          .user(userMessage)
          .tools(orderTrackingTools) // Tự động gọi tool tra cứu đơn hàng thật trong DB
          .call()
          .content();
  ```
- Đảm bảo AI chỉ trả lời dựa trên dữ liệu thật (Grounding via Tool Calling), loại bỏ hoàn toàn hiện tượng AI bịa đặt hành trình.

---

| **Tác giả thiết kế & Phát triển** |
| :---: |
| **Nguyễn Công Hưởng** |
| *(Solo Fullstack Lead, Microservices & AI Architect)* |
