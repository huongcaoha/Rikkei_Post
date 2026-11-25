import apiClient from './client';
import { ApiResponse, NetworkTopologyResponse } from '../types';

export const networkApi = {
  // Lấy dữ liệu topology toàn bộ mạng lưới kho bưu cục, các liên kết và xe tải
  getNetworkTopology: async (): Promise<ApiResponse<NetworkTopologyResponse>> => {
    const res = await apiClient.get<ApiResponse<NetworkTopologyResponse>>('/network/topology');
    return res.data;
  }
};
