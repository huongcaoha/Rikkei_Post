import apiClient from './client';
import { Order, ShipperSummary } from '../types';

export const shipperApi = {
  getMyTasks: async (category?: string, startDate?: string, endDate?: string, shipperId?: number): Promise<Order[]> => {
    const params: any = {};
    if (category) params.category = category;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (shipperId) params.shipperId = shipperId;
    const res = await apiClient.get('/shipper/tasks', { params });
    return res.data.data;
  },

  getSummary: async (startDate?: string, endDate?: string, shipperId?: number): Promise<ShipperSummary> => {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (shipperId) params.shipperId = shipperId;
    const res = await apiClient.get('/shipper/summary', { params });
    return res.data.data;
  },

  getPostOfficeShippers: async (): Promise<Array<{ id: number; fullName: string; phoneNumber?: string; username: string }>> => {
    const res = await apiClient.get('/shipper/post-office-shippers');
    return res.data.data;
  },

  scanPickup: async (trackingCode: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-pickup', { trackingCode });
    return res.data.data;
  },

  scanInbound: async (trackingCode: string, warehouseId?: number): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-inbound', { trackingCode, warehouseId });
    return res.data.data;
  },

  scanDelivery: async (trackingCode: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-delivery', { trackingCode });
    return res.data.data;
  },

  scanReturn: async (trackingCode: string, reason?: string, note?: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-return', { trackingCode, reason, note });
    return res.data.data;
  },

  updateStatus: async (trackingCode: string, status: string, note?: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/update-status', { trackingCode, status, note });
    return res.data.data;
  },
};
