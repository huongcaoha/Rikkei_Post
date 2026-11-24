import apiClient from './client';
import { PriceEstimate, PricingMatrixItem, PricingMatrixRequest, PricingPolicy } from '../types';

export const pricingApi = {
  calculatePrice: async (data: {
    senderProvinceId: number;
    receiverProvinceId: number;
    actualWeightGram: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    itemValue?: number;
    serviceType?: string;
    pickupType?: string;
    merchantTotalOrders?: number;
  }): Promise<PriceEstimate> => {
    const res = await apiClient.post('/pricing/calculate', data);
    return res.data.data;
  },

  getActivePricing: async (): Promise<PricingMatrixItem[]> => {
    const res = await apiClient.get('/pricing/matrix');
    return res.data.data;
  },

  getAllPricingMatrices: async (): Promise<PricingMatrixItem[]> => {
    const res = await apiClient.get('/pricing/matrix/all');
    return res.data.data;
  },

  createPricingMatrix: async (data: PricingMatrixRequest): Promise<PricingMatrixItem> => {
    const res = await apiClient.post('/pricing/matrix', data);
    return res.data.data;
  },

  updatePricingMatrix: async (id: number, data: PricingMatrixRequest): Promise<PricingMatrixItem> => {
    const res = await apiClient.put(`/pricing/matrix/${id}`, data);
    return res.data.data;
  },

  deletePricingMatrix: async (id: number): Promise<void> => {
    await apiClient.delete(`/pricing/matrix/${id}`);
  },

  togglePricingMatrixActive: async (id: number): Promise<PricingMatrixItem> => {
    const res = await apiClient.patch(`/pricing/matrix/${id}/toggle-active`);
    return res.data.data;
  },

  getPricingPolicy: async (): Promise<PricingPolicy> => {
    const res = await apiClient.get('/pricing/policy');
    return res.data.data;
  },

  updatePricingPolicy: async (data: PricingPolicy): Promise<PricingPolicy> => {
    const res = await apiClient.put('/pricing/policy', data);
    return res.data.data;
  },
};
