package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.dto.pricing.PricingMatrixRequest;
import vn.rikkei.post.dto.pricing.PricingPolicyRequest;
import vn.rikkei.post.entity.PricingMatrix;
import vn.rikkei.post.entity.PricingPolicy;
import vn.rikkei.post.repository.OrderRepository;
import vn.rikkei.post.repository.PricingMatrixRepository;
import vn.rikkei.post.repository.PricingPolicyRepository;
import vn.rikkei.post.service.PricingService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PricingServiceImpl implements PricingService {

    private final PricingMatrixRepository pricingMatrixRepository;
    private final PricingPolicyRepository pricingPolicyRepository;
    private final OrderRepository orderRepository;

    @Override
    public PriceEstimateResponse calculatePrice(CalculatePriceRequest request) {
        int length = request.getLengthCm() != null && request.getLengthCm() > 0 ? request.getLengthCm() : 10;
        int width = request.getWidthCm() != null && request.getWidthCm() > 0 ? request.getWidthCm() : 10;
        int height = request.getHeightCm() != null && request.getHeightCm() > 0 ? request.getHeightCm() : 10;

        // Tính trọng lượng quy đổi thể tích: (Dài x Rộng x Cao) / 6000 * 1000 ra gram
        double volWeightKg = (double) (length * width * height) / 6000.0;
        int volumetricWeightGram = (int) Math.ceil(volWeightKg * 1000.0);

        int actualWeightGram = request.getActualWeightGram() != null ? request.getActualWeightGram() : 100;
        int billableWeightGram = Math.max(actualWeightGram, volumetricWeightGram);

        String zoneType = determineZone(request.getSenderProvinceId(), request.getReceiverProvinceId());
        String serviceType = request.getServiceType() != null && !request.getServiceType().isBlank()
                ? request.getServiceType().toUpperCase()
                : "STANDARD";

        PricingMatrix matrix = pricingMatrixRepository
                .findByServiceTypeAndZoneTypeAndIsActiveTrue(serviceType, zoneType)
                .orElseGet(() -> getDefaultPricing(serviceType, zoneType));

        BigDecimal shippingFee = matrix.getBasePrice();
        if (billableWeightGram > matrix.getBaseWeightGram()) {
            int extraWeight = billableWeightGram - matrix.getBaseWeightGram();
            int extraSteps = (int) Math.ceil((double) extraWeight / matrix.getStepWeightGram());
            BigDecimal extraFee = matrix.getStepPrice().multiply(BigDecimal.valueOf(extraSteps));
            shippingFee = shippingFee.add(extraFee);
        }

        // Lấy chính sách phụ phí động từ Cơ sở dữ liệu (không hardcode vào code)
        PricingPolicy policy = getPricingPolicy();

        // 1. Tính cước bảo hiểm khai giá động theo cấu hình Admin
        BigDecimal insuranceFee = BigDecimal.ZERO;
        if (request.getItemValue() != null
                && request.getItemValue().compareTo(policy.getInsuranceValueThreshold()) > 0) {
            insuranceFee = request.getItemValue().multiply(policy.getInsurancePercentRate()).setScale(0,
                    RoundingMode.HALF_UP);
        }

        // 2. Tính phí phương thức lấy hàng động (Shop tự mang ra bưu cục vs Bưu tá đến
        // lấy)
        String pickupType = request.getPickupType() != null ? request.getPickupType() : "DROP_OFF";
        BigDecimal pickupFee = BigDecimal.ZERO;
        boolean isPickupFree = false;
        String pickupFeeNote = "Shop tự mang hàng ra bưu cục gửi (0 đ)";

        if ("DOOR_PICKUP".equalsIgnoreCase(pickupType)) {
            // Kiểm tra số lượng đơn của shop: Nếu > freePickupOrderThreshold thì MIỄN PHÍ
            // lấy hàng
            long totalOrders = 0;
            if (request.getMerchantTotalOrders() != null) {
                totalOrders = request.getMerchantTotalOrders();
            } else if (request.getMerchantId() != null) {
                try {
                    totalOrders = orderRepository.countByMerchantId(request.getMerchantId());
                } catch (Exception e) {
                    log.warn("Không thể đếm số lượng đơn của merchant {}: {}", request.getMerchantId(), e.getMessage());
                }
            }

            if (totalOrders > policy.getFreePickupOrderThreshold()) {
                isPickupFree = true;
                pickupFee = BigDecimal.ZERO;
                pickupFeeNote = String.format("🎉 Miễn phí lấy hàng tận nơi (Ưu đãi Shop thân thiết > %d đơn hàng)",
                        policy.getFreePickupOrderThreshold());
            } else {
                // Kiểm tra hàng nhỏ hay cồng kềnh
                int maxDim = Math.max(length, Math.max(width, height));
                int sumDim = length + width + height;
                boolean isBulky = billableWeightGram > policy.getBulkyWeightThresholdGram()
                        || maxDim > policy.getBulkyMaxDimensionCm()
                        || sumDim > policy.getBulkySumDimensionsCm();

                if (!isBulky) {
                    pickupFee = policy.getDoorPickupBaseFee();
                    pickupFeeNote = String.format("Phí bưu tá đến lấy (Đơn hàng nhỏ: %,d đ/lần)", pickupFee.intValue());
                } else {
                    // Đơn hàng to, cồng kềnh: Phí cơ sở + phụ phí theo cân nặng & kích thước
                    BigDecimal basePickup = policy.getDoorPickupBaseFee();
                    int extraWeightGram = Math.max(0, billableWeightGram - policy.getBulkyWeightThresholdGram());
                    int extraKg = (int) Math.ceil((double) extraWeightGram / 1000.0);
                    BigDecimal extraWeightFee = policy.getBulkyExtraPricePerKg().multiply(BigDecimal.valueOf(extraKg));

                    BigDecimal dimensionFee = BigDecimal.ZERO;
                    if (maxDim > 50 || sumDim > 100) {
                        dimensionFee = policy.getOversizeDimensionFee();
                    }

                    pickupFee = basePickup.add(extraWeightFee).add(dimensionFee);
                    pickupFeeNote = String.format("Phí bưu tá đến lấy (Đơn to/cồng kềnh: %,d đ cơ sở + %,d đ phụ phí)",
                            basePickup.intValue(), extraWeightFee.add(dimensionFee).intValue());
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
        } else if ("ROAD_FREIGHT".equalsIgnoreCase(serviceType)) {
            base = base.multiply(BigDecimal.valueOf(0.8));
            hours = hours + 24;
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
    @Cacheable(value = "pricing:matrix", key = "'active'")
    public List<PricingMatrix> getAllActivePricing() {
        return pricingMatrixRepository.findAll().stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsActive()))
                .toList();
    }

    @Override
    public List<PricingMatrix> getAllPricingMatrices() {
        return pricingMatrixRepository.findAllByOrderByServiceTypeAscZoneTypeAsc();
    }

    @Override
    @Transactional
    @CacheEvict(value = "pricing:matrix", allEntries = true)
    public PricingMatrix createPricingMatrix(PricingMatrixRequest request) {
        String service = request.getServiceType().trim().toUpperCase();
        String zone = request.getZoneType().trim().toUpperCase();

        if (pricingMatrixRepository.existsByServiceTypeAndZoneType(service, zone)) {
            throw new IllegalArgumentException(
                    String.format("Đã tồn tại cấu hình cước cho dịch vụ '%s' và vùng cước '%s'", service, zone));
        }

        PricingMatrix matrix = PricingMatrix.builder()
                .serviceType(service)
                .zoneType(zone)
                .baseWeightGram(request.getBaseWeightGram())
                .basePrice(request.getBasePrice())
                .stepWeightGram(request.getStepWeightGram())
                .stepPrice(request.getStepPrice())
                .estimatedDeliveryHours(request.getEstimatedDeliveryHours())
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();

        return pricingMatrixRepository.save(matrix);
    }

    @Override
    @Transactional
    @CacheEvict(value = "pricing:matrix", allEntries = true)
    public PricingMatrix updatePricingMatrix(Long id, PricingMatrixRequest request) {
        PricingMatrix matrix = pricingMatrixRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy cấu hình cước ID: " + id));

        String service = request.getServiceType().trim().toUpperCase();
        String zone = request.getZoneType().trim().toUpperCase();

        if (pricingMatrixRepository.existsByServiceTypeAndZoneTypeAndIdNot(service, zone, id)) {
            throw new IllegalArgumentException(
                    String.format("Đã tồn tại cấu hình cước cho dịch vụ '%s' và vùng cước '%s'", service, zone));
        }

        matrix.setServiceType(service);
        matrix.setZoneType(zone);
        matrix.setBaseWeightGram(request.getBaseWeightGram());
        matrix.setBasePrice(request.getBasePrice());
        matrix.setStepWeightGram(request.getStepWeightGram());
        matrix.setStepPrice(request.getStepPrice());
        matrix.setEstimatedDeliveryHours(request.getEstimatedDeliveryHours());
        if (request.getIsActive() != null) {
            matrix.setIsActive(request.getIsActive());
        }

        return pricingMatrixRepository.save(matrix);
    }

    @Override
    @Transactional
    @CacheEvict(value = "pricing:matrix", allEntries = true)
    public void deletePricingMatrix(Long id) {
        if (!pricingMatrixRepository.existsById(id)) {
            throw new IllegalArgumentException("Không tìm thấy cấu hình cước ID: " + id);
        }
        pricingMatrixRepository.deleteById(id);
    }

    @Override
    @Transactional
    @CacheEvict(value = "pricing:matrix", allEntries = true)
    public PricingMatrix togglePricingMatrixActive(Long id) {
        PricingMatrix matrix = pricingMatrixRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy cấu hình cước ID: " + id));
        matrix.setIsActive(!Boolean.TRUE.equals(matrix.getIsActive()));
        return pricingMatrixRepository.save(matrix);
    }

    @Override
    @Cacheable(value = "pricing:policies", key = "'current'")
    public PricingPolicy getPricingPolicy() {
        return pricingPolicyRepository.findFirstByOrderByIdAsc()
                .orElseGet(() -> pricingPolicyRepository.save(PricingPolicy.builder().build()));
    }

    @Override
    @Transactional
    @CacheEvict(value = "pricing:policies", allEntries = true)
    public PricingPolicy updatePricingPolicy(PricingPolicyRequest request) {
        PricingPolicy policy = getPricingPolicy();
        policy.setDoorPickupBaseFee(request.getDoorPickupBaseFee());
        policy.setFreePickupOrderThreshold(request.getFreePickupOrderThreshold());
        policy.setBulkyWeightThresholdGram(request.getBulkyWeightThresholdGram());
        policy.setBulkyMaxDimensionCm(request.getBulkyMaxDimensionCm());
        policy.setBulkySumDimensionsCm(request.getBulkySumDimensionsCm());
        policy.setBulkyExtraPricePerKg(request.getBulkyExtraPricePerKg());
        policy.setOversizeDimensionFee(request.getOversizeDimensionFee());
        policy.setInsuranceValueThreshold(request.getInsuranceValueThreshold());
        policy.setInsurancePercentRate(request.getInsurancePercentRate());
        return pricingPolicyRepository.save(policy);
    }
}
