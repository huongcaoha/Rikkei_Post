import apiClient from './client';

export interface EcommerceChannelDTO {
  id: number;
  userId: number;
  platform: 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'TIKI' | 'CUSTOM';
  channelName: string;
  shopId?: string;
  apiKey: string;
  apiSecret?: string;
  webhookUrl?: string;
  status: 'ACTIVE' | 'PAUSED';
  totalOrdersSynced: number;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateChannelPayload {
  platform: string;
  channelName: string;
  shopId?: string;
  webhookUrl?: string;
}

export interface SyncOrderSamplePayload {
  ecommerceOrderId: string;
  platform?: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderProvinceId: number;
  senderDistrictId?: number;
  senderWardName?: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverProvinceId: number;
  receiverDistrictId?: number;
  receiverWardName: string;
  itemName: string;
  itemValue?: number;
  actualWeightGram: number;
  codAmount?: number;
  notes?: string;
}

export const ecommerceApi = {
  getChannels: async (): Promise<EcommerceChannelDTO[]> => {
    const res = await apiClient.get('/ecommerce/channels');
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  createChannel: async (data: CreateChannelPayload): Promise<EcommerceChannelDTO> => {
    const res = await apiClient.post('/ecommerce/channels', data);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  regenerateApiKey: async (id: number): Promise<EcommerceChannelDTO> => {
    const res = await apiClient.post(`/ecommerce/channels/${id}/regenerate-key`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  toggleChannelStatus: async (id: number): Promise<EcommerceChannelDTO> => {
    const res = await apiClient.put(`/ecommerce/channels/${id}/toggle-status`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  deleteChannel: async (id: number): Promise<void> => {
    await apiClient.delete(`/ecommerce/channels/${id}`);
  },

  testPing: async (): Promise<any> => {
    const res = await apiClient.get('/ecommerce/open/ping');
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  testCreateOrder: async (apiKey: string, payload: SyncOrderSamplePayload): Promise<any> => {
    const res = await apiClient.post('/ecommerce/open/orders/create', payload, {
      headers: {
        'X-API-KEY': apiKey,
      },
    });
    return res.data?.data !== undefined ? res.data.data : res.data;
  },
};
