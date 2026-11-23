import apiClient from './client';
import { PriceEstimate } from '../types';

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
};
