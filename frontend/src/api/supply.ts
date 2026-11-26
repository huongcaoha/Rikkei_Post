import apiClient from './client';
import {
  SupplyWarehouse,
  SupplyItem,
  SupplyInventoryDetail,
  SupplyTicket,
  EquipmentRecallTicket,
  SupplyDashboardStats,
  ApiResponse
} from '../types';

export const supplyApi = {
  // Dashboard
  getDashboardStats: async (): Promise<ApiResponse<SupplyDashboardStats>> => {
    const res = await apiClient.get<ApiResponse<SupplyDashboardStats>>('/supplies/dashboard/stats');
    return res.data;
  },

  // Kho vật tư
  getWarehouses: async (): Promise<ApiResponse<SupplyWarehouse[]>> => {
    const res = await apiClient.get<ApiResponse<SupplyWarehouse[]>>('/supplies/warehouses');
    return res.data;
  },

  getWarehouseById: async (id: number): Promise<ApiResponse<SupplyWarehouse>> => {
    const res = await apiClient.get<ApiResponse<SupplyWarehouse>>(`/supplies/warehouses/${id}`);
    return res.data;
  },

  createWarehouse: async (data: Partial<SupplyWarehouse>): Promise<ApiResponse<SupplyWarehouse>> => {
    const res = await apiClient.post<ApiResponse<SupplyWarehouse>>('/supplies/warehouses', data);
    return res.data;
  },

  updateWarehouse: async (id: number, data: Partial<SupplyWarehouse>): Promise<ApiResponse<SupplyWarehouse>> => {
    const res = await apiClient.put<ApiResponse<SupplyWarehouse>>(`/supplies/warehouses/${id}`, data);
    return res.data;
  },

  deleteWarehouse: async (id: number): Promise<ApiResponse<void>> => {
    const res = await apiClient.delete<ApiResponse<void>>(`/supplies/warehouses/${id}`);
    return res.data;
  },

  // Danh mục vật tư
  getItems: async (category?: string): Promise<ApiResponse<SupplyItem[]>> => {
    const res = await apiClient.get<ApiResponse<SupplyItem[]>>('/supplies/items', {
      params: category && category !== 'ALL' ? { category } : {}
    });
    return res.data;
  },

  getItemById: async (id: number): Promise<ApiResponse<SupplyItem>> => {
    const res = await apiClient.get<ApiResponse<SupplyItem>>(`/supplies/items/${id}`);
    return res.data;
  },

  createItem: async (data: Partial<SupplyItem>): Promise<ApiResponse<SupplyItem>> => {
    const res = await apiClient.post<ApiResponse<SupplyItem>>('/supplies/items', data);
    return res.data;
  },

  updateItem: async (id: number, data: Partial<SupplyItem>): Promise<ApiResponse<SupplyItem>> => {
    const res = await apiClient.put<ApiResponse<SupplyItem>>(`/supplies/items/${id}`, data);
    return res.data;
  },

  // Tồn kho
  getInventories: async (params?: { warehouseId?: number; category?: string }): Promise<ApiResponse<SupplyInventoryDetail[]>> => {
    const res = await apiClient.get<ApiResponse<SupplyInventoryDetail[]>>('/supplies/inventories', { params });
    return res.data;
  },

  updateStock: async (data: { warehouseId: number; itemId: number; quantity: number; damagedQuantity?: number }): Promise<ApiResponse<any>> => {
    const res = await apiClient.put<ApiResponse<any>>('/supplies/inventories', data);
    return res.data;
  },

  // Phiếu xuất nhập kho
  getTickets: async (params?: { ticketType?: string; warehouseId?: number }): Promise<ApiResponse<SupplyTicket[]>> => {
    const res = await apiClient.get<ApiResponse<SupplyTicket[]>>('/supplies/tickets', { params });
    return res.data;
  },

  getTicketById: async (id: number): Promise<ApiResponse<SupplyTicket>> => {
    const res = await apiClient.get<ApiResponse<SupplyTicket>>(`/supplies/tickets/${id}`);
    return res.data;
  },

  createTicket: async (data: any): Promise<ApiResponse<SupplyTicket>> => {
    const res = await apiClient.post<ApiResponse<SupplyTicket>>('/supplies/tickets', data);
    return res.data;
  },

  // Phiếu thu hồi đồ hỏng
  getRecalls: async (params?: { status?: string; postOfficeId?: number }): Promise<ApiResponse<EquipmentRecallTicket[]>> => {
    const res = await apiClient.get<ApiResponse<EquipmentRecallTicket[]>>('/supplies/recalls', { params });
    return res.data;
  },

  getRecallById: async (id: number): Promise<ApiResponse<EquipmentRecallTicket>> => {
    const res = await apiClient.get<ApiResponse<EquipmentRecallTicket>>(`/supplies/recalls/${id}`);
    return res.data;
  },

  createRecall: async (data: any): Promise<ApiResponse<EquipmentRecallTicket>> => {
    const res = await apiClient.post<ApiResponse<EquipmentRecallTicket>>('/supplies/recalls', data);
    return res.data;
  },

  resolveRecall: async (id: number, data: { resolutionNotes: string }): Promise<ApiResponse<EquipmentRecallTicket>> => {
    const res = await apiClient.post<ApiResponse<EquipmentRecallTicket>>(`/supplies/recalls/${id}/resolve`, data);
    return res.data;
  }
};
