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
  generateMonthlyPayroll: async (data: GeneratePayrollRequest) => {
    const res = await apiClient.post('/payroll/generate', data);
    return res.data;
  },

  getPayrollList: async (params?: { month?: number; year?: number; warehouseId?: number; status?: string }) => {
    const res = await apiClient.get('/payroll', { params });
    return res.data;
  },

  getMyPayroll: async (month?: number, year?: number) => {
    const res = await apiClient.get('/payroll/my', { params: { month, year } });
    return res.data;
  },

  managerApprovePayroll: async (id: number) => {
    const res = await apiClient.put(`/payroll/${id}/manager-approve`);
    return res.data;
  },

  accountantApproveAndDisburse: async (id: number) => {
    const res = await apiClient.put(`/payroll/${id}/accountant-approve`);
    return res.data;
  },

  batchAccountantApprove: async (payrollIds: number[]) => {
    const res = await apiClient.post('/payroll/batch-approve', payrollIds);
    return res.data;
  },

  getAccountantDashboard: async (startDate?: string, endDate?: string) => {
    const res = await apiClient.get('/payroll/accountant/dashboard', { params: { startDate, endDate } });
    return res.data;
  },

  getHubPayrolls: async (warehouseId?: number, month?: number, year?: number) => {
    const res = await apiClient.get('/payroll', { params: { warehouseId, month, year } });
    return res.data;
  },

  getMyPayrolls: async (month?: number, year?: number) => {
    const res = await apiClient.get('/payroll/my', { params: { month, year } });
    return Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
  },

  generatePayroll: async (warehouseId?: number, month?: number, year?: number) => {
    const res = await apiClient.post('/payroll/generate', {
      warehouseId,
      month: month || new Date().getMonth() + 1,
      year: year || new Date().getFullYear(),
    });
    return res.data;
  },

  approveByManager: async (id: number) => {
    const res = await apiClient.put(`/payroll/${id}/manager-approve`);
    return res.data;
  },

  approveByAccountant: async (id: number) => {
    const res = await apiClient.put(`/payroll/${id}/accountant-approve`);
    return res.data;
  },
};

export type PayrollRecord = PayrollRecordDTO;
export type AccountantDashboard = AccountantDashboardDTO;

