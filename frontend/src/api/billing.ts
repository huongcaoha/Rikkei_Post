import api from './client';
import { ApiResponse, MerchantWallet, ReconciliationSheet, ReconciliationDetail, WalletTransaction } from '../types';

export const billingApi = {
  getWallet: (merchantId?: number) =>
    api.get<ApiResponse<MerchantWallet>>('/billing/wallet', {
      params: merchantId ? { merchantId } : {},
    }),

  updateWalletBank: (bankName: string, bankAccountNumber: string, bankAccountHolder: string) =>
    api.put<ApiResponse<MerchantWallet>>('/billing/wallet/bank', null, {
      params: { bankName, bankAccountNumber, bankAccountHolder },
    }),

  createReconciliationSheet: (data: { merchantId?: number; startDate?: string; endDate?: string; trackingCodes?: string[] }) =>
    api.post<ApiResponse<ReconciliationSheet>>('/billing/reconciliations', data),

  getReconciliationSheets: (params?: { merchantId?: number; status?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<{ content: ReconciliationSheet[]; totalElements: number; totalPages: number }>>('/billing/reconciliations', { params }),

  getSheetDetail: (id: number) =>
    api.get<ApiResponse<ReconciliationDetail>>(`/billing/reconciliations/${id}`),

  getSheetDetailByCode: (code: string) =>
    api.get<ApiResponse<ReconciliationDetail>>(`/billing/reconciliations/code/${code}`),

  approveAndPayout: (id: number, data?: { bankTransactionCode?: string; notes?: string }) =>
    api.post<ApiResponse<ReconciliationSheet>>(`/billing/reconciliations/${id}/approve`, data || {}),

  requestWithdrawal: (data: { amount: number; bankName?: string; bankAccountNumber?: string; bankAccountHolder?: string; notes?: string }) =>
    api.post<ApiResponse<WalletTransaction>>('/billing/wallet/withdraw', data),

  getWalletTransactions: (params?: { merchantId?: number; page?: number; size?: number }) =>
    api.get<ApiResponse<{ content: WalletTransaction[]; totalElements: number; totalPages: number }>>('/billing/wallet/transactions', { params }),

  exportCsvUrl: (id: number) => `${api.defaults.baseURL}/billing/reconciliations/${id}/export-csv`,
};
