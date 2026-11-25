import apiClient from './client';

export interface CreateVoucherRequest {
  voucherType: 'RECEIPT' | 'PAYMENT';
  category: string;
  amount: number;
  title?: string;
  description?: string;
  proofAttachmentUrl?: string;
  warehouseId?: number;
}

export interface ApproveVoucherRequest {
  disbursementMethod?: string;
  notes?: string;
}

export interface RejectVoucherRequest {
  rejectionReason: string;
}

export interface PaymentVoucherDTO {
  id: number;
  voucherCode: string;
  voucherType: 'RECEIPT' | 'PAYMENT';
  category: string;
  amount: number;
  title: string;
  description?: string;
  proofAttachmentUrl?: string;
  createdByUserId: number;
  createdByUserName: string;
  createdByUserRole: string;
  warehouseId?: number;
  warehouseName?: string;
  provinceId?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedByUserId?: number;
  approvedByUserName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  disbursementMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export const voucherApi = {
  createVoucher: async (data: CreateVoucherRequest): Promise<PaymentVoucherDTO> => {
    const res = await apiClient.post('/vouchers', data);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  getMyVouchers: async (params?: { voucherType?: string; status?: string; startDate?: string; endDate?: string }): Promise<PaymentVoucherDTO[]> => {
    const res = await apiClient.get('/vouchers/my', { params });
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  getAllVouchers: async (params?: { voucherType?: string; status?: string; warehouseId?: number; startDate?: string; endDate?: string }): Promise<PaymentVoucherDTO[]> => {
    const res = await apiClient.get('/vouchers/all', { params });
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  getVoucherById: async (id: number): Promise<PaymentVoucherDTO> => {
    const res = await apiClient.get(`/vouchers/${id}`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  approveVoucher: async (id: number, data?: ApproveVoucherRequest): Promise<PaymentVoucherDTO> => {
    const res = await apiClient.put(`/vouchers/${id}/approve`, data);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  rejectVoucher: async (id: number, data: RejectVoucherRequest): Promise<PaymentVoucherDTO> => {
    const res = await apiClient.put(`/vouchers/${id}/reject`, data);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },
};

export type PaymentVoucher = PaymentVoucherDTO;
export const paymentVoucherApi = voucherApi;
