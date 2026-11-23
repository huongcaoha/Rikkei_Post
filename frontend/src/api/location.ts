import api from './client';
import { ApiResponse, Province, Ward, Warehouse } from '../types';

export const locationApi = {
  // Lấy danh sách toàn bộ 63 Tỉnh / Thành phố
  getProvinces: async (): Promise<Province[]> => {
    const res = await api.get<ApiResponse<Province[]>>('/locations/provinces');
    return res.data.data;
  },

  // Lấy danh sách Xã / Phường theo Tỉnh / Thành phố
  getWardsByProvince: async (provinceId: number): Promise<Ward[]> => {
    const res = await api.get<ApiResponse<Ward[]>>(`/locations/provinces/${provinceId}/wards`);
    return res.data.data;
  },

  // Tìm kiếm Xã / Phường theo từ khóa
  searchWards: async (provinceId?: number, keyword?: string): Promise<Ward[]> => {
    const res = await api.get<ApiResponse<Ward[]>>('/locations/wards/search', {
      params: { provinceId, keyword },
    });
    return res.data.data;
  },

  // Lấy danh sách Bưu cục / Kho vận theo Tỉnh/TP
  getWarehouses: async (provinceId?: number): Promise<Warehouse[]> => {
    const res = await api.get<ApiResponse<Warehouse[]>>('/locations/warehouses', {
      params: provinceId ? { provinceId } : {},
    });
    return res.data.data;
  },
};
