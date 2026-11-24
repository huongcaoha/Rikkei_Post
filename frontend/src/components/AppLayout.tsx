import React, { useState } from 'react';
import { Layout, Menu, Button, Tag, Drawer } from 'antd';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  FileSpreadsheet,
  Search,
  LogOut,
  LogIn,
  UserPlus,
  Truck,
  Users,
  Route as RouteIcon,
  Menu as MenuIcon,
  Scan,
  UserCheck,
  Building2,
  DollarSign,
  Layers,
  ScrollText,
  Wallet,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ContinuousScannerModal } from './ContinuousScannerModal';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import { AiChatWidget } from './ai/AiChatWidget';

const { Header, Sider, Content } = Layout;

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Kích hoạt lắng nghe WebSocket toàn ứng dụng
  useOrderWebSocket({ showNotification: true });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [globalScannerOpen, setGlobalScannerOpen] = useState<boolean>(false);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');
  const isPostOfficeManager = userRoles.includes('ROLE_POST_OFFICE_MANAGER');
  const isWarehouseStaff = userRoles.includes('ROLE_WAREHOUSE_STAFF');
  const isShipper = userRoles.includes('ROLE_SHIPPER');
  const isTruckDriver = userRoles.includes('ROLE_TRUCK_DRIVER');
  const isStaffOrAdmin = userRoles.some((r) =>
    ['ROLE_ADMIN', 'ROLE_BRANCH_MANAGER', 'ROLE_POST_OFFICE_MANAGER', 'ROLE_SHIPPER', 'ROLE_WAREHOUSE_STAFF', 'ROLE_TRUCK_DRIVER'].includes(r)
  );
  const canCreateOrder = !isStaffOrAdmin && (userRoles.includes('ROLE_MERCHANT') || userRoles.includes('ROLE_CUSTOMER') || userRoles.length === 0);

  const canInbound = isAdmin || isBranchManager || isPostOfficeManager || isWarehouseStaff;
  const canManageBags = isAdmin || isPostOfficeManager || isWarehouseStaff;
  const canPickup = isShipper || isAdmin;
  const showQuickScan = canInbound || canPickup;

  const menuItems: any[] = [];

  // Tổng quan Dashboard
  if (!isShipper) {
    menuItems.push({
      key: '/dashboard',
      icon: <LayoutDashboard size={18} />,
      label: isAdmin
        ? 'Tổng quan Hệ thống'
        : isBranchManager
        ? 'Tổng quan Chi nhánh'
        : isPostOfficeManager
        ? 'Tổng quan Bưu cục'
        : 'Tổng quan (Dashboard)',
    });
  }

  // Cổng tác nghiệp Shipper & Quét mã kho
  if (isShipper || isAdmin || isWarehouseStaff || isPostOfficeManager) {
    menuItems.push({
      key: '/shipper/tasks',
      icon: <Truck size={18} />,
      label: isWarehouseStaff || isPostOfficeManager
        ? 'Tác nghiệp Quét mã & Kho'
        : 'Nhiệm vụ Bưu tá & Quét mã',
    });
  }

  // Quản lý đơn hàng
  menuItems.push({
    key: '/orders',
    icon: <Package size={18} />,
    label: isShipper
      ? 'Đơn hàng của tôi'
      : isBranchManager
      ? 'Đơn hàng Chi nhánh'
      : isPostOfficeManager
      ? 'Đơn hàng Bưu cục'
      : 'Quản lý đơn hàng',
  });

  // Chỉ Shop (ROLE_MERCHANT) hoặc Khách hàng thông thường mới có quyền tạo đơn hàng (quản trị/quản lý/nhân viên không tạo đơn)
  if (canCreateOrder) {
    menuItems.push(
      {
        key: '/orders/create',
        icon: <PlusCircle size={18} />,
        label: 'Tạo đơn hàng mới',
      },
      {
        key: '/orders/batch',
        icon: <FileSpreadsheet size={18} />,
        label: 'Tạo đơn theo lô (Excel)',
      }
    );
  }

  // Quản lý nhân viên phân cấp
  if (isAdmin || isBranchManager || isPostOfficeManager) {
    menuItems.push({
      key: '/admin/staff',
      icon: <Users size={18} />,
      label: isAdmin
        ? 'Quản lý nhân sự toàn quốc'
        : isBranchManager
        ? 'Quản lý nhân sự Chi nhánh'
        : 'Quản lý nhân sự Bưu cục',
    });
  }

  // Quản lý tuyến đường và phân chia Shipper
  if (isAdmin || isBranchManager || isPostOfficeManager) {
    menuItems.push({
      key: '/admin/routes',
      icon: <RouteIcon size={18} />,
      label: isPostOfficeManager ? 'Phân tuyến bưu tá bưu cục' : 'Quản lý tuyến đường & Bưu tá',
    });
  }

  // Quản lý kho bưu cục (Admin & Branch Manager)
  if (isAdmin || isBranchManager) {
    menuItems.push({
      key: '/admin/warehouses',
      icon: <Building2 size={18} />,
      label: isAdmin ? 'Quản lý kho & Bưu cục' : 'Quản lý bưu cục Chi nhánh',
    });
  }

  // Quy trình Đóng bao tải Master Bag & Kẹp chì Seal (Chỉ Quản lý bưu cục / Nhân viên kho / Admin)
  if (canManageBags) {
    menuItems.push({
      key: '/wms/bags',
      icon: <Layers size={18} />,
      label: 'Đóng bao tải & Kẹp chì (WMS)',
    });
  }

  // Quản lý Đội xe tải (Fleet Management)
  if (isAdmin || isBranchManager || isPostOfficeManager) {
    menuItems.push({
      key: '/wms/trucks',
      icon: <Truck size={18} />,
      label: 'Quản lý Đội xe tải (Fleet)',
    });
  }

  // Quét mã phân loại đơn khu vực (Smart Sorting by Map)
  if (canInbound) {
    menuItems.push({
      key: '/wms/sorting-scanner',
      icon: <Scan size={18} />,
      label: 'Quét phân loại đơn khu vực (Map)',
    });
  }

  // Cổng tác nghiệp dành cho Tài xế xe tải
  if (isTruckDriver || isAdmin) {
    menuItems.push({
      key: '/driver/portal',
      icon: <Truck size={18} />,
      label: 'Cổng tác nghiệp Tài xế xe tải',
    });
  }

  // Quản lý Xuất kho & Bảng kê chuyến xe tải (TMS Linehaul)
  if (canInbound) {
    menuItems.push({
      key: '/tms/manifests',
      icon: <ScrollText size={18} />,
      label: 'Bảng kê xuất xe tải (TMS)',
    });
  }

  // Quản lý Đối tác Vận tải 3PL & Chuyến xe
  if (canInbound || isAdmin || isBranchManager) {
    menuItems.push({
      key: '/tms/carriers',
      icon: <Truck size={18} />,
      label: 'Đối tác Vận tải 3PL & SLA',
    });
  }

  // Tối ưu Tuyến đường giao hàng VRP (AI)
  if (isAdmin || isBranchManager || isPostOfficeManager || isShipper) {
    menuItems.push({
      key: '/tms/route-optimizer',
      icon: <Navigation size={18} />,
      label: 'Tối ưu Tuyến đường (VRP AI)',
    });
  }

  // Đối soát COD & Ví Shop (Tất cả tài khoản đăng nhập)
  if (user) {
    menuItems.push({
      key: '/billing/reconciliation',
      icon: <Wallet size={18} />,
      label: 'Đối soát COD & Ví Shop',
    });
  }

  // Quản lý giá cước vận chuyển (Chỉ Admin)
  if (isAdmin) {
    menuItems.push({
      key: '/admin/pricing',
      icon: <DollarSign size={18} />,
      label: 'Quản lý giá cước vận chuyển',
    });
  }

  // Tra cứu hành trình
  menuItems.push({
    key: '/track',
    icon: <Search size={18} />,
    label: 'Tra cứu hành trình',
  });

  // Hồ sơ cá nhân & Đổi mật khẩu
  if (user) {
    menuItems.push({
      key: '/profile',
      icon: <UserCheck size={18} />,
      label: 'Hồ sơ cá nhân & Đổi mật khẩu',
    });
  }

  // Khớp menu đang chọn, đối với /track và /track/:trackingCode đều sáng menu Tra cứu hành trình
  const activeMenuKey = location.pathname.startsWith('/track') ? '/track' : location.pathname;

  return (
    <Layout className="min-h-screen">
      {/* Drawer menu cho màn hình Mobile */}
      <Drawer
        title={
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-md">
              <Truck size={18} />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-wider text-red-600">RIKKEI_POST</div>
              <div className="text-[10px] text-gray-400 font-medium">Smart Express Logistics</div>
            </div>
          </div>
        }
        placement="left"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        bodyStyle={{ padding: 0 }}
        width={280}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeMenuKey]}
          items={menuItems}
          onClick={({ key }) => {
            navigate(key);
            setMobileDrawerOpen(false);
          }}
          className="border-none font-medium mt-2"
        />
        {user ? (
          <div className="p-4 border-t mt-4 space-y-3">
            <div 
              className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs cursor-pointer hover:bg-red-50/50 transition-colors"
              onClick={() => {
                setMobileDrawerOpen(false);
                navigate('/profile');
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Đang đăng nhập:</span>
                <span className="text-[11px] text-red-600 font-bold flex items-center gap-0.5">
                  <UserCheck size={13} /> Xem hồ sơ &gt;
                </span>
              </div>
              <div className="font-bold text-gray-800 text-sm mt-0.5">{user.fullName || user.username}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {user.roles?.map((r) => (
                  <Tag color="red" key={r} className="text-[10px] font-mono m-0">
                    {r.replace('ROLE_', '')}
                  </Tag>
                ))}
              </div>
            </div>
            <Button
              danger
              icon={<LogOut size={16} />}
              onClick={() => {
                logout();
                setMobileDrawerOpen(false);
                navigate('/login');
              }}
              block
              className="flex items-center justify-center h-10 font-semibold rounded-xl"
            >
              Đăng xuất
            </Button>
          </div>
        ) : (
          <div className="p-4 border-t mt-4 space-y-2">
            <Button
              icon={<LogIn size={15} />}
              onClick={() => {
                setMobileDrawerOpen(false);
                navigate('/login');
              }}
              block
              className="h-10 font-medium rounded-xl"
            >
              Đăng nhập
            </Button>
            <Button
              type="primary"
              icon={<UserPlus size={15} />}
              onClick={() => {
                setMobileDrawerOpen(false);
                navigate('/register');
              }}
              block
              className="bg-red-600 hover:bg-red-700 h-10 font-medium rounded-xl"
            >
              Đăng ký tài khoản
            </Button>
          </div>
        )}
      </Drawer>

      {/* Sider cố định cho màn hình Desktop (>= md) */}
      <Sider
        theme="light"
        width={250}
        className="hidden md:block border-r border-gray-200 shadow-sm"
      >
        <div 
          className="p-4 flex items-center space-x-3 border-b border-gray-100 cursor-pointer"
          onClick={() => navigate(user ? '/dashboard' : '/track')}
        >
          <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-md">
            <Truck size={22} />
          </div>
          <div>
            <div className="font-extrabold text-lg tracking-wider text-red-600">RIKKEI_POST</div>
            <div className="text-xs text-gray-400 font-medium">Smart Express Logistics</div>
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[activeMenuKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="mt-3 border-none font-medium"
        />

        <div className="absolute bottom-4 left-0 right-0 px-4">
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <div className="text-xs font-semibold text-red-800">Hotline hỗ trợ 24/7</div>
            <div className="text-sm font-bold text-red-600 mt-0.5">1900 6868</div>
            <div className="text-[11px] text-gray-500 mt-1">Phục vụ mọi nhu cầu chuyển phát</div>
          </div>
        </div>
      </Sider>

      <Layout>
        {/* Mobile Header (< md): Tối ưu gọn gàng theo yêu cầu: Hiển thị Tên người dùng + 1 Nút Menu, bỏ nút quét trùng lặp */}
        <div className="bg-white px-3.5 flex md:hidden items-center justify-between border-b border-gray-200 h-14 shadow-xs sticky top-0 z-40">
          <div
            className="flex items-center space-x-2 cursor-pointer select-none active:opacity-80 transition-opacity"
            onClick={() => navigate(user ? '/dashboard' : '/track')}
          >
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Truck size={17} />
            </div>
            <span className="font-black text-sm tracking-wider text-red-600">RIKKEI_POST</span>
          </div>

          <div className="flex items-center space-x-2">
            {user ? (
              <div 
                className="text-right cursor-pointer"
                onClick={() => setMobileDrawerOpen(true)}
              >
                <div className="text-xs sm:text-sm font-bold text-gray-800 truncate max-w-[150px] leading-tight">
                  {user.fullName || user.username}
                </div>
                <div className="flex justify-end mt-0.5">
                  <Tag color="red" className="text-[9px] m-0 leading-tight px-1 font-mono font-medium">
                    {user.roles?.[0]?.replace('ROLE_', '')}
                  </Tag>
                </div>
              </div>
            ) : (
              <Button size="small" type="primary" onClick={() => navigate('/login')} className="bg-red-600 text-xs font-semibold rounded-lg">
                Đăng nhập
              </Button>
            )}

            <Button
              type="text"
              icon={<MenuIcon size={21} />}
              onClick={() => setMobileDrawerOpen(true)}
              className="text-gray-700 hover:text-red-600 p-1 flex items-center justify-center rounded-lg hover:bg-gray-100"
              title="Menu điều hướng"
            />
          </div>
        </div>

        {/* Desktop Header (>= md) */}
        <Header className="bg-white px-6 hidden md:flex items-center justify-between border-b border-gray-200 h-16 shadow-xs">
          {user ? (
            <>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Xin chào,</span>
                <span className="font-semibold text-gray-800">{user.fullName || user.username}</span>
                <div className="ml-2 flex space-x-1">
                  {user.roles?.map((role) => (
                    <Tag color="red" key={role} className="text-xs font-mono">
                      {role.replace('ROLE_', '')}
                    </Tag>
                  ))}
                  <Tag className="text-[11px] flex items-center gap-1 font-medium rounded-full px-2 py-0.5 border-none bg-green-50 text-green-700 select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> WebSocket Live
                  </Tag>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {showQuickScan && (
                  <Button
                    type="primary"
                    icon={<Scan size={16} />}
                    onClick={() => setGlobalScannerOpen(true)}
                    className={`font-semibold rounded-xl flex items-center shadow-xs ${
                      canInbound ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {canInbound ? 'Quét mã nhập kho' : 'Quét mã lấy hàng'}
                  </Button>
                )}
                <Button
                  type="default"
                  icon={<UserCheck size={16} />}
                  onClick={() => navigate('/profile')}
                  className="rounded-xl font-medium text-gray-700 flex items-center hover:text-red-600"
                >
                  Hồ sơ cá nhân
                </Button>
                <Button
                  type="text"
                  icon={<LogOut size={16} />}
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="text-gray-600 hover:text-red-600 flex items-center"
                >
                  Đăng xuất
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-gray-800 tracking-tight">
                  Hệ thống Bưu chính & Logistics Thông minh Rikkei Post
                </span>
                <Tag color="blue" className="text-xs font-medium">
                  Cổng Tra Cứu Công Khai
                </Tag>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  icon={<LogIn size={15} />}
                  onClick={() => navigate('/login')}
                  className="font-medium flex items-center"
                >
                  Đăng nhập
                </Button>
                <Button
                  type="primary"
                  icon={<UserPlus size={15} />}
                  onClick={() => navigate('/register')}
                  className="bg-red-600 hover:bg-red-700 font-medium flex items-center"
                >
                  Đăng ký tài khoản
                </Button>
              </div>
            </>
          )}
        </Header>

        {/* Nội dung trang (có padding-bottom để tránh bị che bởi thanh Mobile Bottom Bar) */}
        <Content className="p-3 md:p-6 bg-gray-50 overflow-y-auto pb-24 md:pb-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </Content>
      </Layout>

      {/* Mobile Bottom Navigation Bar (< md) phong cách App Native */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 flex md:hidden items-center justify-around px-2 shadow-lg">
        <button
          onClick={() => navigate(user ? '/dashboard' : '/track')}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            location.pathname === '/dashboard' ? 'text-red-600 font-bold' : 'text-gray-500'
          }`}
        >
          <LayoutDashboard size={19} />
          <span className="text-[10px] mt-0.5">Tổng quan</span>
        </button>

        <button
          onClick={() => navigate('/orders')}
          className={`flex flex-col items-center justify-center flex-1 py-1 ${
            location.pathname.startsWith('/orders') ? 'text-red-600 font-bold' : 'text-gray-500'
          }`}
        >
          <Package size={19} />
          <span className="text-[10px] mt-0.5">Đơn hàng</span>
        </button>

        {/* Nút hành động trung tâm Quét mã tự động nổi bật */}
        {showQuickScan ? (
          <button
            onClick={() => setGlobalScannerOpen(true)}
            className="flex flex-col items-center justify-center flex-1 -mt-5 focus:outline-none group"
          >
            <div className={`w-13 h-13 rounded-full text-white shadow-xl flex items-center justify-center border-4 border-white transition-transform active:scale-90 ${
              canInbound ? 'bg-red-600' : 'bg-amber-600'
            }`}>
              <Scan size={22} />
            </div>
            <span className="text-[10px] font-bold text-gray-700 mt-0.5">
              {canInbound ? 'Nhập kho' : 'Lấy hàng'}
            </span>
          </button>
        ) : (
          <button
            onClick={() => navigate('/track')}
            className={`flex flex-col items-center justify-center flex-1 py-1 ${
              location.pathname.startsWith('/track') ? 'text-red-600 font-bold' : 'text-gray-500'
            }`}
          >
            <Search size={19} />
            <span className="text-[10px] mt-0.5">Tra cứu</span>
          </button>
        )}

        {(isShipper || isWarehouseStaff || isPostOfficeManager || isAdmin) && (
          <button
            onClick={() => navigate('/shipper/tasks')}
            className={`flex flex-col items-center justify-center flex-1 py-1 ${
              location.pathname.startsWith('/shipper') ? 'text-red-600 font-bold' : 'text-gray-500'
            }`}
          >
            <Truck size={19} />
            <span className="text-[10px] mt-0.5">{isShipper ? 'Bưu tá' : 'Kho vận'}</span>
          </button>
        )}

        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500"
        >
          <MenuIcon size={19} />
          <span className="text-[10px] mt-0.5">Thêm</span>
        </button>
      </div>

      {/* Modal Quét Mã Tự Động Toàn Cục */}
      <ContinuousScannerModal
        open={globalScannerOpen}
        onClose={() => setGlobalScannerOpen(false)}
        defaultMode={canInbound ? 'INBOUND' : 'PICKUP'}
        canInbound={canInbound}
        canPickup={canPickup}
        onOrderUpdated={() => {
          // Kích hoạt custom event để các trang con tự động reload nếu cần
          window.dispatchEvent(new CustomEvent('rikkei-order-updated'));
        }}
      />
      {/* Trợ lý AI CSKH Tra cứu Thông minh Toàn Cục */}
      <AiChatWidget />
    </Layout>
  );
};
