package vn.rikkei.post.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.rikkei.post.dto.order.BatchOrderRequest;
import vn.rikkei.post.dto.order.BatchOrderResponse;
import vn.rikkei.post.dto.order.CreateOrderRequest;
import vn.rikkei.post.dto.order.DashboardStatsResponse;
import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.entity.MerchantAddress;
import vn.rikkei.post.entity.OrderTrackingLog;

import vn.rikkei.post.security.CustomUserDetails;

import java.time.LocalDate;
import java.util.List;

public interface OrderService {
    OrderResponse createOrder(CreateOrderRequest request, Long merchantId);
    BatchOrderResponse createBatchOrders(BatchOrderRequest request, Long merchantId);
    OrderResponse getOrderByTrackingCode(String trackingCode);
    Page<OrderResponse> getMerchantOrders(Long merchantId, String status, Pageable pageable);
    DashboardStatsResponse getDashboardStats(Long merchantId);
    DashboardStatsResponse getDashboardStats(CustomUserDetails currentUser, LocalDate startDate, LocalDate endDate);
    List<OrderTrackingLog> getOrderTimeline(String trackingCode);
    MerchantAddress getDefaultSenderAddress(Long merchantId);
    MerchantAddress saveDefaultSenderAddress(MerchantAddress request, Long merchantId);
}
