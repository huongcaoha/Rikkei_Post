import apiClient from './client';
import { ShipmentManifest, CreateManifestRequest } from '../types';

export const tmsApi = {
  getAllManifests: async (): Promise<ShipmentManifest[]> => {
    const res = await apiClient.get('/tms/manifests');
    return res.data.data;
  },

  getManifestsByHub: async (hubId: number): Promise<ShipmentManifest[]> => {
    const res = await apiClient.get(`/tms/manifests/hub/${hubId}`);
    return res.data.data;
  },

  getManifestById: async (id: number): Promise<ShipmentManifest> => {
    const res = await apiClient.get(`/tms/manifests/${id}`);
    return res.data.data;
  },

  getManifestByCode: async (code: string): Promise<ShipmentManifest> => {
    const res = await apiClient.get(`/tms/manifests/code/${code}`);
    return res.data.data;
  },

  createManifest: async (data: CreateManifestRequest): Promise<ShipmentManifest> => {
    const res = await apiClient.post('/tms/manifests', data);
    return res.data.data;
  },

  loadBag: async (manifestId: number, bagCode: string): Promise<ShipmentManifest> => {
    const res = await apiClient.post(`/tms/manifests/${manifestId}/load-bag`, { bagCode });
    return res.data.data;
  },

  removeBag: async (manifestId: number, bagCode: string): Promise<ShipmentManifest> => {
    const res = await apiClient.delete(`/tms/manifests/${manifestId}/bags/${bagCode}`);
    return res.data.data;
  },

  dispatch: async (manifestId: number): Promise<ShipmentManifest> => {
    const res = await apiClient.post(`/tms/manifests/${manifestId}/dispatch`);
    return res.data.data;
  },

  arrive: async (manifestId: number): Promise<ShipmentManifest> => {
    const res = await apiClient.post(`/tms/manifests/${manifestId}/arrive`);
    return res.data.data;
  },

  complete: async (manifestId: number): Promise<ShipmentManifest> => {
    const res = await apiClient.post(`/tms/manifests/${manifestId}/complete`);
    return res.data.data;
  },
};
