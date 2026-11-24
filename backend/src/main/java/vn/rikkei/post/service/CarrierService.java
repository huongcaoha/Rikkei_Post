package vn.rikkei.post.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vn.rikkei.post.dto.carrier.*;

import java.util.List;

public interface CarrierService {

    CarrierPartnerResponse createPartner(CarrierPartnerRequest request);

    CarrierPartnerResponse updatePartner(Long id, CarrierPartnerRequest request);

    List<CarrierPartnerResponse> getAllPartners(String status);

    CarrierPartnerResponse getPartnerById(Long id);

    void deletePartner(Long id);

    CarrierTripResponse createTrip(CarrierTripRequest request);

    CarrierTripResponse updateTripStatus(Long tripId, UpdateTripStatusRequest request);

    Page<CarrierTripResponse> getTrips(String status, Pageable pageable);

    List<CarrierTripResponse> getTripsByCarrier(Long carrierId);
}
