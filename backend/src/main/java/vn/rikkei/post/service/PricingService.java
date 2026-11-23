package vn.rikkei.post.service;

import vn.rikkei.post.dto.pricing.CalculatePriceRequest;
import vn.rikkei.post.dto.pricing.PriceEstimateResponse;
import vn.rikkei.post.entity.PricingMatrix;

import java.util.List;

public interface PricingService {
    PriceEstimateResponse calculatePrice(CalculatePriceRequest request);
    String determineZone(Integer senderProvinceId, Integer receiverProvinceId);
    List<PricingMatrix> getAllActivePricing();
}
