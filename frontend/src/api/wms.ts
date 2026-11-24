import apiClient from './client';
import { MasterBag, CreateMasterBagRequest } from '../types';

export const wmsApi = {
  getAllBags: async (): Promise<MasterBag[]> => {
    const res = await apiClient.get('/wms/bags');
    return res.data.data;
  },

  getBagsByWarehouse: async (warehouseId: number): Promise<MasterBag[]> => {
    const res = await apiClient.get(`/wms/bags/warehouse/${warehouseId}`);
    return res.data.data;
  },

  getBagById: async (id: number): Promise<MasterBag> => {
    const res = await apiClient.get(`/wms/bags/${id}`);
    return res.data.data;
  },

  getBagByCode: async (bagCode: string): Promise<MasterBag> => {
    const res = await apiClient.get(`/wms/bags/code/${bagCode}`);
    return res.data.data;
  },

  createBag: async (data: CreateMasterBagRequest): Promise<MasterBag> => {
    const res = await apiClient.post('/wms/bags', data);
    return res.data.data;
  },

  addItemToBag: async (bagId: number, trackingCode: string): Promise<MasterBag> => {
    const res = await apiClient.post(`/wms/bags/${bagId}/items`, { trackingCode });
    return res.data.data;
  },

  removeItemFromBag: async (bagId: number, trackingCode: string): Promise<MasterBag> => {
    const res = await apiClient.delete(`/wms/bags/${bagId}/items/${trackingCode}`);
    return res.data.data;
  },

  sealBag: async (bagId: number, sealNumber: string): Promise<MasterBag> => {
    const res = await apiClient.post(`/wms/bags/${bagId}/seal`, { sealNumber });
    return res.data.data;
  },

  unsealBag: async (bagId: number): Promise<MasterBag> => {
    const res = await apiClient.post(`/wms/bags/${bagId}/unseal`);
    return res.data.data;
  },
};
