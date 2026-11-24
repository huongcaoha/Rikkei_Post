package vn.rikkei.post.service;

import vn.rikkei.post.dto.ai.VrpOptimizeRequest;
import vn.rikkei.post.dto.ai.VrpOptimizeResponse;

public interface VrpSolverService {

    VrpOptimizeResponse optimizeRoute(VrpOptimizeRequest request);

    VrpOptimizeResponse optimizeShipperActiveOrders(Long shipperId, Double currentLat, Double currentLng, boolean applySequence);
}
