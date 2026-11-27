import apiClient from './client';
import {
  Order,
  ShipperSummary,
  CompleteDeliveryRequest,
  CompleteReturnRequest,
  DeliveryFailureRequest,
  CashReconciliationResponse,
  CashSubmission,
} from '../types';

export const shipperApi = {
  getMyTasks: async (category?: string, startDate?: string, endDate?: string, shipperId?: number): Promise<Order[]> => {
    const params: any = {};
    if (category) params.category = category;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (shipperId) params.shipperId = shipperId;
    const res = await apiClient.get('/shipper/tasks', { params });
    return res.data.data;
  },

  getSummary: async (startDate?: string, endDate?: string, shipperId?: number): Promise<ShipperSummary> => {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (shipperId) params.shipperId = shipperId;
    const res = await apiClient.get('/shipper/summary', { params });
    return res.data.data;
  },

  getPostOfficeShippers: async (): Promise<Array<{ id: number; fullName: string; phoneNumber?: string; username: string }>> => {
    const res = await apiClient.get('/shipper/post-office-shippers');
    return res.data.data;
  },

  scanPickup: async (trackingCode: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-pickup', { trackingCode });
    return res.data.data;
  },

  scanInbound: async (trackingCode: string, warehouseId?: number): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-inbound', { trackingCode, warehouseId });
    return res.data.data;
  },

  scanDelivery: async (trackingCode: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-delivery', { trackingCode });
    return res.data.data;
  },

  scanOutboundReturn: async (trackingCode: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-outbound-return', { trackingCode });
    return res.data.data;
  },

  scanReturn: async (trackingCode: string, reason?: string, note?: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/scan-return', { trackingCode, reason, note });
    return res.data.data;
  },

  completeReturn: async (data: CompleteReturnRequest): Promise<Order> => {
    const res = await apiClient.post('/shipper/complete-return', data);
    return res.data.data;
  },

  updateStatus: async (trackingCode: string, status: string, note?: string): Promise<Order> => {
    const res = await apiClient.post('/shipper/update-status', { trackingCode, status, note });
    return res.data.data;
  },

  // Sprint 3 - US-13: Smart Dispatch
  smartDispatch: async (trackingCode: string, shipperId?: number): Promise<Order> => {
    const res = await apiClient.post('/shipper/smart-dispatch', { trackingCode, shipperId });
    return res.data.data;
  },

  smartDispatchBatch: async (postOfficeId?: number): Promise<{ totalEligible: number; successCount: number; failureCount: number; message: string }> => {
    const res = await apiClient.post('/shipper/smart-dispatch-batch', null, { params: { postOfficeId } });
    return res.data.data;
  },

  // Sprint 3 - US-16: Send Delivery OTP
  sendOtp: async (trackingCode: string): Promise<{ trackingCode: string; otpCode: string; message: string }> => {
    const res = await apiClient.post('/shipper/send-otp', { trackingCode });
    return res.data.data;
  },

  // Sprint 3 - US-15 & US-16 & US-17: Complete Delivery (POD + OTP + VietQR/Cash)
  completeDelivery: async (data: CompleteDeliveryRequest): Promise<Order> => {
    const res = await apiClient.post('/shipper/complete-delivery', data);
    return res.data.data;
  },

  // Sprint 3 - US-18: Report Delivery Failure & Reschedule / Return
  reportFailure: async (data: DeliveryFailureRequest): Promise<Order> => {
    const res = await apiClient.post('/shipper/report-failure', data);
    return res.data.data;
  },

  // Sprint 3 - US-17 & Sprint 4: Cash Reconciliation & PayOS Online Submit
  getCashReconciliation: async (
    shipperId?: number,
    date?: string,
    startDate?: string,
    endDate?: string
  ): Promise<CashReconciliationResponse> => {
    const params: any = {};
    if (shipperId) params.shipperId = shipperId;
    if (date) params.date = date;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const res = await apiClient.get('/shipper/cash-reconciliation', { params });
    return res.data.data;
  },

  submitCash: async (data: {
    amountSubmitted?: number;
    shiftDate?: string;
    paymentMethod?: 'PAYOS' | 'CASH';
    notes?: string;
    returnUrl?: string;
    cancelUrl?: string;
    trackingCodes?: string[];
  }): Promise<any> => {
    const res = await apiClient.post('/shipper/submit-cash', data);
    return res.data.data;
  },

  getCashSubmissions: async (params?: {
    shipperId?: number;
    postOfficeId?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    size?: number;
  }): Promise<{ content: CashSubmission[]; totalElements: number; totalPages: number }> => {
    const res = await apiClient.get('/shipper/cash-submissions', { params });
    return res.data.data;
  },

  checkSubmissionStatus: async (submissionCode: string): Promise<any> => {
    const res = await apiClient.get(`/shipper/cash-submissions/check/${submissionCode}`);
    return res.data.data;
  },

  approveCashSubmission: async (submissionCode: string): Promise<any> => {
    const res = await apiClient.post(`/shipper/cash-submissions/approve/${submissionCode}`);
    return res.data.data;
  },
};
