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
import { ShipperPortalPage } from './pages/ShipperPortalPage';
import { ProfilePage } from './pages/ProfilePage';

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
              <Route path="/admin/staff" element={<StaffManagementPage />} />
              <Route path="/admin/routes" element={<DeliveryRoutesPage />} />
              <Route path="/admin/warehouses" element={<WarehouseManagementPage />} />
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
