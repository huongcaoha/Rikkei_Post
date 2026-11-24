import React, { useEffect, useState } from 'react';
import { Card, Button, Table, Tag, Input, Spin, message, DatePicker } from 'antd';
import {
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  DollarSign,
  PlusCircle,
  Printer,
  Search,
  ArrowRight,
  Scan,
  Calendar,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '../api/order';
import { DashboardStats, Order } from '../types';
import { useAuth } from '../context/AuthContext';
import { ContinuousScannerModal } from '../components/ContinuousScannerModal';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchCode, setSearchCode] = useState<string>('');
  const [quickScannerOpen, setQuickScannerOpen] = useState<boolean>(false);
  const navigate = useNavigate();

  // Bộ lọc theo ngày (startDate, endDate) theo yêu cầu người dùng
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'all'>('all');

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');
  const isPostOfficeManager = userRoles.includes('ROLE_POST_OFFICE_MANAGER');
  const isWarehouseStaff = userRoles.includes('ROLE_WAREHOUSE_STAFF');
  const isStaffOrAdmin = userRoles.some((r) =>
    ['ROLE_ADMIN', 'ROLE_BRANCH_MANAGER', 'ROLE_POST_OFFICE_MANAGER', 'ROLE_SHIPPER', 'ROLE_WAREHOUSE_STAFF'].includes(r)
  );
  // Chỉ tài khoản Shop / Khách hàng thuần túy mới có quyền tạo đơn hàng
  const canCreateOrder = userRoles.includes('ROLE_MERCHANT') && !isStaffOrAdmin;
  const canInboundWarehouse = isAdmin || isBranchManager || isPostOfficeManager || isWarehouseStaff;
  const isShipper = userRoles.includes('ROLE_SHIPPER');

  const dashboardTitle = isAdmin
    ? 'Tổng quan Hệ thống Toàn quốc'
    : isBranchManager
    ? `Tổng quan Chi nhánh ${user?.managedProvinceName || ''}`
    : isPostOfficeManager
    ? `Tổng quan Bưu cục ${user?.postOfficeName || ''}`
    : 'Tổng quan Vận hành & Đơn hàng';

  useEffect(() => {
    fetchDashboardData(startDate, endDate);
  }, [startDate, endDate]);

  // Lắng nghe cập nhật đơn hàng realtime qua WebSocket
  useOrderWebSocket({
    showNotification: false,
    onEvent: () => {
      fetchDashboardData(startDate, endDate);
    },
  });

  const fetchDashboardData = async (sDate?: string, eDate?: string) => {
    setLoading(true);
    try {
      const [statsData, ordersData] = await Promise.all([
        orderApi.getDashboardStats(sDate, eDate),
        orderApi.getMyOrders(0, 5),
      ]);
      setStats(statsData);
      setRecentOrders(ordersData.content);
    } catch (err: any) {
      message.error('Không thể tải dữ liệu dashboard: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (preset: 'today' | '7days' | '30days' | 'all') => {
    setDatePreset(preset);
    const today = dayjs().format('YYYY-MM-DD');
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7days') {
      setStartDate(dayjs().subtract(6, 'day').format('YYYY-MM-DD'));
      setEndDate(today);
    } else if (preset === '30days') {
      setStartDate(dayjs().subtract(29, 'day').format('YYYY-MM-DD'));
      setEndDate(today);
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
    }
  };

  const handleRangePickerChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      setStartDate(dates[0].format('YYYY-MM-DD'));
      setEndDate(dates[1].format('YYYY-MM-DD'));
      setDatePreset('all');
    } else {
      setStartDate(undefined);
      setEndDate(undefined);
      setDatePreset('all');
    }
  };

  const handleQuickSearch = () => {
    if (searchCode.trim()) {
      navigate(`/track/${searchCode.trim()}`);
    }
  };

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      CREATED: { color: 'blue', label: 'Mới tạo' },
      PICKED_UP: { color: 'cyan', label: 'Đã lấy hàng' },
      IN_TRANSIT: { color: 'purple', label: 'Đang luân chuyển' },
      AT_SORTING_HUB: { color: 'geekblue', label: 'Tại Hub khai thác' },
      DELIVERING: { color: 'orange', label: 'Đang phát hàng' },
      DELIVERED: { color: 'green', label: 'Giao thành công' },
      DELIVERY_FAILED: { color: 'red', label: 'Giao thất bại' },
      RETURNING: { color: 'volcano', label: 'Đang hoàn hàng' },
    };
    const s = map[status] || { color: 'default', label: status };
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  const columns = [
    {
      title: 'Mã vận đơn',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      render: (code: string) => (
        <span className="font-mono font-bold text-red-600 hover:underline cursor-pointer" onClick={() => navigate(`/track/${code}`)}>
          {code}
        </span>
      ),
    },
    {
      title: 'Người nhận',
      dataIndex: 'receiverName',
      key: 'receiverName',
      render: (text: string, record: Order) => (
        <div>
          <div className="font-medium text-gray-800">{text}</div>
          <div className="text-xs text-gray-400">{record.receiverPhone}</div>
        </div>
      ),
    },
    {
      title: 'Hàng hóa',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string, record: Order) => (
        <div>
          <div className="text-sm">{text}</div>
          <div className="text-xs text-gray-400">{record.billableWeightGram}g</div>
        </div>
      ),
    },
    {
      title: 'Tiền thu hộ (COD)',
      dataIndex: 'codAmount',
      key: 'codAmount',
      render: (val: number) => (
        <span className="font-bold text-gray-800">
          {Number(val).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Cước phí',
      dataIndex: 'totalFee',
      key: 'totalFee',
      render: (val: number) => (
        <span className="text-sm text-gray-600">
          {Number(val).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'currentStatus',
      key: 'currentStatus',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Order) => (
        <div className="flex space-x-2">
          <Button
            size="small"
            icon={<Printer size={14} />}
            onClick={() => navigate(`/orders/print/${record.trackingCode}`)}
            className="flex items-center text-xs"
          >
            In tem
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            onClick={() => navigate(`/track/${record.trackingCode}`)}
            className="text-xs"
          >
            Hành trình
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Spin size="large" tip="Đang tải dữ liệu vận hành..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header section with CTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{dashboardTitle}</h1>
          <p className="text-gray-500 text-sm mt-1">
            Theo dõi dòng tiền COD, trạng thái đơn hàng và tỷ lệ giao thành công theo thời gian thực.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canInboundWarehouse && (
            <Button
              type="primary"
              size="large"
              icon={<Scan size={18} />}
              onClick={() => setQuickScannerOpen(true)}
              className="bg-red-600 hover:bg-red-700 font-bold h-11 flex items-center shadow-md rounded-xl"
            >
              Quét mã nhập kho
            </Button>
          )}
          {isShipper && !canInboundWarehouse && (
            <Button
              type="primary"
              size="large"
              icon={<Scan size={18} />}
              onClick={() => setQuickScannerOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 font-bold h-11 flex items-center shadow-md rounded-xl"
            >
              Quét mã lấy hàng
            </Button>
          )}
          {canCreateOrder && (
            <Button
              type="primary"
              size="large"
              icon={<PlusCircle size={18} />}
              onClick={() => navigate('/orders/create')}
              className="bg-red-600 hover:bg-red-700 font-semibold h-11 flex items-center shadow-md rounded-xl"
            >
              Tạo đơn mới
            </Button>
          )}
        </div>
      </div>

      {/* Date Range Filter Bar theo yêu cầu người dùng */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-gray-700 font-semibold text-sm">
          <Calendar size={18} className="text-red-600" />
          <span>Khoảng thời gian lọc thống kê:</span>
          {startDate && endDate ? (
            <Tag color="red" className="ml-2 font-mono">
              {dayjs(startDate).format('DD/MM/YYYY')} - {dayjs(endDate).format('DD/MM/YYYY')}
            </Tag>
          ) : (
            <Tag color="default" className="ml-2">Tất cả thời gian</Tag>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => handleApplyPreset('today')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                datePreset === 'today' ? 'bg-white text-red-600 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('7days')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                datePreset === '7days' ? 'bg-white text-red-600 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              7 ngày qua
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('30days')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                datePreset === '30days' ? 'bg-white text-red-600 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              30 ngày qua
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${
                datePreset === 'all' ? 'bg-white text-red-600 shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tất cả
            </button>
          </div>
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
            onChange={handleRangePickerChange}
            className="rounded-xl border-gray-300 h-9"
            placeholder={['Từ ngày (start)', 'Đến ngày (end)']}
          />
        </div>
      </div>

      {/* Quick tracking search bar */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 rounded-2xl text-white shadow-md">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold">Tra cứu nhanh bưu gửi</h2>
          <p className="text-xs text-red-100 mt-1 mb-3">
            Nhập mã vận đơn bưu chính (ví dụ: RKP...) để xem lộ trình di chuyển qua các Hub & Spoke.
          </p>
          <div className="flex space-x-2">
            <Input
              size="large"
              placeholder="Nhập mã vận đơn (VD: RKP261120000001)..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onPressEnter={handleQuickSearch}
              className="rounded-xl border-0 font-mono text-gray-800"
            />
            <Button
              size="large"
              onClick={handleQuickSearch}
              className="bg-gray-900 hover:bg-black text-white border-0 font-bold px-6 rounded-xl flex items-center"
            >
              <Search size={18} className="mr-1" /> Tra cứu
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid - Responsive 2 columns on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="rounded-2xl border-gray-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng số đơn hàng</div>
              <div className="text-3xl font-black text-gray-900 mt-1">{stats?.totalOrders || 0}</div>
              <div className="text-xs text-blue-600 font-medium mt-1">Tất cả các thời điểm</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package size={24} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Đang giao & Luân chuyển</div>
              <div className="text-3xl font-black text-orange-600 mt-1">
                {(stats?.deliveringOrders || 0) + (stats?.inTransitOrders || 0)}
              </div>
              <div className="text-xs text-orange-500 font-medium mt-1">
                {stats?.deliveringOrders || 0} đơn đang phát
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Truck size={24} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Giao thành công</div>
              <div className="text-3xl font-black text-green-600 mt-1">{stats?.deliveredOrders || 0}</div>
              <div className="text-xs text-green-600 font-medium mt-1 flex items-center">
                <TrendingUp size={12} className="mr-1" /> Tỷ lệ: {stats?.successRate || 0}%
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle size={24} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-gray-200 shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng tiền COD đã thu</div>
              <div className="text-2xl font-black text-red-600 mt-1">
                {Number(stats?.totalCodCollected || 0).toLocaleString('vi-VN')} đ
              </div>
              <div className="text-xs text-gray-500 font-medium mt-1">Sẵn sàng đối soát</div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <DollarSign size={24} />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Orders Section */}
      <Card
        title={
          <div className="flex items-center justify-between py-1">
            <span className="font-bold text-gray-900 text-base">Đơn hàng mới tạo gần đây</span>
            <Button
              type="link"
              onClick={() => navigate('/orders')}
              className="text-red-600 text-xs font-semibold flex items-center p-0"
            >
              Xem tất cả đơn hàng <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        }
        className="rounded-2xl border-gray-200 shadow-xs"
      >
        {/* Desktop View (>= md) */}
        <div className="hidden md:block">
          <Table
            dataSource={recentOrders}
            columns={columns}
            rowKey="id"
            pagination={false}
            className="overflow-x-auto"
          />
        </div>

        {/* Mobile View (< md) */}
        <div className="block md:hidden space-y-3">
          {recentOrders.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-400">Chưa có đơn hàng nào gần đây.</div>
          ) : (
            recentOrders.map((order) => (
              <div
                key={order.id}
                className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="font-mono font-bold text-red-600"
                    onClick={() => navigate(`/track/${order.trackingCode}`)}
                  >
                    {order.trackingCode}
                  </span>
                  {getStatusTag(order.currentStatus)}
                </div>
                <div className="flex justify-between text-gray-600 text-[11px]">
                  <span>Người nhận: <b>{order.receiverName}</b></span>
                  <span className="font-bold text-red-600">{Number(order.codAmount).toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="text-[11px] text-gray-400 truncate">{order.receiverAddress}</div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Modal Quét Mã Tự Động */}
      <ContinuousScannerModal
        open={quickScannerOpen}
        onClose={() => setQuickScannerOpen(false)}
        defaultMode={canInboundWarehouse ? 'INBOUND' : 'PICKUP'}
        canInbound={canInboundWarehouse}
        canPickup={isShipper || userRoles.includes('ROLE_ADMIN')}
        onOrderUpdated={fetchDashboardData}
      />
    </div>
  );
};
