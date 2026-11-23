import api from './client';
import { ApiResponse, Province, Ward, Warehouse } from '../types';

export interface WarehouseRequest {
  code: string;
  name: string;
  type: string;
  provinceId: number;
  districtId?: number;
  address: string;
  latitude: number;
  longitude: number;
  capacityPackages?: number;
  isActive?: boolean;
}

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

  // Lấy danh sách Bưu cục / Kho vận theo Tỉnh/TP (chỉ kho đang active)
  getWarehouses: async (provinceId?: number): Promise<Warehouse[]> => {
    const res = await api.get<ApiResponse<Warehouse[]>>('/locations/warehouses', {
      params: provinceId ? { provinceId } : {},
    });
    return res.data.data;
  },

  // Lấy toàn bộ danh sách kho bưu cục dành cho Quản lý (Admin / Branch Manager)
  getAllWarehouses: async (): Promise<Warehouse[]> => {
    const res = await api.get<ApiResponse<Warehouse[]>>('/locations/warehouses/all');
    return res.data.data;
  },

  // Tạo kho / bưu cục mới (ROLE_ADMIN, ROLE_BRANCH_MANAGER)
  createWarehouse: async (data: WarehouseRequest): Promise<Warehouse> => {
    const res = await api.post<ApiResponse<Warehouse>>('/locations/warehouses', data);
    return res.data.data;
  },

  // Cập nhật thông tin kho / bưu cục
  updateWarehouse: async (id: number, data: WarehouseRequest): Promise<Warehouse> => {
    const res = await api.put<ApiResponse<Warehouse>>(`/locations/warehouses/${id}`, data);
    return res.data.data;
  },

  // Đổi trạng thái hoạt động của kho / bưu cục
  toggleWarehouseStatus: async (id: number): Promise<Warehouse> => {
    const res = await api.patch<ApiResponse<Warehouse>>(`/locations/warehouses/${id}/toggle-status`);
    return res.data.data;
  },
};
