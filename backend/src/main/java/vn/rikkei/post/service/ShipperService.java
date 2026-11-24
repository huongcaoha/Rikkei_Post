package vn.rikkei.post.service;

import vn.rikkei.post.dto.order.OrderResponse;
import vn.rikkei.post.dto.shipper.CashReconciliationResponse;
import vn.rikkei.post.dto.shipper.CashSubmitRequest;
import vn.rikkei.post.dto.shipper.CompleteDeliveryRequest;
import vn.rikkei.post.dto.shipper.DeliveryFailureRequest;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public interface ShipperService {
    List<OrderResponse> getMyAssignedOrders(Long shipperId, String category, LocalDate startDate, LocalDate endDate);
    List<OrderResponse> getMyAssignedOrders(Long userId, Long filterShipperId, String category, LocalDate startDate, LocalDate endDate);
    Map<String, Object> getShipperSummary(Long shipperId, LocalDate startDate, LocalDate endDate);
    Map<String, Object> getShipperSummary(Long userId, Long filterShipperId, LocalDate startDate, LocalDate endDate);
    List<Map<String, Object>> getPostOfficeShippers(Long currentUserId);
    OrderResponse scanPickupOrder(Long shipperId, String trackingCode);
    OrderResponse scanInboundToPostOffice(Long shipperId, String trackingCode, Long warehouseId);
    OrderResponse scanOutForDelivery(Long shipperId, String trackingCode);
    OrderResponse scanReturnToWarehouse(Long userId, String trackingCode, String reason, String note);
    OrderResponse updateDeliveryStatus(Long shipperId, String trackingCode, String status, String note);

    // Sprint 3 - US-13: Thuật toán Tự động Điều phối lấy hàng (Smart Dispatch)
    OrderResponse smartDispatchOrder(String trackingCode, Long manualShipperId, Long currentUserId);
    Map<String, Object> smartDispatchBatch(Long postOfficeId, Long currentUserId);

    // Sprint 3 - US-16: Sinh và gửi mã xác thực OTP giao hàng
    Map<String, Object> sendDeliveryOtp(String trackingCode, Long currentUserId);

    // Sprint 3 - US-15 & US-16 & US-17: Hoàn tất giao hàng POD (Ký tên + Chụp ảnh Watermark GPS + OTP + VietQR)
    OrderResponse completeDelivery(Long shipperId, CompleteDeliveryRequest request);

    // Sprint 3 - US-18: Báo cáo ngoại lệ giao thất bại & Tự động tăng lần phát / Hàng hoàn
    OrderResponse reportDeliveryFailure(Long shipperId, DeliveryFailureRequest request);

    // Sprint 3 - US-17 & Sprint 4: Quản lý Thu hộ COD, Nộp tiền cuối ca PayOS & Đối soát
    CashReconciliationResponse getCashReconciliation(Long userId, Long filterShipperId, LocalDate date);
    CashReconciliationResponse getCashReconciliation(Long userId, Long filterShipperId, LocalDate startDate, LocalDate endDate);
    Map<String, Object> submitCashReconciliation(Long shipperId, CashSubmitRequest request);
    org.springframework.data.domain.Page<vn.rikkei.post.dto.shipper.CashSubmissionResponse> getCashSubmissions(Long shipperId, Long postOfficeId, LocalDate startDate, LocalDate endDate, org.springframework.data.domain.Pageable pageable);
    Map<String, Object> checkSubmissionPaymentStatus(String submissionCode);
    Map<String, Object> handlePayOsWebhook(vn.payos.model.webhooks.Webhook webhook);
    Map<String, Object> approveCashSubmission(String submissionCode, Long managerId);
}
