import apiClient from './client';
import { ApiResponse } from '../types';

export interface RoleItem {
  id: number;
  roleName: string;
  description: string;
}

export const roleApi = {
  getAllRoles: async (): Promise<ApiResponse<RoleItem[]>> => {
    const res = await apiClient.get<ApiResponse<RoleItem[]>>('/roles');
    return res.data;
  },

  createRole: async (data: { roleName: string; description: string }): Promise<ApiResponse<RoleItem>> => {
    const res = await apiClient.post<ApiResponse<RoleItem>>('/roles', data);
    return res.data;
  },

  updateRole: async (id: number, data: { description: string }): Promise<ApiResponse<RoleItem>> => {
    const res = await apiClient.put<ApiResponse<RoleItem>>(`/roles/${id}`, data);
    return res.data;
  },

  deleteRole: async (id: number): Promise<ApiResponse<void>> => {
    const res = await apiClient.delete<ApiResponse<void>>(`/roles/${id}`);
    return res.data;
  },
};
