import apiClient from './client';
import { ApiResponse, Truck, CreateTruckRequest, UpdateTruckRequest } from '../types';

export const truckApi = {
  getTrucks: async (params?: { warehouseId?: number; status?: string; keyword?: string }) => {
    const res = await apiClient.get<ApiResponse<Truck[]>>('/trucks', { params });
    return res.data;
  },

  getTruckById: async (id: number) => {
    const res = await apiClient.get<ApiResponse<Truck>>(`/trucks/${id}`);
    return res.data;
  },

  createTruck: async (data: CreateTruckRequest) => {
    const res = await apiClient.post<ApiResponse<Truck>>('/trucks', data);
    return res.data;
  },

  updateTruck: async (id: number, data: UpdateTruckRequest) => {
    const res = await apiClient.put<ApiResponse<Truck>>(`/trucks/${id}`, data);
    return res.data;
  },

  deleteTruck: async (id: number) => {
    const res = await apiClient.delete<ApiResponse<void>>(`/trucks/${id}`);
    return res.data;
  },

  assignDriver: async (id: number, driverId: number) => {
    const res = await apiClient.post<ApiResponse<Truck>>(`/trucks/${id}/assign-driver`, { driverId });
    return res.data;
  },

  updateStatus: async (id: number, status: string) => {
    const res = await apiClient.put<ApiResponse<Truck>>(`/trucks/${id}/status`, { status });
    return res.data;
  },

  getTruckDrivers: async () => {
    const res = await apiClient.get<ApiResponse<Array<{ id: number; username: string; fullName: string; phoneNumber: string; postOfficeName?: string }>>>('/trucks/drivers');
    return res.data;
  }
};
