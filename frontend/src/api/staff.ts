import apiClient from './client';
import { StaffUser, CreateStaffRequest, UpdateStaffRequest } from '../types';

export const staffApi = {
  getStaffList: async (role?: string, provinceId?: number, postOfficeId?: number): Promise<StaffUser[]> => {
    const params: any = {};
    if (role) params.role = role;
    if (provinceId) params.provinceId = provinceId;
    if (postOfficeId) params.postOfficeId = postOfficeId;
    const res = await apiClient.get('/management/staff', { params });
    return res.data.data;
  },

  getAssignableRoles: async (): Promise<string[]> => {
    const res = await apiClient.get('/management/staff/assignable-roles');
    return res.data.data;
  },

  createStaff: async (data: CreateStaffRequest): Promise<StaffUser> => {
    const res = await apiClient.post('/management/staff', data);
    return res.data.data;
  },

  updateStaff: async (id: number, data: UpdateStaffRequest): Promise<StaffUser> => {
    const res = await apiClient.put(`/management/staff/${id}`, data);
    return res.data.data;
  },

  deleteStaff: async (id: number): Promise<void> => {
    await apiClient.delete(`/management/staff/${id}`);
  },
};
