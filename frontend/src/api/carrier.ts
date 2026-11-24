import api from './client';
import { ApiResponse, CarrierPartner, CarrierTrip } from '../types';

export const carrierApi = {
  getAllPartners: (status?: string) =>
    api.get<ApiResponse<CarrierPartner[]>>('/carriers/partners', { params: status ? { status } : {} }),

  createPartner: (data: Partial<CarrierPartner>) =>
    api.post<ApiResponse<CarrierPartner>>('/carriers/partners', data),

  getPartnerById: (id: number) =>
    api.get<ApiResponse<CarrierPartner>>(`/carriers/partners/${id}`),

  updatePartner: (id: number, data: Partial<CarrierPartner>) =>
    api.put<ApiResponse<CarrierPartner>>(`/carriers/partners/${id}`, data),

  deletePartner: (id: number) =>
    api.delete<ApiResponse<void>>(`/carriers/partners/${id}`),

  createTrip: (data: {
    carrierId: number;
    manifestCode?: string;
    sourceHubId: number;
    destinationHubId: number;
    driverName?: string;
    driverPhone?: string;
    licensePlate?: string;
    distanceKm?: number;
    tripCost?: number;
    departureTime?: string;
    estimatedArrivalTime?: string;
  }) => api.post<ApiResponse<CarrierTrip>>('/carriers/trips', data),

  updateTripStatus: (tripId: number, data: { status: string; actualArrivalTime?: string; notes?: string }) =>
    api.put<ApiResponse<CarrierTrip>>(`/carriers/trips/${tripId}/status`, data),

  getTrips: (params?: { status?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<{ content: CarrierTrip[]; totalElements: number; totalPages: number }>>('/carriers/trips', { params }),

  getTripsByCarrier: (carrierId: number) =>
    api.get<ApiResponse<CarrierTrip[]>>(`/carriers/partners/${carrierId}/trips`),
};
