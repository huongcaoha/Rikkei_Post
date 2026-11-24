package vn.rikkei.post.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.rikkei.post.dto.carrier.*;
import vn.rikkei.post.entity.CarrierPartner;
import vn.rikkei.post.entity.CarrierTrip;
import vn.rikkei.post.entity.Warehouse;
import vn.rikkei.post.repository.CarrierPartnerRepository;
import vn.rikkei.post.repository.CarrierTripRepository;
import vn.rikkei.post.repository.WarehouseRepository;
import vn.rikkei.post.service.CarrierService;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Random;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CarrierServiceImpl implements CarrierService {

    private final CarrierPartnerRepository carrierRepository;
    private final CarrierTripRepository tripRepository;
    private final WarehouseRepository warehouseRepository;

    @Override
    @Transactional
    public CarrierPartnerResponse createPartner(CarrierPartnerRequest request) {
        if (carrierRepository.findByPartnerCode(request.getPartnerCode()).isPresent()) {
            throw new IllegalArgumentException("Mã đối tác " + request.getPartnerCode() + " đã tồn tại trên hệ thống!");
        }

        CarrierPartner partner = CarrierPartner.builder()
                .partnerCode(request.getPartnerCode())
                .companyName(request.getCompanyName())
                .contactPerson(request.getContactPerson())
                .contactPhone(request.getContactPhone())
                .email(request.getEmail())
                .vehicleFleetCount(request.getVehicleFleetCount() != null ? request.getVehicleFleetCount() : 5)
                .routesOperated(request.getRoutesOperated())
                .contractPricePerKm(request.getContractPricePerKm() != null ? request.getContractPricePerKm() : new BigDecimal("12000.00"))
                .onTimeDeliveryRate(request.getOnTimeDeliveryRate() != null ? request.getOnTimeDeliveryRate() : 98.0)
                .slaScore(request.getSlaScore() != null ? request.getSlaScore() : 4.8)
                .status(request.getStatus() != null ? request.getStatus() : "ACTIVE")
                .notes(request.getNotes())
                .build();

        CarrierPartner saved = carrierRepository.save(partner);
        log.info("Đã tạo đối tác vận tải mới: {} ({})", saved.getCompanyName(), saved.getPartnerCode());
        return mapToPartnerResponse(saved);
    }

    @Override
    @Transactional
    public CarrierPartnerResponse updatePartner(Long id, CarrierPartnerRequest request) {
        CarrierPartner partner = carrierRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đối tác với ID: " + id));

        partner.setCompanyName(request.getCompanyName());
        partner.setContactPerson(request.getContactPerson());
        partner.setContactPhone(request.getContactPhone());
        partner.setEmail(request.getEmail());
        if (request.getVehicleFleetCount() != null) partner.setVehicleFleetCount(request.getVehicleFleetCount());
        if (request.getRoutesOperated() != null) partner.setRoutesOperated(request.getRoutesOperated());
        if (request.getContractPricePerKm() != null) partner.setContractPricePerKm(request.getContractPricePerKm());
        if (request.getOnTimeDeliveryRate() != null) partner.setOnTimeDeliveryRate(request.getOnTimeDeliveryRate());
        if (request.getSlaScore() != null) partner.setSlaScore(request.getSlaScore());
        if (request.getStatus() != null) partner.setStatus(request.getStatus());
        if (request.getNotes() != null) partner.setNotes(request.getNotes());

        CarrierPartner updated = carrierRepository.save(partner);
        return mapToPartnerResponse(updated);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CarrierPartnerResponse> getAllPartners(String status) {
        List<CarrierPartner> list;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            list = carrierRepository.findByStatus(status);
        } else {
            list = carrierRepository.findAll();
        }
        return list.stream().map(this::mapToPartnerResponse).collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CarrierPartnerResponse getPartnerById(Long id) {
        CarrierPartner partner = carrierRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đối tác với ID: " + id));
        return mapToPartnerResponse(partner);
    }

    @Override
    @Transactional
    public void deletePartner(Long id) {
        carrierRepository.deleteById(id);
    }

    @Override
    @Transactional
    public CarrierTripResponse createTrip(CarrierTripRequest request) {
        CarrierPartner partner = carrierRepository.findById(request.getCarrierId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy đối tác vận tải ID: " + request.getCarrierId()));

        Warehouse sourceHub = warehouseRepository.findById(request.getSourceHubId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho xuất phát ID: " + request.getSourceHubId()));

        Warehouse destHub = warehouseRepository.findById(request.getDestinationHubId())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy kho đích ID: " + request.getDestinationHubId()));

        String datePart = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String randomSuffix = String.format("%04d", new Random().nextInt(10000));
        String tripCode = "TRIP-" + datePart + "-" + randomSuffix;

        BigDecimal tripCost = request.getTripCost();
        if (tripCost == null || tripCost.compareTo(BigDecimal.ZERO) == 0) {
            if (request.getDistanceKm() != null && partner.getContractPricePerKm() != null) {
                tripCost = partner.getContractPricePerKm().multiply(BigDecimal.valueOf(request.getDistanceKm()));
            } else {
                tripCost = BigDecimal.ZERO;
            }
        }

        CarrierTrip trip = CarrierTrip.builder()
                .tripCode(tripCode)
                .carrierId(partner.getId())
                .carrierName(partner.getCompanyName())
                .manifestCode(request.getManifestCode())
                .sourceHubId(sourceHub.getId())
                .sourceHubName(sourceHub.getName())
                .destinationHubId(destHub.getId())
                .destinationHubName(destHub.getName())
                .driverName(request.getDriverName())
                .driverPhone(request.getDriverPhone())
                .licensePlate(request.getLicensePlate())
                .distanceKm(request.getDistanceKm() != null ? request.getDistanceKm() : 100.0)
                .tripCost(tripCost)
                .departureTime(request.getDepartureTime() != null ? request.getDepartureTime() : LocalDateTime.now())
                .estimatedArrivalTime(request.getEstimatedArrivalTime() != null ? request.getEstimatedArrivalTime() : LocalDateTime.now().plusHours(4))
                .status("IN_TRANSIT")
                .slaCompliant(true)
                .build();

        CarrierTrip saved = tripRepository.save(trip);
        log.info("Đã điều phối chuyến xe 3PL #{}: {} -> {} (Nhà xe: {})", tripCode, sourceHub.getName(), destHub.getName(), partner.getCompanyName());
        return mapToTripResponse(saved);
    }

    @Override
    @Transactional
    public CarrierTripResponse updateTripStatus(Long tripId, UpdateTripStatusRequest request) {
        CarrierTrip trip = tripRepository.findById(tripId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy chuyến xe ID: " + tripId));

        if (request.getStatus() != null) {
            trip.setStatus(request.getStatus());
        }

        LocalDateTime arrivalTime = request.getActualArrivalTime() != null ? request.getActualArrivalTime() : LocalDateTime.now();
        if ("COMPLETED_ON_TIME".equalsIgnoreCase(request.getStatus()) || "DELAYED".equalsIgnoreCase(request.getStatus())) {
            trip.setActualArrivalTime(arrivalTime);

            boolean onTime = trip.getEstimatedArrivalTime() == null || !arrivalTime.isAfter(trip.getEstimatedArrivalTime());
            trip.setSlaCompliant(onTime);
            if (!onTime) {
                trip.setStatus("DELAYED");
            } else {
                trip.setStatus("COMPLETED_ON_TIME");
            }

            // Tự động tính toán lại SLA On-time delivery % cho hãng vận tải
            recalculateCarrierSla(trip.getCarrierId());
        }

        CarrierTrip updated = tripRepository.save(trip);
        return mapToTripResponse(updated);
    }

    private void recalculateCarrierSla(Long carrierId) {
        List<CarrierTrip> trips = tripRepository.findByCarrierId(carrierId);
        List<CarrierTrip> finishedTrips = trips.stream()
                .filter(t -> "COMPLETED_ON_TIME".equalsIgnoreCase(t.getStatus()) || "DELAYED".equalsIgnoreCase(t.getStatus()))
                .collect(Collectors.toList());

        if (!finishedTrips.isEmpty()) {
            long onTimeCount = finishedTrips.stream().filter(t -> Boolean.TRUE.equals(t.getSlaCompliant())).count();
            double onTimeRate = (double) onTimeCount * 100.0 / finishedTrips.size();
            double roundedRate = Math.round(onTimeRate * 10.0) / 10.0;
            double slaScore = Math.round((onTimeRate / 20.0) * 10.0) / 10.0; // thang điểm 5

            carrierRepository.findById(carrierId).ifPresent(carrier -> {
                carrier.setOnTimeDeliveryRate(roundedRate);
                carrier.setSlaScore(Math.min(5.0, slaScore));
                carrierRepository.save(carrier);
                log.info("Cập nhật chỉ số SLA đối tác {}: {}% On-time, Đánh giá: {}/5.0", carrier.getCompanyName(), roundedRate, slaScore);
            });
        }
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CarrierTripResponse> getTrips(String status, Pageable pageable) {
        Page<CarrierTrip> page;
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            page = tripRepository.findByStatusOrderByCreatedAtDesc(status, pageable);
        } else {
            page = tripRepository.findAll(pageable);
        }
        return page.map(this::mapToTripResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CarrierTripResponse> getTripsByCarrier(Long carrierId) {
        return tripRepository.findByCarrierId(carrierId).stream()
                .map(this::mapToTripResponse)
                .collect(Collectors.toList());
    }

    private CarrierPartnerResponse mapToPartnerResponse(CarrierPartner p) {
        return CarrierPartnerResponse.builder()
                .id(p.getId())
                .partnerCode(p.getPartnerCode())
                .companyName(p.getCompanyName())
                .contactPerson(p.getContactPerson())
                .contactPhone(p.getContactPhone())
                .email(p.getEmail())
                .vehicleFleetCount(p.getVehicleFleetCount())
                .routesOperated(p.getRoutesOperated())
                .contractPricePerKm(p.getContractPricePerKm())
                .onTimeDeliveryRate(p.getOnTimeDeliveryRate())
                .slaScore(p.getSlaScore())
                .status(p.getStatus())
                .notes(p.getNotes())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }

    private CarrierTripResponse mapToTripResponse(CarrierTrip t) {
        return CarrierTripResponse.builder()
                .id(t.getId())
                .tripCode(t.getTripCode())
                .carrierId(t.getCarrierId())
                .carrierName(t.getCarrierName())
                .manifestCode(t.getManifestCode())
                .sourceHubId(t.getSourceHubId())
                .sourceHubName(t.getSourceHubName())
                .destinationHubId(t.getDestinationHubId())
                .destinationHubName(t.getDestinationHubName())
                .driverName(t.getDriverName())
                .driverPhone(t.getDriverPhone())
                .licensePlate(t.getLicensePlate())
                .distanceKm(t.getDistanceKm())
                .tripCost(t.getTripCost())
                .departureTime(t.getDepartureTime())
                .estimatedArrivalTime(t.getEstimatedArrivalTime())
                .actualArrivalTime(t.getActualArrivalTime())
                .status(t.getStatus())
                .slaCompliant(t.getSlaCompliant())
                .createdAt(t.getCreatedAt())
                .build();
    }
}
