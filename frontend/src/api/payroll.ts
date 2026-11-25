import apiClient from './client';

export interface GeneratePayrollRequest {
  month: number;
  year: number;
  warehouseId?: number;
}

export interface PayrollRecordDTO {
  id: number;
  payrollCode: string;
  month: number;
  year: number;
  userId: number;
  employeeName: string;
  employeePhone?: string;
  roleName: string;
  warehouseId?: number;
  warehouseName?: string;

  standardWorkDays: number;
  actualWorkDays: number;
  totalWorkHours: number;
  overtimeHours: number;

  deliveredOrdersCount: number;
  pickedOrdersCount: number;
  totalTripKm: number;
  sortedPackagesCount: number;

  baseSalaryP1: number;
  productionSalaryP2: number;
  bonusKpiP3: number;
  fuelAllowance: number;
  phoneAllowance: number;
  otherAllowances: number;
  violationDeductions: number;
  codPendingHolding: number;
  totalGrossSalary: number;
  netSalary: number;

  status: 'GENERATED' | 'PENDING_MANAGER_APPROVAL' | 'PENDING_ACCOUNTANT_APPROVAL' | 'PAID';
  aiExplanation?: string;

  managerApprovedBy?: number;
  managerApprovedByName?: string;
  managerApprovedAt?: string;

  accountantApprovedBy?: number;
  accountantApprovedByName?: string;
  accountantApprovedAt?: string;

  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountantDashboardDTO {
  totalCodCollected: number;
  totalMerchantPayable: number;
  totalShippingRevenue: number;
  totalExpenses: number;
  netProfit: number;
  pendingVouchersCount: number;
  pendingPayrollCount: number;
  approvedReceiptsAmount: number;
  approvedPaymentsAmount: number;
  paidSalariesAmount: number;
  expenseBreakdownByCategory: Record<string, number>;
}

export const payrollApi = {
  generateMonthlyPayroll: async (data: GeneratePayrollRequest): Promise<PayrollRecordDTO[]> => {
    const res = await apiClient.post('/payroll/generate', data);
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  getPayrollList: async (params?: { month?: number; year?: number; warehouseId?: number; status?: string }): Promise<PayrollRecordDTO[]> => {
    const res = await apiClient.get('/payroll', { params });
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  getMyPayroll: async (month?: number, year?: number): Promise<PayrollRecordDTO | null> => {
    const res = await apiClient.get('/payroll/my', { params: { month, year } });
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  managerApprovePayroll: async (id: number): Promise<PayrollRecordDTO> => {
    const res = await apiClient.put(`/payroll/${id}/manager-approve`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  accountantApproveAndDisburse: async (id: number): Promise<PayrollRecordDTO> => {
    const res = await apiClient.put(`/payroll/${id}/accountant-approve`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  batchAccountantApprove: async (payrollIds: number[]): Promise<PayrollRecordDTO[]> => {
    const res = await apiClient.post('/payroll/batch-approve', payrollIds);
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  getAccountantDashboard: async (startDate?: string, endDate?: string): Promise<AccountantDashboardDTO> => {
    const res = await apiClient.get('/payroll/accountant/dashboard', { params: { startDate, endDate } });
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  getHubPayrolls: async (warehouseId?: number, month?: number, year?: number): Promise<PayrollRecordDTO[]> => {
    const res = await apiClient.get('/payroll', { params: { warehouseId, month, year } });
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  getMyPayrolls: async (month?: number, year?: number): Promise<PayrollRecordDTO[]> => {
    const res = await apiClient.get('/payroll/my', { params: { month, year } });
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : (d ? [d] : []);
  },

  generatePayroll: async (warehouseId?: number, month?: number, year?: number): Promise<PayrollRecordDTO[]> => {
    const res = await apiClient.post('/payroll/generate', {
      warehouseId,
      month: month || new Date().getMonth() + 1,
      year: year || new Date().getFullYear(),
    });
    const d = res.data?.data !== undefined ? res.data.data : res.data;
    return Array.isArray(d) ? d : [];
  },

  approveByManager: async (id: number): Promise<PayrollRecordDTO> => {
    const res = await apiClient.put(`/payroll/${id}/manager-approve`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },

  approveByAccountant: async (id: number): Promise<PayrollRecordDTO> => {
    const res = await apiClient.put(`/payroll/${id}/accountant-approve`);
    return res.data?.data !== undefined ? res.data.data : res.data;
  },
};

export type PayrollRecord = PayrollRecordDTO;
export type AccountantDashboard = AccountantDashboardDTO;
