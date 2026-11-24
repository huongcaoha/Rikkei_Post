package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.rikkei.post.dto.ai.*;
import vn.rikkei.post.entity.MerchantWallet;
import vn.rikkei.post.entity.Order;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.MerchantWalletRepository;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.AiCustomerSupportService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiCustomerSupportServiceImpl implements AiCustomerSupportService {

    private final OrderRepository orderRepository;
    private final WarehouseRepository warehouseRepository;
    private final MerchantWalletRepository walletRepository;

    private static final Pattern TRACKING_CODE_PATTERN = Pattern.compile("(?i)\\b(RKP[A-Z0-9]+)\\b");

    @Override
    public AiChatResponse chat(AiChatRequest request) {
        String message = request.getMessage() != null ? request.getMessage().trim() : "";
        String lowerMsg = message.toLowerCase();

        // 1. Kiểm tra mã vận đơn trong tin nhắn (VD: RKP12345678)
        Matcher matcher = TRACKING_CODE_PATTERN.matcher(message);
        if (matcher.find()) {
            String trackingCode = matcher.group(1).toUpperCase();
            return handleOrderTracking(trackingCode);
        }

        // 2. Nhận diện ý định Tra cứu đơn hàng khi người dùng không kèm mã
        if (lowerMsg.contains("tra cứu") || lowerMsg.contains("kiểm tra đơn") || lowerMsg.contains("vận đơn") || lowerMsg.contains("đơn hàng của tôi")) {
            return AiChatResponse.builder()
                    .reply("Dạ em sẵn sàng hỗ trợ tra cứu hành trình bưu gửi ạ! Vui lòng cung cấp **Mã vận đơn** (ví dụ: `RKP17954...`) để em kiểm tra tiến độ giao nhận và vị trí hiện tại của đơn hàng ngay lập tức nhé!")
                    .detectedIntent("TRACK_ORDER")
                    .suggestions(List.of("Tra cứu đơn RKP...", "Bảng giá cước vận chuyển", "Tìm bưu cục gần nhất"))
                    .build();
        }

        // 3. Nhận diện ý định Bưu cục / Kho bãi
        if (lowerMsg.contains("bưu cục") || lowerMsg.contains("kho") || lowerMsg.contains("ở đâu") || lowerMsg.contains("địa chỉ") || lowerMsg.contains("gần nhất")) {
            return handlePostOfficeLookup(lowerMsg);
        }

        // 4. Nhận diện ý định Ví Shop / Tiền COD / Đối soát
        if (lowerMsg.contains("cod") || lowerMsg.contains("ví") || lowerMsg.contains("đối soát") || lowerMsg.contains("rút tiền") || lowerMsg.contains("số dư")) {
            return handleWalletAndCod(request.getUserId());
        }

        // 5. Nhận diện ý định Giá cước / Báo giá vận chuyển
        if (lowerMsg.contains("cước") || lowerMsg.contains("giá") || lowerMsg.contains("báo giá") || lowerMsg.contains("bao nhiêu tiền") || lowerMsg.contains("phí gửi")) {
            return handlePricingInquiry();
        }

        // 6. Mặc định: Chào hỏi & Trợ lý điều hướng
        return handleGeneralGreeting();
    }

    private AiChatResponse handleOrderTracking(String trackingCode) {
        Optional<Order> orderOpt = orderRepository.findByTrackingCode(trackingCode);
        if (orderOpt.isEmpty()) {
            return AiChatResponse.builder()
                    .reply("Rất tiếc, em không tìm thấy đơn hàng với mã **" + trackingCode + "** trên hệ thống Rikkei_Post. Anh/Chị vui lòng kiểm tra lại chính xác mã vận đơn nhé!")
                    .detectedIntent("TRACK_ORDER")
                    .suggestions(List.of("Liên hệ tổng đài 1900-RIKKEI", "Tìm bưu cục gửi hàng", "Bảng giá cước"))
                    .build();
        }

        Order order = orderOpt.get();
        String statusText = getStatusVietnamese(order.getCurrentStatus());
        String etaStr = order.getEstimatedDeliveryAt() != null ?
                order.getEstimatedDeliveryAt().format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")) : "Dự kiến 24-48 giờ tới";

        StringBuilder reply = new StringBuilder();
        reply.append("### 📦 Thông tin Hành trình Bưu gửi: `").append(order.getTrackingCode()).append("`\n\n");
        reply.append("- **Trạng thái hiện tại:** `").append(statusText).append("`\n");
        reply.append("- **Hàng hóa:** ").append(order.getItemName() != null ? order.getItemName() : "Bưu kiện").append(" (").append(order.getActualWeightGram() != null ? order.getActualWeightGram() : 0).append("g)\n");
        reply.append("- **Người nhận:** ").append(order.getReceiverName()).append(" - ").append(maskPhone(order.getReceiverPhone())).append("\n");
        reply.append("- **Địa chỉ phát:** ").append(order.getReceiverAddress() != null ? order.getReceiverAddress() : "").append("\n");
        reply.append("- **Tiền thu hộ COD:** `").append(String.format("%,.0f VNĐ", order.getCodAmount() != null ? order.getCodAmount().doubleValue() : 0.0)).append("`\n");
        reply.append("- **Dự kiến phát hàng (ETA):** ⏱️ **").append(etaStr).append("**\n");

        if (order.getAssignedShipperName() != null && !order.getAssignedShipperName().isBlank()) {
            reply.append("- **Bưu tá đang phụ trách:** 🚴 ").append(order.getAssignedShipperName())
                    .append(" (SĐT: ").append(order.getAssignedShipperPhone() != null ? order.getAssignedShipperPhone() : "Chưa cập nhật").append(")\n");
        }

        if ("DELIVERED".equalsIgnoreCase(order.getCurrentStatus())) {
            reply.append("\n✅ **Bưu phẩm đã phát thành công vào lúc:** ")
                    .append(order.getDeliveredAt() != null ? order.getDeliveredAt().format(DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy")) : "Vừa xong")
                    .append("\nNgười nhận ký nhận: **").append(order.getPodReceiverName() != null ? order.getPodReceiverName() : order.getReceiverName()).append("**");
        }

        return AiChatResponse.builder()
                .reply(reply.toString())
                .detectedIntent("TRACK_ORDER")
                .structuredData(order)
                .suggestions(List.of("Xem chi tiết đơn trên bản đồ", "Hỗ trợ thay đổi thời gian giao", "Tính cước gửi đơn khác"))
                .build();
    }

    private AiChatResponse handlePostOfficeLookup(String query) {
        List<Warehouse> hubs = warehouseRepository.findByIsActiveTrue();
        if (hubs.isEmpty()) {
            return AiChatResponse.builder()
                    .reply("Hiện tại hệ thống đang cập nhật mạng lưới bưu cục. Quý khách vui lòng liên hệ hotline **1900-RIKKEI** để được hỗ trợ bưu cục gần nhất!")
                    .detectedIntent("POST_OFFICE_FIND")
                    .build();
        }

        StringBuilder reply = new StringBuilder();
        reply.append("### 🏢 Hệ thống Bưu cục & Trung tâm Khai thác Rikkei_Post\n\n");
        reply.append("Rikkei_Post hiện có mạng lưới bưu cục phủ sóng rộng khắp, mở cửa phục vụ từ **07:30 - 20:30** tất cả các ngày trong tuần:\n\n");

        int count = 0;
        for (Warehouse wh : hubs) {
            if (count >= 5) break;
            reply.append(++count).append(". **").append(wh.getName()).append("** (`").append(wh.getCode()).append("`)\n");
            reply.append("   - 📍 Địa chỉ: ").append(wh.getAddress() != null ? wh.getAddress() : "Trung tâm hành chính").append("\n");
            reply.append("   - 📞 Hotline CSKH: 1900-RIKKEI (Bưu cục: ").append(wh.getName()).append(")\n");
            reply.append("   - ⏰ Giờ hoạt động: 07:30 - 20:30 (Thứ 2 - Chủ Nhật)\n\n");
        }

        reply.append("👉 Anh/Chị có thể mang hàng trực tiếp đến bưu cục gần nhất hoặc tạo đơn online để bưu tá đến tận nhà lấy miễn phí nhé!");

        return AiChatResponse.builder()
                .reply(reply.toString())
                .detectedIntent("POST_OFFICE_FIND")
                .structuredData(hubs.stream().limit(5).collect(Collectors.toList()))
                .suggestions(List.of("Tạo đơn giao hàng mới", "Bảng giá cước vận chuyển", "Tra cứu đơn hàng"))
                .build();
    }

    private AiChatResponse handleWalletAndCod(Long userId) {
        if (userId == null) {
            return AiChatResponse.builder()
                    .reply("Chính sách đối soát COD của **Rikkei_Post**:\n"
                            + "- **Lịch đối soát tự động:** Định kỳ thứ 2, thứ 4, thứ 6 hàng tuần hoặc đối soát theo yêu cầu 24/7.\n"
                            + "- **Phí chuyển khoản:** Hoàn toàn miễn phí về tài khoản ngân hàng liên kết.\n"
                            + "- Quý khách vui lòng đăng nhập tài khoản Shop để xem số dư ví và yêu cầu rút tiền trực tiếp nhé!")
                    .detectedIntent("COD_BALANCE")
                    .suggestions(List.of("Đăng nhập tài khoản", "Bảng giá cước vận chuyển", "Tra cứu đơn hàng"))
                    .build();
        }

        Optional<MerchantWallet> walletOpt = walletRepository.findByMerchantId(userId);
        if (walletOpt.isEmpty()) {
            return AiChatResponse.builder()
                    .reply("Tài khoản của bạn hiện tại chưa phát sinh số dư ví COD. Khi các đơn hàng được giao thành công, tiền COD sẽ tự động cập nhật vào ví của bạn!")
                    .detectedIntent("COD_BALANCE")
                    .build();
        }

        MerchantWallet w = walletOpt.get();
        StringBuilder reply = new StringBuilder();
        reply.append("### 💰 Thông tin Ví Shop & Số dư COD Rikkei_Post\n\n");
        reply.append("- **Số dư khả dụng (Có thể rút ngay):** `").append(String.format("%,.0f VNĐ", w.getAvailableBalance().doubleValue())).append("`\n");
        reply.append("- **Tiền COD đang chờ quyết toán:** `").append(String.format("%,.0f VNĐ", w.getHoldingCodBalance().doubleValue())).append("`\n");
        reply.append("- **Tổng tiền đã rút về tài khoản:** `").append(String.format("%,.0f VNĐ", w.getTotalWithdrawn().doubleValue())).append("`\n");
        reply.append("- **Tài khoản thụ hưởng:** ").append(w.getBankName()).append(" - ").append(w.getBankAccountNumber()).append(" (").append(w.getBankAccountHolder()).append(")\n\n");
        reply.append("💡 *Bạn có thể vào trang **Đối soát & Ví Shop** để tạo lệnh rút tiền về tài khoản ngân hàng bất cứ lúc nào (tối thiểu 50,000 đ).*");

        return AiChatResponse.builder()
                .reply(reply.toString())
                .detectedIntent("COD_BALANCE")
                .structuredData(w)
                .suggestions(List.of("Rút tiền về tài khoản", "Xem bảng kê đối soát", "Tạo đơn hàng mới"))
                .build();
    }

    private AiChatResponse handlePricingInquiry() {
        return AiChatResponse.builder()
                .reply("### 🚀 Biểu phí Chuyển phát Tiêu chuẩn Rikkei_Post\n\n"
                        + "| Dịch vụ | Khối lượng cơ bản (<=500g) | Mỗi 500g tiếp theo | Thời gian toàn trình |\n"
                        + "| :--- | :--- | :--- | :--- |\n"
                        + "| **Nội tỉnh (Intra-Prov)** | `16,500 đ` | `+2,500 đ` | 6 - 24 giờ |\n"
                        + "| **Nội miền (Intra-Region)** | `24,000 đ` | `+3,500 đ` | 24 - 48 giờ |\n"
                        + "| **Liên miền (Inter-Region)** | `32,000 đ` | `+5,000 đ` | 48 - 72 giờ |\n\n"
                        + "🎁 **Ưu đãi đặc biệt:**\n"
                        + "- Miễn phí lấy hàng tận nơi không giới hạn số lượng.\n"
                        + "- Miễn phí thu hộ COD lên đến 3,000,000 đ.\n"
                        + "- Tặng bảo hiểm hàng hóa cơ bản trị giá dưới 1,000,000 đ.")
                .detectedIntent("PRICE_CALC")
                .suggestions(List.of("Tạo đơn hàng ngay", "Dự báo thời gian giao hàng", "Tìm bưu cục gần nhất"))
                .build();
    }

    private AiChatResponse handleGeneralGreeting() {
        return AiChatResponse.builder()
                .reply("👋 **Xin chào! Em là Trợ lý AI Thông minh của Rikkei_Post.**\n\n"
                        + "Em có thể hỗ trợ Anh/Chị:\n"
                        + "1. 🔍 **Tra cứu bưu gửi:** Cung cấp mã vận đơn để kiểm tra vị trí & bưu tá phụ trách.\n"
                        + "2. 💰 **Biểu phí & Ước tính cước:** Báo giá chuyển phát nhanh nội thành & liên tỉnh.\n"
                        + "3. 🏢 **Tìm kiếm Bưu cục:** Vị trí, giờ làm việc, hotline liên hệ bưu cục gần nhất.\n"
                        + "4. 💵 **Đối soát COD & Ví Shop:** Kiểm tra số dư và tiến độ quyết toán doanh thu.\n\n"
                        + "Anh/Chị cần em giải đáp thông tin gì hôm nay ạ?")
                .detectedIntent("GENERAL_FAQ")
                .suggestions(List.of("Tra cứu đơn hàng", "Biểu phí cước vận chuyển", "Tìm bưu cục gần nhất", "Chính sách đối soát COD"))
                .build();
    }

    @Override
    public PredictEtaResponse predictEta(PredictEtaRequest request) {
        boolean sameProvince = request.getSenderProvinceId() != null && request.getSenderProvinceId().equals(request.getReceiverProvinceId());
        String serviceType = request.getServiceType() != null ? request.getServiceType().toUpperCase() : "STANDARD";

        int minHours;
        int maxHours;
        String desc;

        if (sameProvince) {
            switch (serviceType) {
                case "EXPRESS":
                    minHours = 4;
                    maxHours = 12;
                    desc = "Giao hỏa tốc trong ngày cùng tỉnh/thành";
                    break;
                case "ROAD_FREIGHT":
                    minHours = 12;
                    maxHours = 24;
                    desc = "Vận tải hàng nặng nội tỉnh";
                    break;
                case "STANDARD":
                default:
                    minHours = 8;
                    maxHours = 24;
                    desc = "Chuyển phát tiêu chuẩn nội tỉnh trong vòng 24h";
                    break;
            }
        } else {
            switch (serviceType) {
                case "EXPRESS":
                    minHours = 24;
                    maxHours = 36;
                    desc = "Chuyển phát đường bay hỏa tốc liên tỉnh (24-36h)";
                    break;
                case "ROAD_FREIGHT":
                    minHours = 72;
                    maxHours = 120;
                    desc = "Vận tải đường bộ đường dài liên tỉnh (3-5 ngày)";
                    break;
                case "STANDARD":
                default:
                    minHours = 48;
                    maxHours = 72;
                    desc = "Chuyển phát tiêu chuẩn liên tỉnh (48-72h)";
                    break;
            }
        }

        LocalDateTime eta = LocalDateTime.now().plusHours(maxHours);

        return PredictEtaResponse.builder()
                .estimatedDeliveryAt(eta)
                .minHours(minHours)
                .maxHours(maxHours)
                .transitDescription(desc)
                .confidenceLevel("HIGH")
                .build();
    }

    private String getStatusVietnamese(String status) {
        if (status == null) return "Chưa xác định";
        switch (status) {
            case "ORDER_PLACED": return "Mới tạo đơn hàng";
            case "DISPATCHED_TO_SHIPPER": return "Đã phân công bưu tá đến lấy";
            case "PICKED_UP": return "Bưu tá đã lấy hàng thành công";
            case "AT_SORTING_HUB": return "Đang lưu kho / Trung tâm phân loại";
            case "IN_TRANSIT": return "Đang trung chuyển liên tỉnh";
            case "DELIVERING": return "Bưu tá đang trên đường đi phát hàng";
            case "DELIVERED": return "Đã giao hàng thành công";
            case "DELIVERY_FAILED": return "Giao hàng không thành công (Hẹn lại)";
            case "RETURNING": return "Đang hoàn trả về người gửi";
            case "RETURNED": return "Đã hoàn trả thành công";
            case "CANCELLED": return "Đã hủy đơn";
            default: return status;
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone;
        return phone.substring(0, phone.length() - 4) + "****";
    }
}
