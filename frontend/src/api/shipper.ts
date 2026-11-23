import apiClient from './client';
import { Order, ShipperSummary } from '../types';

export const shipperApi = {
  getMyTasks: async (taskType?: string): Promise<Order[]> => {
    const params: any = {};
    if (taskType) params.taskType = taskType;
    const res = await apiClient.get('/shipper/tasks', { params });
    return res.data.data;
  },

  getSummary: async (): Promise<ShipperSummary> => {
    const res = await apiClient.get('/shipper/summary');
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

  updateStatus: async (trackingCode: string, status: string, note?: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/update-status', { trackingCode, status, note });
    return res.data.data;
  },
};
