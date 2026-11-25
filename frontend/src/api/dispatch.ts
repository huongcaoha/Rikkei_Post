import apiClient from './client';
import {
  ApiResponse,
  DispatchOrder,
  CreateDispatchOrderRequest,
  UpdateDispatchOrderRequest,
  UpdateDispatchStatusRequest,
  MasterBag
} from '../types';

export interface DispatchFilterParams {
  originWarehouseId?: number;
  destWarehouseId?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export const dispatchApi = {
  // Lấy danh sách lệnh điều vận
  getDispatchOrders: async (params?: DispatchFilterParams): Promise<ApiResponse<DispatchOrder[]>> => {
    const res = await apiClient.get<ApiResponse<DispatchOrder[]>>('/dispatch-orders', { params });
    return res.data;
  },

  // Chi tiết lệnh điều vận theo ID
  getDispatchById: async (id: number): Promise<ApiResponse<DispatchOrder>> => {
    const res = await apiClient.get<ApiResponse<DispatchOrder>>(`/dispatch-orders/${id}`);
    return res.data;
  },

  // Chi tiết lệnh điều vận theo mã
  getDispatchByCode: async (code: string): Promise<ApiResponse<DispatchOrder>> => {
    const res = await apiClient.get<ApiResponse<DispatchOrder>>(`/dispatch-orders/code/${code}`);
    return res.data;
  },

  // Tạo mới lệnh điều vận
  createDispatchOrder: async (data: CreateDispatchOrderRequest): Promise<ApiResponse<DispatchOrder>> => {
    const res = await apiClient.post<ApiResponse<DispatchOrder>>('/dispatch-orders', data);
    return res.data;
  },

  // Cập nhật lệnh điều vận
  updateDispatchOrder: async (id: number, data: UpdateDispatchOrderRequest): Promise<ApiResponse<DispatchOrder>> => {
    const res = await apiClient.put<ApiResponse<DispatchOrder>>(`/dispatch-orders/${id}`, data);
    return res.data;
  },

  // Cập nhật trạng thái chuyến xe (PICKED_UP -> IN_TRANSIT -> COMPLETED, CANCELLED)
  updateDispatchStatus: async (id: number, data: UpdateDispatchStatusRequest): Promise<ApiResponse<DispatchOrder>> => {
    const res = await apiClient.put<ApiResponse<DispatchOrder>>(`/dispatch-orders/${id}/status`, data);
    return res.data;
  },

  // Quét tiếp nhận bao tải tại Hub đích (tự động nhập kho các đơn hàng trong bao tải)
  scanBagInbound: async (id: number, bagCode: string): Promise<ApiResponse<DispatchOrder>> => {
    const res = await apiClient.post<ApiResponse<DispatchOrder>>(`/dispatch-orders/${id}/scan-bag`, { bagCode });
    return res.data;
  },

  // Lấy danh sách bao tải sẵn sàng để điều vận tại kho xuất phát
  getAvailableBags: async (originWarehouseId: number, destWarehouseId?: number): Promise<ApiResponse<MasterBag[]>> => {
    const res = await apiClient.get<ApiResponse<MasterBag[]>>('/dispatch-orders/available-bags', {
      params: { originWarehouseId, destWarehouseId }
    });
    return res.data;
  }
};
