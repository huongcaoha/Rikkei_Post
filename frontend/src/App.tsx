import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersListPage } from './pages/OrdersListPage';
import { CreateOrderPage } from './pages/CreateOrderPage';
import { BatchOrderPage } from './pages/BatchOrderPage';
import { PrintLabelPage } from './pages/PrintLabelPage';
import { TrackOrderPage } from './pages/TrackOrderPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { DeliveryRoutesPage } from './pages/DeliveryRoutesPage';
import { WarehouseManagementPage } from './pages/WarehouseManagementPage';
import { PricingManagementPage } from './pages/PricingManagementPage';
import { MasterBagPage } from './pages/MasterBagPage';
import { ShipmentManifestPage } from './pages/ShipmentManifestPage';
import { ShipperPortalPage } from './pages/ShipperPortalPage';
import { ProfilePage } from './pages/ProfilePage';
import { BillingReconciliationPage } from './pages/BillingReconciliationPage';
import { CarrierPartnerPage } from './pages/CarrierPartnerPage';
import { VrpRouteOptimizationPage } from './pages/VrpRouteOptimizationPage';
import { TruckManagementPage } from './pages/TruckManagementPage';
import { TruckDriverPortalPage } from './pages/TruckDriverPortalPage';
import { AreaSortingScannerPage } from './pages/AreaSortingScannerPage';
import { DispatchManagementPage } from './pages/DispatchManagementPage';
import { NetworkTopologyMapPage } from './pages/NetworkTopologyMapPage';
import { AccountantDashboardPage } from './pages/AccountantDashboardPage';
import { VoucherManagementPage } from './pages/VoucherManagementPage';
import { HubPayrollApprovalPage } from './pages/HubPayrollApprovalPage';
import { MyPayrollPage } from './pages/MyPayrollPage';
import { EcommerceIntegrationPage } from './pages/EcommerceIntegrationPage';

const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center font-bold">Đang tải...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes (No Layout) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Application Layout with Header & Sidebar for both public tracking and merchant portal */}
          <Route element={<AppLayout />}>
            {/* Tra cứu hành trình: Luôn hiển thị đầy đủ Header & Sidebar */}
            <Route path="/track" element={<TrackOrderPage />} />
            <Route path="/track/:trackingCode" element={<TrackOrderPage />} />

            {/* Protected Merchant Portal Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/orders" element={<OrdersListPage />} />
              <Route path="/orders/create" element={<CreateOrderPage />} />
              <Route path="/orders/batch" element={<BatchOrderPage />} />
              <Route path="/orders/print/:trackingCode" element={<PrintLabelPage />} />
              <Route path="/ecommerce/channels" element={<EcommerceIntegrationPage />} />
              <Route path="/admin/staff" element={<StaffManagementPage />} />
              <Route path="/admin/routes" element={<DeliveryRoutesPage />} />
              <Route path="/admin/warehouses" element={<WarehouseManagementPage />} />
              <Route path="/admin/network-map" element={<NetworkTopologyMapPage />} />
              <Route path="/admin/pricing" element={<PricingManagementPage />} />
              <Route path="/wms/bags" element={<MasterBagPage />} />
              <Route path="/wms/dispatch" element={<DispatchManagementPage />} />
              <Route path="/wms/trucks" element={<TruckManagementPage />} />
              <Route path="/wms/sorting-scanner" element={<AreaSortingScannerPage />} />
              <Route path="/driver/portal" element={<TruckDriverPortalPage />} />
              <Route path="/tms/manifests" element={<ShipmentManifestPage />} />
              <Route path="/tms/carriers" element={<CarrierPartnerPage />} />
              <Route path="/tms/route-optimizer" element={<VrpRouteOptimizationPage />} />
              <Route path="/billing/reconciliation" element={<BillingReconciliationPage />} />
              <Route path="/accountant/dashboard" element={<AccountantDashboardPage />} />
              <Route path="/vouchers/management" element={<VoucherManagementPage />} />
              <Route path="/payroll/hub-approval" element={<HubPayrollApprovalPage />} />
              <Route path="/payroll/my" element={<MyPayrollPage />} />
              <Route path="/shipper/tasks" element={<ShipperPortalPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
