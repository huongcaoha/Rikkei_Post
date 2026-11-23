package vn.rikkei.post.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.entity.PricingMatrix;
import vn.rikkei.post.repository.PricingMatrixRepository;
import vn.rikkei.post.service.impl.PricingServiceImpl;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PricingServiceTest {

    @Mock
    private PricingMatrixRepository pricingMatrixRepository;

    private PricingService pricingService;

    @BeforeEach
    void setUp() {
        pricingService = new PricingServiceImpl(pricingMatrixRepository);
    }

    @Test
    @DisplayName("Kiểm tra xác định vùng cước: Nội tỉnh")
    void testDetermineZone_IntraProvince() {
        String zone = pricingService.determineZone(1, 1); // Hà Nội -> Hà Nội
        assertEquals("INTRA_PROVINCE", zone);
    }

    @Test
    @DisplayName("Kiểm tra xác định vùng cước: Liên vùng xa (Hà Nội -> TP.HCM)")
    void testDetermineZone_InterRegionFar() {
        String zone = pricingService.determineZone(1, 79); // Hà Nội -> TP.HCM
        assertEquals("INTER_REGION_FAR", zone);
    }

    @Test
    @DisplayName("Kiểm tra tính trọng lượng quy đổi thể tích (DxRxC / 6000)")
    void testVolumetricWeightCalculation() {
        PricingMatrix mockMatrix = PricingMatrix.builder()
                .serviceType("STANDARD")
                .zoneType("INTRA_PROVINCE")
                .baseWeightGram(500)
                .basePrice(BigDecimal.valueOf(16000))
                .stepWeightGram(500)
                .stepPrice(BigDecimal.valueOf(3000))
                .estimatedDeliveryHours(24)
                .isActive(true)
                .build();

        when(pricingMatrixRepository.findByServiceTypeAndZoneTypeAndIsActiveTrue(anyString(), anyString()))
                .thenReturn(Optional.of(mockMatrix));

        // Kiện hàng nhẹ nhưng cồng kềnh: 30x20x10 cm = 6000 cm3 / 6000 = 1kg (1000g)
        // Trọng lượng thực chỉ 300g -> Tính theo 1000g
        CalculatePriceRequest request = CalculatePriceRequest.builder()
                .senderProvinceId(1)
                .receiverProvinceId(1)
                .actualWeightGram(300)
                .lengthCm(30)
                .widthCm(20)
                .heightCm(10)
                .itemValue(BigDecimal.valueOf(200000))
                .serviceType("STANDARD")
                .build();

        PriceEstimateResponse response = pricingService.calculatePrice(request);

        assertNotNull(response);
        assertEquals(300, response.getActualWeightGram());
        assertEquals(1000, response.getVolumetricWeightGram());
        assertEquals(1000, response.getBillableWeightGram());
        // 500g đầu: 16000, 500g thêm: 3000 -> 19000
        assertEquals(BigDecimal.valueOf(19000), response.getShippingFee());
        assertEquals(BigDecimal.ZERO, response.getInsuranceFee());
        assertEquals(BigDecimal.valueOf(19000), response.getTotalFee());
    }

    @Test
    @DisplayName("Kiểm tra tính phí bảo hiểm khai giá khi giá trị hàng > 1,000,000 VNĐ")
    void testInsuranceFeeCalculation() {
        PricingMatrix mockMatrix = PricingMatrix.builder()
                .serviceType("STANDARD")
                .zoneType("INTRA_PROVINCE")
                .baseWeightGram(500)
                .basePrice(BigDecimal.valueOf(16000))
                .stepWeightGram(500)
                .stepPrice(BigDecimal.valueOf(3000))
                .estimatedDeliveryHours(24)
                .isActive(true)
                .build();

        when(pricingMatrixRepository.findByServiceTypeAndZoneTypeAndIsActiveTrue(anyString(), anyString()))
                .thenReturn(Optional.of(mockMatrix));

        // Hàng giá trị 2,000,000 VNĐ -> Bảo hiểm 0.5% = 10,000 VNĐ
        CalculatePriceRequest request = CalculatePriceRequest.builder()
                .senderProvinceId(1)
                .receiverProvinceId(1)
                .actualWeightGram(500)
                .lengthCm(10)
                .widthCm(10)
                .heightCm(10)
                .itemValue(BigDecimal.valueOf(2000000))
                .serviceType("STANDARD")
                .build();

        PriceEstimateResponse response = pricingService.calculatePrice(request);

        assertEquals(BigDecimal.valueOf(10000), response.getInsuranceFee());
        assertEquals(BigDecimal.valueOf(26000), response.getTotalFee()); // 16000 cước + 10000 bảo hiểm
    }
}
