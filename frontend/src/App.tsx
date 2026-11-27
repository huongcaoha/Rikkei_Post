import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/AppLayout';

// Dynamic code splitting with React.lazy to drastically reduce initial JS bundle size and eliminate mobile UI lag
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const OrdersListPage = lazy(() => import('./pages/OrdersListPage').then(m => ({ default: m.OrdersListPage })));
const CreateOrderPage = lazy(() => import('./pages/CreateOrderPage').then(m => ({ default: m.CreateOrderPage })));
const BatchOrderPage = lazy(() => import('./pages/BatchOrderPage').then(m => ({ default: m.BatchOrderPage })));
const PrintLabelPage = lazy(() => import('./pages/PrintLabelPage').then(m => ({ default: m.PrintLabelPage })));
const TrackOrderPage = lazy(() => import('./pages/TrackOrderPage').then(m => ({ default: m.TrackOrderPage })));
const StaffManagementPage = lazy(() => import('./pages/StaffManagementPage').then(m => ({ default: m.StaffManagementPage })));
const DeliveryRoutesPage = lazy(() => import('./pages/DeliveryRoutesPage').then(m => ({ default: m.DeliveryRoutesPage })));
const WarehouseManagementPage = lazy(() => import('./pages/WarehouseManagementPage').then(m => ({ default: m.WarehouseManagementPage })));
const PricingManagementPage = lazy(() => import('./pages/PricingManagementPage').then(m => ({ default: m.PricingManagementPage })));
const MasterBagPage = lazy(() => import('./pages/MasterBagPage').then(m => ({ default: m.MasterBagPage })));
const ShipmentManifestPage = lazy(() => import('./pages/ShipmentManifestPage').then(m => ({ default: m.ShipmentManifestPage })));
const ShipperPortalPage = lazy(() => import('./pages/ShipperPortalPage').then(m => ({ default: m.ShipperPortalPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const BillingReconciliationPage = lazy(() => import('./pages/BillingReconciliationPage').then(m => ({ default: m.BillingReconciliationPage })));
const CarrierPartnerPage = lazy(() => import('./pages/CarrierPartnerPage').then(m => ({ default: m.CarrierPartnerPage })));
const VrpRouteOptimizationPage = lazy(() => import('./pages/VrpRouteOptimizationPage').then(m => ({ default: m.VrpRouteOptimizationPage })));
const TruckManagementPage = lazy(() => import('./pages/TruckManagementPage').then(m => ({ default: m.TruckManagementPage })));
const TruckDriverPortalPage = lazy(() => import('./pages/TruckDriverPortalPage').then(m => ({ default: m.TruckDriverPortalPage })));
const AreaSortingScannerPage = lazy(() => import('./pages/AreaSortingScannerPage').then(m => ({ default: m.AreaSortingScannerPage })));
const DispatchManagementPage = lazy(() => import('./pages/DispatchManagementPage').then(m => ({ default: m.DispatchManagementPage })));
const NetworkTopologyMapPage = lazy(() => import('./pages/NetworkTopologyMapPage').then(m => ({ default: m.NetworkTopologyMapPage })));
const AccountantDashboardPage = lazy(() => import('./pages/AccountantDashboardPage').then(m => ({ default: m.AccountantDashboardPage })));
const VoucherManagementPage = lazy(() => import('./pages/VoucherManagementPage').then(m => ({ default: m.VoucherManagementPage })));
const HubPayrollApprovalPage = lazy(() => import('./pages/HubPayrollApprovalPage').then(m => ({ default: m.HubPayrollApprovalPage })));
const MyPayrollPage = lazy(() => import('./pages/MyPayrollPage').then(m => ({ default: m.MyPayrollPage })));
const EcommerceIntegrationPage = lazy(() => import('./pages/EcommerceIntegrationPage').then(m => ({ default: m.EcommerceIntegrationPage })));
const SupplyManagementPage = lazy(() => import('./pages/SupplyManagementPage').then(m => ({ default: m.SupplyManagementPage })));

const PageLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3 py-12">
    <Spin size="large" />
    <span className="text-xs text-gray-500 font-medium">Đang tải trang...</span>
  </div>
);

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

const AdminRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, token, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center font-bold">Đang tải...</div>;
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user?.roles?.some((r: any) => (typeof r === 'string' ? r : r.roleName) === 'ROLE_ADMIN');
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoadingFallback />}>
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

                {/* Chỉ duy nhất Quản trị viên (ADMIN) mới có quyền truy cập và quản lý Hệ thống Sàn TMĐT */}
                <Route element={<AdminRoute />}>
                  <Route path="/ecommerce/channels" element={<EcommerceIntegrationPage />} />
                </Route>

                <Route path="/admin/staff" element={<StaffManagementPage />} />
                <Route path="/admin/routes" element={<DeliveryRoutesPage />} />
                <Route path="/admin/warehouses" element={<WarehouseManagementPage />} />
                <Route path="/admin/network-map" element={<NetworkTopologyMapPage />} />
                <Route path="/admin/pricing" element={<PricingManagementPage />} />
                <Route path="/wms/bags" element={<MasterBagPage />} />
                <Route path="/wms/dispatch" element={<DispatchManagementPage />} />
                <Route path="/wms/trucks" element={<TruckManagementPage />} />
                <Route path="/wms/supplies" element={<SupplyManagementPage />} />
                <Route path="/inventory" element={<SupplyManagementPage />} />
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
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
