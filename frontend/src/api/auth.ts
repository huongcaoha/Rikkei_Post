import apiClient from './client';
import { ApiResponse, AuthResponse, User } from '../types';

export const authApi = {
  login: async (identifier: string, password: string): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/login', { identifier, password });
    return res.data.data;
  },

  register: async (data: {
    username: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    email: string;
    roles?: string[];
  }): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/register', data);
    return res.data.data;
  },

  verifyOtp: async (email: string, otp: string): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/verify-otp', { email, otp });
    return res.data.data;
  },

  resendOtp: async (email: string): Promise<void> => {
    await apiClient.post('/auth/resend-otp', { email });
  },

  loginOAuth2: async (accessToken: string, type: string): Promise<AuthResponse> => {
    const res = await apiClient.post('/auth/oauth2', { accessToken, type });
    return res.data.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await apiClient.get<ApiResponse<AuthResponse>>('/auth/me');
    const d = res.data.data;
    return {
      id: d.userId || (d as any).id,
      username: d.username,
      fullName: d.fullName,
      phoneNumber: d.phoneNumber,
      email: d.email,
      managedProvinceId: d.managedProvinceId,
      managedProvinceName: d.managedProvinceName,
      assignedPostOfficeId: d.assignedPostOfficeId,
      postOfficeName: d.postOfficeName,
      roles: Array.isArray(d.roles) ? d.roles : Array.from(d.roles || []),
    };
  },
};
