import apiClient from './client';
import { CreateOrderRequest, Order, DashboardStats, OrderTrackingLog, MerchantAddress } from '../types';

export const orderApi = {
  createOrder: async (data: CreateOrderRequest): Promise<Order> => {
    const res = await apiClient.post('/orders', data);
    return res.data.data;
  },

  getDefaultSenderAddress: async (): Promise<MerchantAddress | null> => {
    const res = await apiClient.get('/orders/default-sender-address');
    return res.data.data;
  },

  saveDefaultSenderAddress: async (data: MerchantAddress): Promise<MerchantAddress> => {
    const res = await apiClient.post('/orders/default-sender-address', data);
    return res.data.data;
  },

  createBatchOrders: async (orders: CreateOrderRequest[]): Promise<any> => {
    const res = await apiClient.post('/orders/batch', { orders });
    return res.data.data;
  },

  getMyOrders: async (page = 0, size = 10, status?: string): Promise<{ content: Order[]; totalElements: number; totalPages: number }> => {
    const params: any = { page, size };
    if (status && status !== 'ALL') {
      params.status = status;
    }
    const res = await apiClient.get('/orders/merchant/my-orders', { params });
    return res.data.data;
  },

  getDashboardStats: async (startDate?: string, endDate?: string): Promise<DashboardStats> => {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await apiClient.get('/orders/merchant/dashboard-stats', { params });
    return res.data.data;
  },

  getOrderByTrackingCode: async (trackingCode: string): Promise<Order> => {
    const res = await apiClient.get(`/orders/${trackingCode}`);
    return res.data.data;
  },

  trackOrderPublic: async (trackingCode: string): Promise<{ order: Order; timeline: OrderTrackingLog[]; routeWaypoints?: any[] }> => {
    const res = await apiClient.get(`/orders/track/${trackingCode}`);
    return res.data.data;
  },
};
