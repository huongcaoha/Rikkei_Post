package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.entity.PricingMatrix;
import vn.rikkei.post.repository.PricingMatrixRepository;
import vn.rikkei.post.service.PricingService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PricingServiceImpl implements PricingService {

    private final PricingMatrixRepository pricingMatrixRepository;
    private final vn.rikkei.post.repository.OrderRepository orderRepository;

    @Override
    public PriceEstimateResponse calculatePrice(CalculatePriceRequest request) {
        int length = request.getLengthCm() != null && request.getLengthCm() > 0 ? request.getLengthCm() : 10;
        int width = request.getWidthCm() != null && request.getWidthCm() > 0 ? request.getWidthCm() : 10;
        int height = request.getHeightCm() != null && request.getHeightCm() > 0 ? request.getHeightCm() : 10;

        // Tính trọng lượng quy đổi: (Dài x Rộng x Cao) / 6000 * 1000 ra gram
        double volWeightKg = (double) (length * width * height) / 6000.0;
        int volumetricWeightGram = (int) Math.ceil(volWeightKg * 1000.0);

        int actualWeightGram = request.getActualWeightGram() != null ? request.getActualWeightGram() : 100;
        int billableWeightGram = Math.max(actualWeightGram, volumetricWeightGram);

        String zoneType = determineZone(request.getSenderProvinceId(), request.getReceiverProvinceId());
        String serviceType = request.getServiceType() != null ? request.getServiceType() : "STANDARD";

        PricingMatrix matrix = pricingMatrixRepository.findByServiceTypeAndZoneTypeAndIsActiveTrue(serviceType, zoneType)
                .orElseGet(() -> getDefaultPricing(serviceType, zoneType));

        BigDecimal shippingFee = matrix.getBasePrice();
        if (billableWeightGram > matrix.getBaseWeightGram()) {
            int extraWeight = billableWeightGram - matrix.getBaseWeightGram();
            int extraSteps = (int) Math.ceil((double) extraWeight / matrix.getStepWeightGram());
            BigDecimal extraFee = matrix.getStepPrice().multiply(BigDecimal.valueOf(extraSteps));
            shippingFee = shippingFee.add(extraFee);
        }

        // Tính cước bảo hiểm khai giá: 0.5% nếu giá trị bưu gửi > 1,000,000 VNĐ
        BigDecimal insuranceFee = BigDecimal.ZERO;
        if (request.getItemValue() != null && request.getItemValue().compareTo(BigDecimal.valueOf(1000000)) > 0) {
            insuranceFee = request.getItemValue().multiply(BigDecimal.valueOf(0.005)).setScale(0, RoundingMode.HALF_UP);
        }

        // Tính phí phương thức lấy hàng (Shop giao đến bưu cục vs Bưu cục đến tận nơi lấy)
        String pickupType = request.getPickupType() != null ? request.getPickupType() : "DROP_OFF";
        BigDecimal pickupFee = BigDecimal.ZERO;
        boolean isPickupFree = false;
        String pickupFeeNote = "Shop tự mang hàng ra bưu cục gửi (0 đ)";

        if ("DOOR_PICKUP".equalsIgnoreCase(pickupType)) {
            // Kiểm tra số lượng đơn của shop: Nếu > 5 đơn thì MIỄN PHÍ lấy hàng tận nơi
            long totalOrders = 0;
            if (request.getMerchantTotalOrders() != null) {
                totalOrders = request.getMerchantTotalOrders();
            } else if (request.getMerchantId() != null) {
                try {
                    totalOrders = orderRepository.countByMerchantId(request.getMerchantId());
                } catch (Exception e) {
                    log.warn("Không thể đếm số lượng đơn của merchant: {}", e.getMessage());
                }
            }

            if (totalOrders > 5) {
                isPickupFree = true;
                pickupFee = BigDecimal.ZERO;
                pickupFeeNote = "🎉 Miễn phí lấy hàng tận nơi (Ưu đãi Shop thân thiết > 5 đơn hàng)";
            } else {
                // Đơn hàng nhỏ: trọng lượng tính cước <= 2000g và chiều dài nhất <= 40cm, tổng 3 chiều <= 80cm
                int maxDim = Math.max(length, Math.max(width, height));
                int sumDim = length + width + height;
                boolean isBulky = billableWeightGram > 2000 || maxDim > 40 || sumDim > 80;

                if (!isBulky) {
                    pickupFee = BigDecimal.valueOf(15000);
                    pickupFeeNote = "Phí bưu tá đến lấy (Đơn hàng nhỏ: 15.000 đ/lần)";
                } else {
                    // Đơn hàng to, cồng kềnh: Phí cơ sở 15.000 + phụ phí theo cân nặng & kích thước
                    BigDecimal basePickup = BigDecimal.valueOf(15000);
                    int extraWeightGram = Math.max(0, billableWeightGram - 2000);
                    int extraKg = (int) Math.ceil((double) extraWeightGram / 1000.0);
                    BigDecimal extraWeightFee = BigDecimal.valueOf(extraKg * 5000L); // 5.000 đ mỗi kg phụ trội

                    BigDecimal dimensionFee = BigDecimal.ZERO;
                    if (maxDim > 50 || sumDim > 100) {
                        dimensionFee = BigDecimal.valueOf(10000); // 10.000 đ phụ phí hàng quá khổ
                    }

                    pickupFee = basePickup.add(extraWeightFee).add(dimensionFee);
                    pickupFeeNote = String.format("Phí bưu tá đến lấy (Đơn to/cồng kềnh: 15.000 đ cơ sở + %s đ phụ phí cân nặng/kích thước)",
                            extraWeightFee.add(dimensionFee).intValue());
                }
            }
        }

        BigDecimal totalFee = shippingFee.add(insuranceFee).add(pickupFee);

        return PriceEstimateResponse.builder()
                .actualWeightGram(actualWeightGram)
                .volumetricWeightGram(volumetricWeightGram)
                .billableWeightGram(billableWeightGram)
                .zoneType(zoneType)
                .shippingFee(shippingFee)
                .insuranceFee(insuranceFee)
                .pickupType(pickupType)
                .pickupFee(pickupFee)
                .isPickupFree(isPickupFree)
                .pickupFeeNote(pickupFeeNote)
                .totalFee(totalFee)
                .estimatedDeliveryHours(matrix.getEstimatedDeliveryHours())
                .build();
    }

    @Override
    public String determineZone(Integer senderProvinceId, Integer receiverProvinceId) {
        if (senderProvinceId == null || receiverProvinceId == null) {
            return "INTRA_PROVINCE";
        }
        if (senderProvinceId.equals(receiverProvinceId)) {
            return "INTRA_PROVINCE";
        }

        int senderRegion = getRegion(senderProvinceId); // 1: Bắc, 2: Trung, 3: Nam
        int receiverRegion = getRegion(receiverProvinceId);

        if (senderRegion == receiverRegion) {
            return "INTRA_REGION";
        }
        if (Math.abs(senderRegion - receiverRegion) == 1) {
            return "INTER_REGION_NEAR";
        }
        return "INTER_REGION_FAR";
    }

    private int getRegion(int provinceId) {
        if (provinceId <= 37) {
            return 1; // Miền Bắc
        } else if (provinceId <= 68) {
            return 2; // Miền Trung
        } else {
            return 3; // Miền Nam
        }
    }

    private PricingMatrix getDefaultPricing(String serviceType, String zoneType) {
        BigDecimal base = BigDecimal.valueOf(16000);
        BigDecimal step = BigDecimal.valueOf(3000);
        int hours = 24;

        switch (zoneType) {
            case "INTRA_REGION" -> {
                base = BigDecimal.valueOf(26000);
                step = BigDecimal.valueOf(5000);
                hours = 48;
            }
            case "INTER_REGION_NEAR" -> {
                base = BigDecimal.valueOf(32000);
                step = BigDecimal.valueOf(6000);
                hours = 72;
            }
            case "INTER_REGION_FAR" -> {
                base = BigDecimal.valueOf(38000);
                step = BigDecimal.valueOf(7000);
                hours = 96;
            }
        }

        if ("EXPRESS".equalsIgnoreCase(serviceType)) {
            base = base.multiply(BigDecimal.valueOf(1.5));
            hours = Math.max(12, hours / 2);
        }

        return PricingMatrix.builder()
                .serviceType(serviceType)
                .zoneType(zoneType)
                .baseWeightGram(500)
                .basePrice(base)
                .stepWeightGram(500)
                .stepPrice(step)
                .estimatedDeliveryHours(hours)
                .isActive(true)
                .build();
    }

    @Override
    public List<PricingMatrix> getAllActivePricing() {
        return pricingMatrixRepository.findAll();
    }
}
