package vn.rikkei.post.service;

import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.dto.pricing.PricingMatrixRequest;
import vn.rikkei.post.dto.pricing.PricingPolicyRequest;
import vn.rikkei.post.entity.PricingMatrix;
import vn.rikkei.post.entity.PricingPolicy;

import java.util.List;

public interface PricingService {
    PriceEstimateResponse calculatePrice(CalculatePriceRequest request);
    String determineZone(Integer senderProvinceId, Integer receiverProvinceId);
    List<PricingMatrix> getAllActivePricing();
    List<PricingMatrix> getAllPricingMatrices();

    PricingMatrix createPricingMatrix(PricingMatrixRequest request);
    PricingMatrix updatePricingMatrix(Long id, PricingMatrixRequest request);
    void deletePricingMatrix(Long id);
    PricingMatrix togglePricingMatrixActive(Long id);

    PricingPolicy getPricingPolicy();
    PricingPolicy updatePricingPolicy(PricingPolicyRequest request);
}
