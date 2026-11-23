import apiClient from './client';
import { ApiResponse, User } from '../types';

export interface UpdateProfileRequest {
  fullName: string;
  phoneNumber: string;
  email: string;
  avatarUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const userApi = {
  getProfile: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<any>>('/users/profile');
    const d = response.data.data;
    return {
      id: d.userId || d.id,
      username: d.username,
      fullName: d.fullName,
      phoneNumber: d.phoneNumber,
      email: d.email,
      managedProvinceId: d.managedProvinceId,
      managedProvinceName: d.managedProvinceName,
      assignedPostOfficeId: d.assignedPostOfficeId,
      postOfficeName: d.postOfficeName,
      roles: d.roles,
    };
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await apiClient.put<ApiResponse<any>>('/users/profile', data);
    const d = response.data.data;
    return {
      id: d.userId || d.id,
      username: d.username,
      fullName: d.fullName,
      phoneNumber: d.phoneNumber,
      email: d.email,
      managedProvinceId: d.managedProvinceId,
      managedProvinceName: d.managedProvinceName,
      assignedPostOfficeId: d.assignedPostOfficeId,
      postOfficeName: d.postOfficeName,
      roles: d.roles,
    };
  },

  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    await apiClient.put<ApiResponse<void>>('/users/change-password', data);
  },
};
