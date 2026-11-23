import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Modal, Tabs, Tag, message, Row, Col, Space, DatePicker } from 'antd';
import {
  Scan,
  PackageCheck,
  Building2,
  Truck,
  CheckCircle2,
  Phone,
  MapPin,
  RefreshCw,
  XCircle,
  PackagePlus,
  Coins,
  Calendar,
  RotateCcw,
  Banknote,
  AlertCircle,
  Check,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { shipperApi } from '../api/shipper';
import { Order, ShipperSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { ContinuousScannerModal } from '../components/ContinuousScannerModal';

const { RangePicker } = DatePicker;

export const ShipperPortalPage: React.FC = () => {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');
  const isPostOfficeManager = userRoles.includes('ROLE_POST_OFFICE_MANAGER');
  const isWarehouseStaff = userRoles.includes('ROLE_WAREHOUSE_STAFF');
  const canInboundWarehouse = isAdmin || isBranchManager || isPostOfficeManager || isWarehouseStaff;

  const [tasks, setTasks] = useState<Order[]>([]);
  const [summary, setSummary] = useState<ShipperSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // 7 Phân loại theo yêu cầu người dùng
  const [activeTab, setActiveTab] = useState<string>('PICKUP_PENDING');

  // Bộ lọc theo ngày (startDate, endDate)
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'all'>('all');

  // Continuous Scanner Modal states
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<'PICKUP' | 'INBOUND'>('PICKUP');

  // Modal báo giao hàng thất bại
  const [failedModalVisible, setFailedModalVisible] = useState<boolean>(false);
  const [selectedTrackingCode, setSelectedTrackingCode] = useState<string>('');
  const [failedReason, setFailedReason] = useState<string>('Không liên lạc được với người nhận');

  const loadTasksAndSummary = async () => {
    setLoading(true);
    try {
      const [taskList, summaryData] = await Promise.all([
        shipperApi.getMyTasks(activeTab, startDate, endDate),
        shipperApi.getSummary(startDate, endDate),
      ]);
      setTasks(taskList);
      setSummary(summaryData);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách nhiệm vụ!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasksAndSummary();

    const handleOrderUpdated = () => {
      loadTasksAndSummary();
    };
    window.addEventListener('rikkei-order-updated', handleOrderUpdated);
    return () => {
      window.removeEventListener('rikkei-order-updated', handleOrderUpdated);
    };
  }, [activeTab, startDate, endDate]);

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

  const handleOpenScanner = (mode: 'PICKUP' | 'INBOUND') => {
    setScanMode(mode);
    setIsScanModalOpen(true);
  };

  const handleQuickUpdateStatus = async (trackingCode: string, status: string, note?: string) => {
    try {
      await shipperApi.updateStatus(trackingCode, status, note);
      message.success(`Cập nhật đơn ${trackingCode} thành công!`);
      loadTasksAndSummary();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái!');
    }
  };

  const openFailedModal = (trackingCode: string) => {
    setSelectedTrackingCode(trackingCode);
    setFailedReason('Không liên lạc được với người nhận');
    setFailedModalVisible(true);
  };

  const handleConfirmFailed = async () => {
    if (!selectedTrackingCode) return;
    try {
      await shipperApi.updateStatus(selectedTrackingCode, 'DELIVERY_FAILED', failedReason);
      message.success(`Đã cập nhật trạng thái không giao được cho đơn ${selectedTrackingCode}`);
      setFailedModalVisible(false);
      loadTasksAndSummary();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái!');
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'CREATED':
        return <Tag color="blue">Cần lấy tại Shop</Tag>;
      case 'PICKED_UP':
        return <Tag color="gold">Đã lấy - Chờ về kho</Tag>;
      case 'AT_SORTING_HUB':
        return <Tag color="cyan">Đã giao cho kho</Tag>;
      case 'IN_TRANSIT':
        return <Tag color="purple">Đang luân chuyển</Tag>;
      case 'DELIVERING':
        return <Tag color="orange">Đang mang đi giao</Tag>;
      case 'DELIVERED':
        return <Tag color="green">Giao khách thành công</Tag>;
      case 'DELIVERY_FAILED':
        return <Tag color="red">Không giao được</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 7 tab phân loại chính xác theo yêu cầu người dùng
  const tabItems = [
    {
      key: 'PICKUP_PENDING',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <PackagePlus size={16} className="text-blue-600" />
          <span>Đơn cần lấy tại shop ({summary?.pickupPending ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'PICKED_UP',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <PackageCheck size={16} className="text-amber-600" />
          <span>Đơn đã lấy của shop ({summary?.pickedUp ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'IN_WAREHOUSE',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <Building2 size={16} className="text-cyan-600" />
          <span>Đơn đã giao cho kho ({summary?.inWarehouse ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'DELIVERING',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <Truck size={16} className="text-orange-600" />
          <span>Đơn đã lấy ở kho mang đi giao ({summary?.delivering ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'DELIVERED',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Đơn đã giao cho khách ({summary?.delivered ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'DELIVERY_FAILED',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <XCircle size={16} className="text-rose-600" />
          <span>Đơn không giao được ({summary?.deliveryFailed ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'COD_COLLECTED',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <Coins size={16} className="text-yellow-600" />
          <span>Số tiền đã thu được ({((summary?.totalCollected ?? summary?.totalCodCollected ?? 0) / 1000).toLocaleString()}k)</span>
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner & Quick Scan */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 rounded-2xl p-5 md:p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-red-200 text-xs font-semibold uppercase tracking-wider">
            <Truck size={16} />
            <span>Cổng Tác Nghiệp Bưu Tá & Giao Nhận Chuyên Nghiệp</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black mt-1">Xin chào, {user?.fullName || 'Bưu tá'}!</h1>
          <p className="text-red-100 text-xs md:text-sm mt-1 max-w-xl">
            Quản lý và theo dõi chính xác từng giai đoạn đơn hàng, quét lấy hàng và thống kê đối soát tiền thu tức thì.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <Button
            size="large"
            type="primary"
            icon={<Scan size={18} />}
            onClick={() => handleOpenScanner('PICKUP')}
            className="bg-white text-red-700 hover:bg-gray-100 font-bold border-none h-11 px-5 rounded-xl shadow-md flex items-center justify-center flex-1 md:flex-initial"
          >
            Quét mã lấy hàng tại Shop
          </Button>

          {canInboundWarehouse && (
            <Button
              size="large"
              icon={<Building2 size={18} />}
              onClick={() => handleOpenScanner('INBOUND')}
              className="bg-red-800 text-white hover:bg-red-900 border-red-500 font-semibold h-11 px-4 rounded-xl flex items-center justify-center flex-1 md:flex-initial"
            >
              Quét nhập kho bưu cục
            </Button>
          )}
        </div>
      </div>

      {/* Bộ Lọc Theo Ngày (Date Range Filter) */}
      <Card className="rounded-2xl shadow-xs border-gray-200 bg-white p-2">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-gray-700 font-bold text-sm">
            <Calendar size={18} className="text-red-600" />
            <span>Lọc theo ngày tác nghiệp:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Các nút bấm nhanh thời gian */}
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => handleApplyPreset('today')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  datePreset === 'today' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:text-black'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('7days')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  datePreset === '7days' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:text-black'
                }`}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('30days')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  datePreset === '30days' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:text-black'
                }`}
              >
                30 ngày qua
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  datePreset === 'all' && !startDate ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:text-black'
                }`}
              >
                Tất cả
              </button>
            </div>

            {/* RangePicker chọn ngày tùy chỉnh */}
            <RangePicker
              value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
              onChange={handleRangePickerChange}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              className="rounded-lg h-9 text-xs"
            />

            {(startDate || endDate) && (
              <Button
                size="small"
                onClick={() => handleApplyPreset('all')}
                icon={<RotateCcw size={13} />}
                className="text-xs text-gray-500 rounded-md"
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Cards: 7 Mục trực quan tương ứng 7 phân loại */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} lg={3}>
          <div
            onClick={() => setActiveTab('PICKUP_PENDING')}
            className={`cursor-pointer rounded-xl p-3 border transition ${
              activeTab === 'PICKUP_PENDING'
                ? 'bg-blue-50 border-blue-500 shadow-sm ring-2 ring-blue-400'
                : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="text-gray-500 text-[11px] font-semibold uppercase truncate">1. Cần lấy tại Shop</div>
            <div className="text-xl font-black text-blue-700 mt-1">{summary?.pickupPending ?? 0}</div>
            <div className="text-[10px] text-blue-600 font-medium">Chờ lấy hàng</div>
          </div>
        </Col>

        <Col xs={12} sm={8} lg={3}>
          <div
            onClick={() => setActiveTab('PICKED_UP')}
            className={`cursor-pointer rounded-xl p-3 border transition ${
              activeTab === 'PICKED_UP'
                ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-400'
                : 'bg-white border-gray-200 hover:border-amber-300'
            }`}
          >
            <div className="text-gray-500 text-[11px] font-semibold uppercase truncate">2. Đã lấy của Shop</div>
            <div className="text-xl font-black text-amber-700 mt-1">{summary?.pickedUp ?? 0}</div>
            <div className="text-[10px] text-amber-600 font-medium">Chờ về kho</div>
          </div>
        </Col>

        <Col xs={12} sm={8} lg={3}>
          <div
            onClick={() => setActiveTab('IN_WAREHOUSE')}
            className={`cursor-pointer rounded-xl p-3 border transition ${
              activeTab === 'IN_WAREHOUSE'
                ? 'bg-cyan-50 border-cyan-500 shadow-sm ring-2 ring-cyan-400'
                : 'bg-white border-gray-200 hover:border-cyan-300'
            }`}
          >
            <div className="text-gray-500 text-[11px] font-semibold uppercase truncate">3. Đã giao cho kho</div>
            <div className="text-xl font-black text-cyan-700 mt-1">{summary?.inWarehouse ?? 0}</div>
            <div className="text-[10px] text-cyan-600 font-medium">Tại bưu cục</div>
          </div>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <div
            onClick={() => setActiveTab('DELIVERING')}
            className={`cursor-pointer rounded-xl p-3 border transition ${
              activeTab === 'DELIVERING'
                ? 'bg-orange-50 border-orange-500 shadow-sm ring-2 ring-orange-400'
                : 'bg-white border-gray-200 hover:border-orange-300'
            }`}
          >
            <div className="text-gray-500 text-[11px] font-semibold uppercase truncate">4. Lấy ở kho đi giao</div>
            <div className="text-xl font-black text-orange-700 mt-1">{summary?.delivering ?? 0}</div>
            <div className="text-[10px] text-orange-600 font-medium">Đang giao khách</div>
          </div>
        </Col>

        <Col xs={12} sm={8} lg={3}>
          <div
            onClick={() => setActiveTab('DELIVERED')}
            className={`cursor-pointer rounded-xl p-3 border transition ${
              activeTab === 'DELIVERED'
                ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-400'
                : 'bg-white border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className="text-gray-500 text-[11px] font-semibold uppercase truncate">5. Đã giao cho khách</div>
            <div className="text-xl font-black text-emerald-700 mt-1">{summary?.delivered ?? 0}</div>
            <div className="text-[10px] text-emerald-600 font-medium">Thành công</div>
          </div>
        </Col>

        <Col xs={12} sm={8} lg={3}>
          <div
            onClick={() => setActiveTab('DELIVERY_FAILED')}
            className={`cursor-pointer rounded-xl p-3 border transition ${
              activeTab === 'DELIVERY_FAILED'
                ? 'bg-rose-50 border-rose-500 shadow-sm ring-2 ring-rose-400'
                : 'bg-white border-gray-200 hover:border-rose-300'
            }`}
          >
            <div className="text-gray-500 text-[11px] font-semibold uppercase truncate">6. Không giao được</div>
            <div className="text-xl font-black text-rose-700 mt-1">{summary?.deliveryFailed ?? 0}</div>
            <div className="text-[10px] text-rose-600 font-medium">Cần giao lại</div>
          </div>
        </Col>

        <Col xs={24} sm={16} lg={5}>
          <div
            onClick={() => setActiveTab('COD_COLLECTED')}
            className={`cursor-pointer rounded-xl p-3 border transition ${
              activeTab === 'COD_COLLECTED'
                ? 'bg-yellow-50 border-yellow-500 shadow-sm ring-2 ring-yellow-400'
                : 'bg-white border-gray-200 hover:border-yellow-300'
            }`}
          >
            <div className="text-gray-500 text-[11px] font-semibold uppercase truncate flex items-center justify-between">
              <span>7. Số tiền đã thu được</span>
              <Coins size={14} className="text-yellow-600" />
            </div>
            <div className="text-xl font-black text-yellow-800 mt-1 truncate">
              {(summary?.totalCollected ?? summary?.totalCodCollected ?? 0).toLocaleString()} đ
            </div>
            <div className="text-[10px] text-yellow-700 font-medium">
              COD: {(summary?.totalCodCollected ?? 0).toLocaleString()} đ
            </div>
          </div>
        </Col>
      </Row>

      {/* Main Content Area */}
      <Card className="shadow-xs border-gray-200 rounded-2xl bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-3">
          <div className="w-full overflow-x-auto">
            <Tabs
              activeKey={activeTab}
              onChange={(key) => setActiveTab(key)}
              items={tabItems}
              className="font-semibold text-sm"
            />
          </div>
          <Button
            icon={<RefreshCw size={14} />}
            onClick={loadTasksAndSummary}
            loading={loading}
            className="shrink-0 self-end sm:self-auto rounded-lg text-xs"
          >
            Làm mới
          </Button>
        </div>

        {/* Tab 7: Hiển thị Thẻ Báo Cáo Doanh Thu Thu Hộ Tiền Mặt (COD) */}
        {activeTab === 'COD_COLLECTED' && (
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-amber-100 flex items-center space-x-1">
                  <Banknote size={16} />
                  <span>Báo Cáo Tổng Hợp Tiền Mặt Bưu Tá Đã Thu</span>
                </div>
                <div className="text-2xl md:text-3xl font-black mt-1">
                  {(summary?.totalCollected ?? summary?.totalCodCollected ?? 0).toLocaleString()} VNĐ
                </div>
                <div className="text-xs text-amber-100 mt-1">
                  {startDate && endDate
                    ? `Dữ liệu từ ${startDate} đến ${endDate}`
                    : 'Toàn bộ đơn hàng đã giao phát thành công'}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-black/15 p-3 rounded-xl text-xs backdrop-blur-xs">
                <div>
                  <div className="text-amber-200 font-medium">Tiền thu hộ COD:</div>
                  <div className="text-base font-bold">{(summary?.totalCodCollected ?? 0).toLocaleString()} đ</div>
                </div>
                <div>
                  <div className="text-amber-200 font-medium">Cước người nhận trả:</div>
                  <div className="text-base font-bold">{(summary?.totalFeeCollected ?? 0).toLocaleString()} đ</div>
                </div>
                <div>
                  <div className="text-amber-200 font-medium">Số đơn đã thu:</div>
                  <div className="text-base font-bold">{summary?.codOrdersCount ?? tasks.length} đơn</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Danh Sách Đơn Hàng */}
        <div className="mt-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <PackageCheck size={52} className="mx-auto mb-3 opacity-30 text-gray-500" />
              <p className="font-semibold text-gray-600 text-base">Hiện không có đơn hàng nào trong mục này</p>
              <p className="text-xs text-gray-400 mt-1">
                {startDate && endDate
                  ? `Trong khoảng ngày đã chọn (${startDate} - ${endDate}) không có đơn phù hợp.`
                  : 'Hãy kiểm tra các mục phân loại khác hoặc quét thêm đơn mới.'}
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-xs transition bg-white flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
              >
                <div className="space-y-2.5 flex-1 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-red-600 text-base tracking-wide">
                      {task.trackingCode}
                    </span>
                    {getStatusTag(task.currentStatus)}
                    <Tag color="geekblue" className="font-semibold text-xs">
                      {task.pickupType === 'DOOR_PICKUP' ? 'Lấy tận nơi' : 'Gửi tại bưu cục'}
                    </Tag>
                    {task.serviceType && (
                      <Tag color="purple" className="text-xs">
                        {task.serviceType === 'EXPRESS' ? 'Hỏa tốc' : 'Chuẩn'}
                      </Tag>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {/* Shop / Người gửi */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                        <span>Shop / Người gửi:</span>
                      </div>
                      <div className="font-bold text-gray-800 text-sm mt-0.5">{task.senderName}</div>
                      <div className="text-xs text-gray-600 flex items-center mt-1">
                        <Phone size={12} className="mr-1.5 text-blue-500 shrink-0" />
                        <a href={`tel:${task.senderPhone}`} className="text-blue-600 font-semibold hover:underline">
                          {task.senderPhone}
                        </a>
                      </div>
                      <div className="text-xs text-gray-600 flex items-start mt-1">
                        <MapPin size={12} className="mr-1.5 text-red-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {task.senderAddress}
                          {task.senderWardName ? `, ${task.senderWardName}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Người nhận */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <div className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                        <span>Người nhận / Khách:</span>
                      </div>
                      <div className="font-bold text-gray-800 text-sm mt-0.5">{task.receiverName}</div>
                      <div className="text-xs text-gray-600 flex items-center mt-1">
                        <Phone size={12} className="mr-1.5 text-blue-500 shrink-0" />
                        <a href={`tel:${task.receiverPhone}`} className="text-blue-600 font-semibold hover:underline">
                          {task.receiverPhone}
                        </a>
                      </div>
                      <div className="text-xs text-gray-600 flex items-start mt-1">
                        <MapPin size={12} className="mr-1.5 text-red-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">
                          {task.receiverAddress}
                          {task.receiverWardName ? `, ${task.receiverWardName}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chi tiết kiện hàng & tiền thu */}
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                    <div>
                      <span className="text-gray-500">Hàng hóa: </span>
                      <strong className="text-gray-800">{task.itemName}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Thu hộ COD: </span>
                      <strong className="text-red-600 font-bold">{(task.codAmount || 0).toLocaleString()} đ</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Cước: </span>
                      <strong className="text-gray-800">
                        {(task.totalFee || 0).toLocaleString()} đ ({task.paymentParty === 'RECEIVER' ? 'Khách trả' : 'Shop trả'})
                      </strong>
                    </div>
                    {task.currentStatus === 'DELIVERED' && (
                      <div className="text-emerald-700 font-semibold flex items-center space-x-1">
                        <Check size={14} className="text-emerald-600" />
                        <span>
                          Tổng thực thu: {((task.codAmount || 0) + (task.paymentParty === 'RECEIVER' ? (task.totalFee || 0) : 0)).toLocaleString()} đ
                        </span>
                      </div>
                    )}
                    {task.deliveryAttempts > 0 && (
                      <div className="text-rose-600 font-medium">
                        Số lần giao: {task.deliveryAttempts}
                      </div>
                    )}
                  </div>
                </div>

                {/* Các nút hành động tương ứng với từng giai đoạn */}
                <div className="flex flex-row lg:flex-col gap-2 shrink-0 w-full lg:w-44 justify-end">
                  {/* Mục 1: Đơn cần lấy tại Shop */}
                  {task.currentStatus === 'CREATED' && (
                    <Button
                      type="primary"
                      icon={<Scan size={16} />}
                      onClick={() => handleOpenScanner('PICKUP')}
                      className="bg-red-600 hover:bg-red-700 font-bold h-10 w-full rounded-xl shadow-xs"
                    >
                      Quét nhận tại Shop
                    </Button>
                  )}

                  {/* Mục 2: Đơn đã lấy của shop -> nếu có quyền kho thì hiển thị quét nhập kho */}
                  {task.currentStatus === 'PICKED_UP' && canInboundWarehouse && (
                    <Button
                      type="primary"
                      icon={<Building2 size={16} />}
                      onClick={() => handleOpenScanner('INBOUND')}
                      className="bg-amber-600 hover:bg-amber-700 font-bold h-10 w-full rounded-xl shadow-xs"
                    >
                      Quét nhập kho bưu cục
                    </Button>
                  )}

                  {/* Mục 3: Đơn đã giao cho kho -> Bưu tá bấm bắt đầu lấy đi giao */}
                  {task.currentStatus === 'AT_SORTING_HUB' && (
                    <Button
                      type="primary"
                      icon={<Truck size={16} />}
                      onClick={() => handleQuickUpdateStatus(task.trackingCode, 'DELIVERING', 'Bưu tá xuất kho mang đi giao')}
                      className="bg-blue-600 hover:bg-blue-700 font-bold h-10 w-full rounded-xl shadow-xs"
                    >
                      Lấy hàng đi giao
                    </Button>
                  )}

                  {/* Mục 4: Đơn đã lấy ở kho mang đi giao -> Giao thành công hoặc Thất bại */}
                  {task.currentStatus === 'DELIVERING' && (
                    <div className="flex flex-col gap-2 w-full">
                      <Button
                        type="primary"
                        icon={<CheckCircle2 size={16} />}
                        onClick={() => handleQuickUpdateStatus(task.trackingCode, 'DELIVERED', 'Khách đã nhận hàng và thanh toán')}
                        className="bg-emerald-600 hover:bg-emerald-700 font-bold h-9 w-full rounded-xl shadow-xs"
                      >
                        Giao thành công
                      </Button>
                      <Button
                        danger
                        icon={<XCircle size={16} />}
                        onClick={() => openFailedModal(task.trackingCode)}
                        className="h-9 w-full rounded-xl font-semibold"
                      >
                        Giao thất bại
                      </Button>
                    </div>
                  )}

                  {/* Mục 6: Đơn không giao được -> Bưu tá có thể bấm đi phát lại */}
                  {task.currentStatus === 'DELIVERY_FAILED' && (
                    <Button
                      type="primary"
                      icon={<RotateCcw size={16} />}
                      onClick={() => handleQuickUpdateStatus(task.trackingCode, 'DELIVERING', 'Bưu tá lên lịch đi giao lại')}
                      className="bg-rose-600 hover:bg-rose-700 font-bold h-10 w-full rounded-xl shadow-xs"
                    >
                      Giao lại đơn này
                    </Button>
                  )}

                  {/* Mục 5 & 7: Đơn đã giao cho khách / Đã thu tiền */}
                  {task.currentStatus === 'DELIVERED' && (
                    <div className="w-full text-center py-2 px-3 bg-emerald-50 text-emerald-800 font-bold rounded-xl border border-emerald-200 text-xs">
                      Đã hoàn tất phát hàng
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Modal Báo Giao Hàng Thất Bại Kèm Lý Do */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-rose-600 font-bold">
            <AlertCircle size={20} />
            <span>Ghi nhận phát hàng không thành công</span>
          </div>
        }
        open={failedModalVisible}
        onOk={handleConfirmFailed}
        onCancel={() => setFailedModalVisible(false)}
        okText="Xác nhận thất bại"
        cancelText="Hủy bỏ"
        okButtonProps={{ danger: true, className: 'font-bold' }}
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-700">
            Mã bưu gửi: <strong className="font-mono text-red-600 font-bold">{selectedTrackingCode}</strong>
          </p>

          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
              Chọn nhanh lý do phát thất bại:
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                'Không liên lạc được với người nhận',
                'Khách hẹn phát lại vào hôm sau',
                'Sai địa chỉ / Không tìm thấy số nhà',
                'Người nhận đổi ý, từ chối nhận bưu phẩm',
                'Khách yêu cầu xem hàng nhưng người gửi không cho xem',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setFailedReason(reason)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition text-left ${
                    failedReason === reason
                      ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
              Chi tiết lý do tác nghiệp:
            </label>
            <Input.TextArea
              rows={3}
              value={failedReason}
              onChange={(e) => setFailedReason(e.target.value)}
              placeholder="Nhập ghi chú tác nghiệp của bưu tá..."
              className="rounded-lg"
            />
          </div>
        </div>
      </Modal>

      {/* Continuous Scanner Modal */}
      <ContinuousScannerModal
        open={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        defaultMode={scanMode}
        canInbound={canInboundWarehouse}
        canPickup={true}
        onOrderUpdated={loadTasksAndSummary}
      />
    </div>
  );
};
