import api from './client';
import { ApiResponse, VrpOptimizeResult } from '../types';

export interface AiChatResponsePayload {
  reply: string;
  detectedIntent: string;
  structuredData?: any;
  suggestions?: string[];
}

export interface PredictEtaPayload {
  estimatedDeliveryAt: string;
  minHours: number;
  maxHours: number;
  transitDescription: string;
  confidenceLevel: string;
}

export const aiApi = {
  chat: (message: string, history?: Array<{ role: string; content: string }>) =>
    api.post<ApiResponse<AiChatResponsePayload>>('/ai/chat', { message, history }),

  optimizeRoute: (data: {
    trackingCodes?: string[];
    startLat?: number;
    startLng?: number;
    startAddress?: string;
    shipperId?: number;
    applyToShipper?: boolean;
  }) => api.post<ApiResponse<VrpOptimizeResult>>('/ai/vrp/optimize', data),

  optimizeShipperRoute: (shipperId: number, lat?: number, lng?: number, applySequence: boolean = true) =>
    api.post<ApiResponse<VrpOptimizeResult>>(`/ai/vrp/shipper/${shipperId}/optimize`, null, {
      params: { lat, lng, applySequence },
    }),

  predictEta: (senderProvinceId: number, receiverProvinceId: number, serviceType: string = 'STANDARD', distanceKm?: number) =>
    api.post<ApiResponse<PredictEtaPayload>>('/ai/predict-eta', {
      senderProvinceId,
      receiverProvinceId,
      serviceType,
      distanceKm,
    }),
};
