import React, { useState } from 'react';
import { Layout, Menu, Button, Tag, Drawer, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
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
  Network,
  Camera,
  Receipt,
  Coins,
  CheckSquare,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ContinuousScannerModal } from './ContinuousScannerModal';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import { AiChatWidget } from './ai/AiChatWidget';
import { NotificationBell } from './NotificationBell';
import { AttendanceModal } from './AttendanceModal';

const { Header, Sider, Content } = Layout;

export const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Kích hoạt lắng nghe WebSocket toàn ứng dụng
  useOrderWebSocket({ showNotification: true });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [globalScannerOpen, setGlobalScannerOpen] = useState<boolean>(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState<boolean>(false);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');
  const isPostOfficeManager = userRoles.includes('ROLE_POST_OFFICE_MANAGER');
  const isWarehouseStaff = userRoles.includes('ROLE_WAREHOUSE_STAFF');
  const isShipper = userRoles.includes('ROLE_SHIPPER');
  const isTruckDriver = userRoles.includes('ROLE_TRUCK_DRIVER');
  const isAccountant = userRoles.includes('ROLE_ACCOUNTANT');
  const isStaffOrAdmin = userRoles.some((r) =>
    ['ROLE_ADMIN', 'ROLE_BRANCH_MANAGER', 'ROLE_POST_OFFICE_MANAGER', 'ROLE_SHIPPER', 'ROLE_WAREHOUSE_STAFF', 'ROLE_TRUCK_DRIVER', 'ROLE_ACCOUNTANT'].includes(r)
  );
  const canCreateOrder = !isStaffOrAdmin && (userRoles.includes('ROLE_MERCHANT') || userRoles.includes('ROLE_CUSTOMER') || userRoles.length === 0);

  const canInbound = isAdmin || isBranchManager || isPostOfficeManager || isWarehouseStaff;
  const canManageBags = isAdmin || isPostOfficeManager || isWarehouseStaff;
  const canPickup = isShipper || isAdmin;
  const showQuickScan = canInbound || canPickup;

  // Xây dựng danh sách menu gom nhóm Dropdown / SubMenu chuẩn logistics
  const menuItems: any[] = [];

  // 1. Tổng quan Dashboard (Mục đơn ở đầu)
  if (!isShipper && user) {
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

  // 2. Nhóm Quản Lý Đơn Hàng (OMS)
  const omsChildren: any[] = [];
  if (user) {
    omsChildren.push({
      key: '/orders',
      icon: <Package size={16} />,
      label: isShipper
        ? 'Đơn hàng của tôi'
        : isBranchManager
        ? 'Đơn hàng Chi nhánh'
        : isPostOfficeManager
        ? 'Đơn hàng Bưu cục'
        : 'Quản lý đơn hàng',
    });
  }
  if (canCreateOrder) {
    omsChildren.push(
      {
        key: '/orders/create',
        icon: <PlusCircle size={16} />,
        label: 'Tạo đơn hàng mới',
      },
      {
        key: '/orders/batch',
        icon: <FileSpreadsheet size={16} />,
        label: 'Tạo đơn theo lô (Excel)',
      }
    );
  }
  omsChildren.push({
    key: '/track',
    icon: <Search size={16} />,
    label: 'Tra cứu hành trình',
  });

  if (!user) {
    menuItems.push({
      key: '/track',
      icon: <Search size={18} />,
      label: 'Tra cứu hành trình',
    });
  } else if (omsChildren.length > 0) {
    menuItems.push({
      key: 'sub-oms',
      icon: <Package size={18} />,
      label: 'Quản lý Đơn hàng (OMS)',
      children: omsChildren,
    });
  }

  // 3. Nhóm Khai Thác Kho & Chia Chọn (WMS)
  const wmsChildren: any[] = [];
  if (isShipper || isAdmin || isWarehouseStaff || isPostOfficeManager) {
    wmsChildren.push({
      key: '/shipper/tasks',
      icon: <Scan size={16} />,
      label: isWarehouseStaff || isPostOfficeManager
        ? 'Tác nghiệp Quét mã & Kho'
        : 'Nhiệm vụ Bưu tá & Quét mã',
    });
  }
  if (canInbound) {
    wmsChildren.push({
      key: '/wms/sorting-scanner',
      icon: <Scan size={16} />,
      label: 'Quét phân loại khu vực (Map)',
    });
  }
  if (canManageBags) {
    wmsChildren.push({
      key: '/wms/bags',
      icon: <Layers size={16} />,
      label: 'Đóng bao tải & Kẹp chì (WMS)',
    });
  }
  if (canManageBags || isTruckDriver) {
    wmsChildren.push({
      key: '/wms/dispatch',
      icon: <Navigation size={16} />,
      label: 'Điều vận xe gom bao hàng (TMS/Hub)',
    });
  }
  if (wmsChildren.length > 0) {
    menuItems.push({
      key: 'sub-wms',
      icon: <Layers size={18} />,
      label: 'Khai Thác Kho & Chia Chọn (WMS)',
      children: wmsChildren,
    });
  }

  // 4. Nhóm Vận Tải & Đội Xe (TMS / Fleet)
  const tmsChildren: any[] = [];
  if (isAdmin || isBranchManager || isPostOfficeManager) {
    tmsChildren.push({
      key: '/wms/trucks',
      icon: <Truck size={16} />,
      label: 'Quản lý Đội xe tải (Fleet)',
    });
  }
  if (isTruckDriver || isAdmin) {
    tmsChildren.push({
      key: '/driver/portal',
      icon: <Truck size={16} />,
      label: 'Cổng tác nghiệp Tài xế xe tải',
    });
  }
  if (canInbound) {
    tmsChildren.push({
      key: '/tms/manifests',
      icon: <ScrollText size={16} />,
      label: 'Bảng kê xuất xe tải (TMS)',
    });
  }
  if (canInbound || isAdmin || isBranchManager) {
    tmsChildren.push({
      key: '/tms/carriers',
      icon: <Building2 size={16} />,
      label: 'Đối tác Vận tải 3PL & SLA',
    });
  }
  if (isAdmin || isBranchManager || isPostOfficeManager || isShipper) {
    tmsChildren.push({
      key: '/tms/route-optimizer',
      icon: <Navigation size={16} />,
      label: 'Tối ưu Tuyến đường (VRP AI)',
    });
  }
  if (tmsChildren.length > 0) {
    menuItems.push({
      key: 'sub-tms',
      icon: <Truck size={18} />,
      label: 'Vận Tải & Đội Xe (TMS / Fleet)',
      children: tmsChildren,
    });
  }

  // 5. Nhóm Tài Chính & Tiền Lương (Finance & Payroll)
  const financeChildren: any[] = [];
  if (isAdmin || isAccountant) {
    financeChildren.push({
      key: '/accountant/dashboard',
      icon: <DollarSign size={16} />,
      label: 'Bảng Điều Khiển Kế Toán',
    });
  }
  if (isAdmin || isBranchManager || isPostOfficeManager || isAccountant) {
    financeChildren.push({
      key: '/vouchers/management',
      icon: <Receipt size={16} />,
      label: 'Quản lý Phiếu Thu - Chi',
    });
  }
  if (isAdmin || isBranchManager || isPostOfficeManager) {
    financeChildren.push({
      key: '/payroll/hub-approval',
      icon: <Coins size={16} />,
      label: 'Bảng kê Lương 3P & Duyệt (Hub)',
    });
  }
  if (user && isStaffOrAdmin) {
    financeChildren.push({
      key: '/payroll/my',
      icon: <Coins size={16} />,
      label: 'Phiếu lương của tôi (3P)',
    });
  }
  if (user) {
    financeChildren.push({
      key: '/billing/reconciliation',
      icon: <Wallet size={16} />,
      label: 'Đối soát COD & Ví Shop',
    });
  }
  if (financeChildren.length > 0) {
    menuItems.push({
      key: 'sub-finance',
      icon: <DollarSign size={18} />,
      label: 'Tài Chính & Bảng Lương',
      children: financeChildren,
    });
  }

  // 6. Nhóm Mạng Lưới & Quản Trị (Admin & Network)
  const adminChildren: any[] = [];
  if (isAdmin || isBranchManager || isPostOfficeManager) {
    adminChildren.push({
      key: '/admin/staff',
      icon: <Users size={16} />,
      label: isAdmin
        ? 'Quản lý nhân sự toàn quốc'
        : isBranchManager
        ? 'Quản lý nhân sự Chi nhánh'
        : 'Quản lý nhân sự Bưu cục',
    });
    adminChildren.push({
      key: '/admin/routes',
      icon: <RouteIcon size={16} />,
      label: isPostOfficeManager ? 'Phân tuyến bưu tá bưu cục' : 'Quản lý tuyến đường & Bưu tá',
    });
  }
  if (isAdmin || isBranchManager) {
    adminChildren.push({
      key: '/admin/warehouses',
      icon: <Building2 size={16} />,
      label: isAdmin ? 'Quản lý kho & Bưu cục' : 'Quản lý bưu cục Chi nhánh',
    });
  }
  if (isAdmin || isBranchManager || isPostOfficeManager) {
    adminChildren.push({
      key: '/admin/network-map',
      icon: <Network size={16} />,
      label: 'Bản đồ mạng lưới kho vận (Topology)',
    });
  }
  if (isAdmin) {
    adminChildren.push({
      key: '/admin/pricing',
      icon: <DollarSign size={16} />,
      label: 'Quản lý giá cước vận chuyển',
    });
  }
  if (adminChildren.length > 0) {
    menuItems.push({
      key: 'sub-admin',
      icon: <Building2 size={18} />,
      label: 'Mạng Lưới & Quản Trị',
      children: adminChildren,
    });
  }

  // 7. Hồ sơ cá nhân & Đổi mật khẩu (Mục đơn ở cuối)
  if (user) {
    menuItems.push({
      key: '/profile',
      icon: <UserCheck size={18} />,
      label: 'Hồ sơ cá nhân & Đổi mật khẩu',
    });
  }

  // Xác định active key và submenu mở tự động
  const getActiveMenuKey = (path: string): string => {
    if (path.startsWith('/track')) return '/track';
    if (path.startsWith('/orders/create')) return '/orders/create';
    if (path.startsWith('/orders/batch')) return '/orders/batch';
    if (path.startsWith('/orders')) return '/orders';
    if (path.startsWith('/shipper/tasks')) return '/shipper/tasks';
    if (path.startsWith('/wms/bags')) return '/wms/bags';
    if (path.startsWith('/wms/dispatch')) return '/wms/dispatch';
    if (path.startsWith('/wms/trucks')) return '/wms/trucks';
    if (path.startsWith('/wms/sorting-scanner')) return '/wms/sorting-scanner';
    if (path.startsWith('/driver/portal')) return '/driver/portal';
    if (path.startsWith('/tms/manifests')) return '/tms/manifests';
    if (path.startsWith('/tms/carriers')) return '/tms/carriers';
    if (path.startsWith('/tms/route-optimizer')) return '/tms/route-optimizer';
    if (path.startsWith('/accountant/dashboard')) return '/accountant/dashboard';
    if (path.startsWith('/vouchers/management')) return '/vouchers/management';
    if (path.startsWith('/payroll/hub-approval')) return '/payroll/hub-approval';
    if (path.startsWith('/payroll/my')) return '/payroll/my';
    if (path.startsWith('/billing/reconciliation')) return '/billing/reconciliation';
    if (path.startsWith('/admin/staff')) return '/admin/staff';
    if (path.startsWith('/admin/routes')) return '/admin/routes';
    if (path.startsWith('/admin/warehouses')) return '/admin/warehouses';
    if (path.startsWith('/admin/network-map')) return '/admin/network-map';
    if (path.startsWith('/admin/pricing')) return '/admin/pricing';
    if (path.startsWith('/profile')) return '/profile';
    if (path.startsWith('/dashboard')) return '/dashboard';
    return path;
  };

  const getSubMenuKeyForPath = (path: string): string | null => {
    if (path.startsWith('/orders') || path.startsWith('/track')) return 'sub-oms';
    if (path.startsWith('/shipper') || path.startsWith('/wms/bags') || path.startsWith('/wms/dispatch') || path.startsWith('/wms/sorting-scanner')) return 'sub-wms';
    if (path.startsWith('/wms/trucks') || path.startsWith('/driver') || path.startsWith('/tms')) return 'sub-tms';
    if (path.startsWith('/accountant') || path.startsWith('/vouchers') || path.startsWith('/payroll') || path.startsWith('/billing')) return 'sub-finance';
    if (path.startsWith('/admin')) return 'sub-admin';
    return null;
  };

  const activeMenuKey = getActiveMenuKey(location.pathname);
  const currentSubKey = getSubMenuKeyForPath(location.pathname);
  const [openKeys, setOpenKeys] = useState<string[]>(currentSubKey ? [currentSubKey] : []);

  React.useEffect(() => {
    const parentKey = getSubMenuKeyForPath(location.pathname);
    if (parentKey) {
      setOpenKeys((prev) => (prev.includes(parentKey) ? prev : [...prev, parentKey]));
    }
  }, [location.pathname]);

  // Menu dropdown người dùng với 3 lựa chọn theo yêu cầu: Chấm công, Hồ sơ cá nhân, Đăng xuất
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-summary',
      type: 'group',
      label: (
        <div className="px-1 py-1 text-xs">
          <div className="font-bold text-gray-800 text-sm truncate max-w-[200px]">{user?.fullName || user?.username}</div>
          <div className="text-[11px] text-gray-400 font-mono mt-0.5 flex flex-wrap gap-1">
            {user?.roles?.map((r) => (
              <span key={r} className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-semibold text-[10px]">
                {r.replace('ROLE_', '')}
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      type: 'divider',
    },
    ...(isStaffOrAdmin ? [
      {
        key: 'attendance',
        icon: <Camera size={16} className="text-emerald-600" />,
        label: <span className="font-medium text-gray-700">Chấm công (FaceID & GPS)</span>,
        onClick: () => setAttendanceModalOpen(true),
      },
    ] : []),
    {
      key: 'profile',
      icon: <UserCheck size={16} className="text-blue-600" />,
      label: <span className="font-medium text-gray-700">Hồ sơ cá nhân</span>,
      onClick: () => navigate('/profile'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogOut size={16} className="text-red-500" />,
      danger: true,
      label: <span className="font-semibold">Đăng xuất</span>,
      onClick: () => {
        logout();
        navigate('/login');
      },
    },
  ];

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
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
        width={290}
      >
        <div className="flex-1 overflow-y-auto py-2">
          <Menu
            mode="inline"
            selectedKeys={[activeMenuKey]}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys)}
            items={menuItems}
            onClick={({ key }) => {
              navigate(key);
              setMobileDrawerOpen(false);
            }}
            className="border-none font-medium mt-1"
          />
        </div>
        {user ? (
          <div className="p-4 border-t space-y-3 flex-shrink-0 bg-white">
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
            {isStaffOrAdmin && (
              <Button
                type="primary"
                icon={<Camera size={16} />}
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setAttendanceModalOpen(true);
                }}
                block
                className="bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center h-10 font-semibold rounded-xl"
              >
                Chấm công (FaceID & GPS)
              </Button>
            )}
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
          <div className="p-4 border-t space-y-2 flex-shrink-0 bg-white">
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
        width={260}
        className="hidden md:flex flex-col h-screen sticky top-0 border-r border-gray-200 shadow-sm z-30"
      >
        <div 
          className="p-4 flex items-center space-x-3 border-b border-gray-100 cursor-pointer flex-shrink-0"
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

        <div className="flex-1 overflow-y-auto py-2">
          <Menu
            mode="inline"
            selectedKeys={[activeMenuKey]}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys)}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            className="border-none font-medium text-sm"
          />
        </div>

        <div className="p-3 border-t border-gray-100 flex-shrink-0 bg-white">
          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
            <div className="text-xs font-semibold text-red-800">Hotline hỗ trợ 24/7</div>
            <div className="text-sm font-bold text-red-600 mt-0.5">1900 6868</div>
            <div className="text-[11px] text-gray-500 mt-1">Phục vụ mọi nhu cầu chuyển phát</div>
          </div>
        </div>
      </Sider>

      <Layout>
        {/* Mobile Header (< md): Tối ưu gọn gàng: Logo bên trái, Chuông + Dropdown Tên người dùng + Nút Menu bên phải */}
        <div className="bg-white px-3 flex md:hidden items-center justify-between border-b border-gray-200 h-14 shadow-xs sticky top-0 z-40">
          <div
            className="flex items-center space-x-1.5 cursor-pointer select-none active:opacity-80 transition-opacity"
            onClick={() => navigate(user ? '/dashboard' : '/track')}
          >
            <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
              <Truck size={15} />
            </div>
            <span className="font-black text-sm tracking-wider text-red-600">RIKKEI_POST</span>
          </div>

          <div className="flex items-center space-x-2">
            {user ? (
              <>
                <NotificationBell />
                <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                  <div className="flex items-center space-x-1.5 cursor-pointer select-none py-1 px-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors border border-transparent hover:border-gray-200">
                    <div className="w-7 h-7 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-xs shadow-xs flex-shrink-0">
                      {(user.fullName || user.username).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col text-left max-w-[105px] xs:max-w-[130px]">
                      <div className="text-[10px] text-gray-400 leading-none">Xin chào,</div>
                      <div className="text-xs font-bold text-gray-800 truncate leading-tight mt-0.5 flex items-center gap-0.5">
                        <span className="truncate">{user.fullName || user.username}</span>
                        <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                </Dropdown>
                <Button
                  type="text"
                  icon={<MenuIcon size={20} />}
                  onClick={() => setMobileDrawerOpen(true)}
                  className="text-gray-700 hover:text-red-600 p-1 flex items-center justify-center rounded-lg hover:bg-gray-100"
                  title="Menu điều hướng"
                />
              </>
            ) : (
              <div className="flex items-center space-x-1.5">
                <Button size="small" type="primary" onClick={() => navigate('/login')} className="bg-red-600 text-xs font-semibold rounded-lg h-8">
                  Đăng nhập
                </Button>
                <Button
                  type="text"
                  icon={<MenuIcon size={20} />}
                  onClick={() => setMobileDrawerOpen(true)}
                  className="text-gray-700 hover:text-red-600 p-1 flex items-center justify-center rounded-lg hover:bg-gray-100"
                  title="Menu điều hướng"
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop Header (>= md): Chỉ để lại phần Xin chào + Tên người dùng (xổ xuống 3 lựa chọn) và Hình cái chuông thông báo */}
        <Header className="bg-white px-6 hidden md:flex items-center justify-between border-b border-gray-200 h-16 shadow-xs">
          {user ? (
            <>
              {/* Bên trái: Xin chào + Tên người dùng có Dropdown 3 lựa chọn (Chấm công, Hồ sơ cá nhân, Đăng xuất) */}
              <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomLeft">
                <div className="flex items-center space-x-2.5 cursor-pointer select-none py-1.5 px-3 rounded-xl hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all group">
                  <div className="w-8 h-8 rounded-full bg-red-600 text-white font-bold flex items-center justify-center text-sm shadow-xs group-hover:scale-105 transition-transform">
                    {(user.fullName || user.username).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-sm text-gray-500">Xin chào,</span>
                    <span className="font-bold text-gray-800 text-sm group-hover:text-red-600 transition-colors flex items-center gap-1">
                      {user.fullName || user.username}
                      <ChevronDown size={14} className="text-gray-400 group-hover:text-red-500 transition-colors" />
                    </span>
                  </div>
                </div>
              </Dropdown>

              {/* Bên phải: Chỉ để lại hình cái chuông thông báo */}
              <div className="flex items-center space-x-3">
                <NotificationBell />
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
      {/* Modal Chấm Công FaceID & Định vị GPS */}
      <AttendanceModal
        open={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
      />
    </Layout>
  );
};
