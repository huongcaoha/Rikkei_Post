import apiClient from './client';
import { DeliveryRoute } from '../types';

export const routeApi = {
  getRoutes: async (provinceId?: number, postOfficeId?: number, shipperId?: number, routeType?: string): Promise<DeliveryRoute[]> => {
    const params: any = {};
    if (provinceId) params.provinceId = provinceId;
    if (postOfficeId) params.postOfficeId = postOfficeId;
    if (shipperId) params.shipperId = shipperId;
    if (routeType && routeType !== 'ALL') params.routeType = routeType;
    const res = await apiClient.get('/routes', { params });
    return res.data.data;
  },

  getRouteById: async (id: number): Promise<DeliveryRoute> => {
    const res = await apiClient.get(`/routes/${id}`);
    return res.data.data;
  },

  createRoute: async (data: Partial<DeliveryRoute>): Promise<DeliveryRoute> => {
    const res = await apiClient.post('/routes', data);
    return res.data.data;
  },

  updateRoute: async (id: number, data: Partial<DeliveryRoute>): Promise<DeliveryRoute> => {
    const res = await apiClient.put(`/routes/${id}`, data);
    return res.data.data;
  },

  deleteRoute: async (id: number): Promise<void> => {
    await apiClient.delete(`/routes/${id}`);
  },

  assignShipper: async (routeId: number, shipperId: number): Promise<DeliveryRoute> => {
    const res = await apiClient.put(`/routes/${routeId}/assign-shipper?shipperId=${shipperId}`);
    return res.data.data;
  },
};
