import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Modal, Tabs, Tag, message, Row, Col, Space, DatePicker, Select, Tooltip } from 'antd';
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
  Navigation,
  UserCheck,
  Send,
} from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { shipperApi } from '../api/shipper';
import { Order, ShipperSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { ContinuousScannerModal } from '../components/ContinuousScannerModal';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import { PodModal } from '../components/PodModal';
import { VietQrModal } from '../components/VietQrModal';
import { DeliveryFailureModal } from '../components/DeliveryFailureModal';
import { CashReconciliationModal } from '../components/CashReconciliationModal';
import { SmartDispatchModal } from '../components/SmartDispatchModal';
import { ReturnProofModal } from '../components/ReturnProofModal';
import { QrCode, PenTool, Cpu, FileSpreadsheet, Sparkles, Camera } from 'lucide-react';

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

  // Danh sách bưu tá thuộc bưu cục & Shipper đang được chọn để lọc
  const [shippersList, setShippersList] = useState<Array<{ id: number; fullName: string; phoneNumber?: string; username: string }>>([]);
  const [selectedShipperId, setSelectedShipperId] = useState<number | undefined>(undefined);

  // 7 Phân loại theo yêu cầu người dùng
  const [activeTab, setActiveTab] = useState<string>('PICKUP_PENDING');

  // Bộ lọc theo ngày (startDate, endDate)
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [datePreset, setDatePreset] = useState<'today' | '7days' | '30days' | 'all'>('all');

  // Continuous Scanner Modal states
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<'PICKUP' | 'INBOUND' | 'DELIVERY' | 'RETURN' | 'OUTBOUND_RETURN'>('PICKUP');

  // Modal xác nhận hoàn hàng cho Shop kèm chụp ảnh bằng chứng bắt buộc
  const [returnProofModalVisible, setReturnProofModalVisible] = useState<boolean>(false);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<Order | null>(null);

  // Modal thu hồi hoàn kho cho đơn không giao được
  const [returnModalVisible, setReturnModalVisible] = useState<boolean>(false);
  const [returnTrackingCode, setReturnTrackingCode] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Khách hẹn lại nhiều lần / Không liên lạc được');
  const [returnNote, setReturnNote] = useState<string>('');

  // Điều hướng chỉ đường Google Maps
  const openGoogleMapsDirections = (lat?: number, lng?: number, address?: string) => {
    let url = 'https://www.google.com/maps/dir/?api=1';
    if (lat && lng) {
      url += `&destination=${lat},${lng}`;
    } else if (address) {
      url += `&destination=${encodeURIComponent(address)}`;
    } else {
      message.warning('Không có thông tin địa chỉ hoặc tọa độ để chỉ đường!');
      return;
    }
    window.open(url, '_blank');
  };

  // Modal báo giao hàng thất bại
  const [failedModalVisible, setFailedModalVisible] = useState<boolean>(false);
  const [selectedTrackingCode, setSelectedTrackingCode] = useState<string>('');
  const [failedReason, setFailedReason] = useState<string>('Không liên lạc được với người nhận');

  // Sprint 3 - US-15 POD Modal states
  const [podModalVisible, setPodModalVisible] = useState<boolean>(false);
  const [selectedPodOrder, setSelectedPodOrder] = useState<Order | null>(null);

  // Sprint 3 - US-17 VietQR Modal states
  const [vietQrModalVisible, setVietQrModalVisible] = useState<boolean>(false);
  const [selectedVietQrOrder, setSelectedVietQrOrder] = useState<Order | null>(null);

  // Sprint 3 - US-18 Delivery Failure Modal states
  const [failureModalVisible, setFailureModalVisible] = useState<boolean>(false);
  const [selectedFailureOrder, setSelectedFailureOrder] = useState<Order | null>(null);

  // Sprint 3 - US-17 Cash Reconciliation Modal states
  const [cashReconciliationVisible, setCashReconciliationVisible] = useState<boolean>(false);

  // Sprint 3 - US-13 Smart Dispatch Modal states
  const [smartDispatchVisible, setSmartDispatchVisible] = useState<boolean>(false);

  // Modal xem ảnh & chữ ký POD
  const [viewPodModalVisible, setViewPodModalVisible] = useState<boolean>(false);
  const [viewPodOrder, setViewPodOrder] = useState<Order | null>(null);

  // Tải danh sách bưu tá thuộc bưu cục
  useEffect(() => {
    if (canInboundWarehouse) {
      shipperApi.getPostOfficeShippers().then((data) => {
        setShippersList(data || []);
      }).catch((err) => {
        console.warn('Lỗi tải danh sách bưu tá bưu cục:', err);
      });
    }
  }, [canInboundWarehouse]);

  const loadTasksAndSummary = async () => {
    setLoading(true);
    try {
      const [taskList, summaryData] = await Promise.all([
        shipperApi.getMyTasks(activeTab, startDate, endDate, selectedShipperId),
        shipperApi.getSummary(startDate, endDate, selectedShipperId),
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
  }, [activeTab, startDate, endDate, selectedShipperId]);

  // Lắng nghe cập nhật đơn hàng realtime qua WebSocket
  useOrderWebSocket({
    showNotification: false,
    onEvent: () => {
      loadTasksAndSummary();
    },
  });

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

  const handleOpenScanner = (mode: 'PICKUP' | 'INBOUND' | 'DELIVERY' | 'RETURN' | 'OUTBOUND_RETURN') => {
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

  const openReturnModal = (trackingCode: string) => {
    setReturnTrackingCode(trackingCode);
    setReturnReason('Khách hẹn lại nhiều lần / Không nhận hàng');
    setReturnNote('');
    setReturnModalVisible(true);
  };

  const handleConfirmReturn = async () => {
    if (!returnTrackingCode) return;
    try {
      await shipperApi.scanReturn(returnTrackingCode, returnReason, returnNote);
      message.success(`Đã thu hồi hoàn kho thành công đơn ${returnTrackingCode}!`);
      setReturnModalVisible(false);
      loadTasksAndSummary();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi thu hồi hoàn kho!');
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
          <span>Đơn mới tạo chưa lấy ({summary?.pickupPending ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'IN_WAREHOUSE',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <Building2 size={16} className="text-cyan-600" />
          <span>Đơn đã quét mã nhập kho ({summary?.inWarehouse ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'DELIVERING',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <Truck size={16} className="text-orange-600" />
          <span>Đơn đang đi giao ({summary?.delivering ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'DELIVERED',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Đơn đã giao xong ({summary?.delivered ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'DELIVERY_FAILED',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <XCircle size={16} className="text-rose-600" />
          <span>Đơn không giao được chờ hoàn ({summary?.deliveryFailed ?? 0})</span>
        </span>
      ),
    },
    {
      key: 'COD_COLLECTED',
      label: (
        <span className="flex items-center space-x-1.5 font-bold">
          <Coins size={16} className="text-yellow-600" />
          <span>Tiền thu từ khách ({((summary?.totalCollected ?? summary?.totalCodCollected ?? 0) / 1000).toLocaleString()}k)</span>
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
  ];

  return (
    <div className="space-y-5">
      {/* Top Banner & Quick Scan */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 rounded-2xl p-5 md:p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-red-200 text-xs font-semibold uppercase tracking-wider">
            <Truck size={16} />
            <span>{canInboundWarehouse ? 'Tác Nghiệp Quét Mã & Điều Hành Kho Bưu Cục' : 'Cổng Tác Nghiệp Bưu Tá & Giao Nhận Chuyên Nghiệp'}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black mt-1">Xin chào, {user?.fullName || 'Bưu tá'}!</h1>
          <p className="text-red-100 text-xs md:text-sm mt-1 max-w-xl">
            Quản lý và theo dõi chính xác từng giai đoạn đơn hàng, quét lấy hàng, nhập xuất kho và thu hồi đơn chuyển hoàn.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <Button
            size="large"
            type="primary"
            icon={<Scan size={18} />}
            onClick={() => handleOpenScanner('PICKUP')}
            className="bg-white text-red-700 hover:bg-gray-100 font-bold border-none h-11 px-4 rounded-xl shadow-md flex items-center justify-center flex-1 md:flex-initial"
          >
            Quét lấy hàng tại Shop
          </Button>

          <Button
            size="large"
            type="primary"
            icon={<Truck size={18} />}
            onClick={() => handleOpenScanner('DELIVERY')}
            className="bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold border-none h-11 px-4 rounded-xl shadow-md flex items-center justify-center flex-1 md:flex-initial"
          >
            Quét mã lấy đơn đi giao
          </Button>

          <Button
            size="large"
            type="primary"
            icon={<RotateCcw size={18} />}
            onClick={() => handleOpenScanner('OUTBOUND_RETURN')}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold border-none h-11 px-4 rounded-xl shadow-md flex items-center justify-center flex-1 md:flex-initial"
          >
            Quét lấy đơn trả Shop
          </Button>

          <Button
            size="large"
            icon={<Banknote size={18} className="text-emerald-400" />}
            onClick={() => setCashReconciliationVisible(true)}
            className="bg-emerald-800 text-white hover:bg-emerald-900 border-emerald-500 font-bold h-11 px-4 rounded-xl shadow-md flex items-center justify-center flex-1 md:flex-initial"
          >
            Nộp tiền cuối ca
          </Button>

          {canInboundWarehouse && (
            <>
              <Button
                size="large"
                icon={<Cpu size={18} className="text-indigo-300" />}
                onClick={() => setSmartDispatchVisible(true)}
                className="bg-indigo-800 text-white hover:bg-indigo-900 border-indigo-500 font-bold h-11 px-4 rounded-xl shadow-md flex items-center justify-center flex-1 md:flex-initial"
              >
                Smart Dispatch
              </Button>
              <Button
                size="large"
                icon={<Building2 size={18} />}
                onClick={() => handleOpenScanner('INBOUND')}
                className="bg-red-800 text-white hover:bg-red-900 border-red-500 font-semibold h-11 px-4 rounded-xl flex items-center justify-center flex-1 md:flex-initial"
              >
                Quét nhập kho bưu cục
              </Button>
              <Button
                size="large"
                type="primary"
                icon={<RotateCcw size={18} />}
                onClick={() => handleOpenScanner('RETURN')}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold border-none h-11 px-4 rounded-xl shadow-md flex items-center justify-center flex-1 md:flex-initial"
              >
                Quét mã thu hồi hoàn kho
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Bộ Lọc Theo Ngày & Bưu Tá */}
      <Card className="rounded-2xl shadow-xs border-gray-200 bg-white p-2">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2 text-gray-700 font-bold text-sm">
              <Calendar size={18} className="text-red-600" />
              <span>Thời gian:</span>
            </div>

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
                7 ngày
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('30days')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  datePreset === '30days' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:text-black'
                }`}
              >
                30 ngày
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

            <RangePicker
              format="DD/MM/YYYY"
              value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
              onChange={handleRangePickerChange}
              className="rounded-lg h-8 text-xs border-gray-300"
              placeholder={['Từ ngày', 'Đến ngày']}
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

          {/* Bộ lọc theo Shipper của kho bưu cục */}
          {canInboundWarehouse && (
            <div className="flex items-center space-x-2 w-full md:w-auto">
              <UserCheck size={16} className="text-blue-600 shrink-0" />
              <span className="text-xs font-bold text-gray-700 shrink-0">Bưu tá phụ trách:</span>
              <Select
                placeholder="Tất cả bưu tá bưu cục"
                allowClear
                value={selectedShipperId}
                onChange={(val) => setSelectedShipperId(val)}
                className="w-full md:w-60"
                options={[
                  { label: '🌟 Tất cả bưu tá bưu cục', value: undefined },
                  ...shippersList.map((s) => ({
                    label: `🛵 ${s.fullName} (${s.phoneNumber || s.username})`,
                    value: s.id,
                  })),
                ]}
              />
            </div>
          )}
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

      {/* Mobile 3-Tab Navigator (Mobile-First US-14) */}
      <div className="flex bg-gray-100 p-1 rounded-2xl gap-1 md:hidden shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('PICKUP_PENDING')}
          className={`flex-1 py-2 px-1 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition ${
            activeTab === 'PICKUP_PENDING' || activeTab === 'PICKED_UP'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          <PackagePlus size={16} />
          <span className="mt-0.5">Cần lấy ({summary?.pickupPending ?? 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('DELIVERING')}
          className={`flex-1 py-2 px-1 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition ${
            activeTab === 'DELIVERING'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          <Truck size={16} />
          <span className="mt-0.5">Đang giao ({summary?.delivering ?? 0})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('DELIVERED')}
          className={`flex-1 py-2 px-1 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition ${
            activeTab === 'DELIVERED' || activeTab === 'COD_COLLECTED'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-black'
          }`}
        >
          <CheckCircle2 size={16} />
          <span className="mt-0.5">Đã xong ({summary?.delivered ?? 0})</span>
        </button>
      </div>

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
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                          <span>Shop / Người gửi:</span>
                          {task.senderLat && task.senderLng && (
                            <Tag color="cyan" className="text-[10px] m-0 font-normal">📍 GPS</Tag>
                          )}
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

                      <Button
                        size="small"
                        icon={<Navigation size={12} className="text-blue-500" />}
                        onClick={() => openGoogleMapsDirections(task.senderLat, task.senderLng, task.senderAddress + (task.senderWardName ? ', ' + task.senderWardName : ''))}
                        className="text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 mt-2 self-start flex items-center"
                      >
                        Chỉ đường đến Shop
                      </Button>
                    </div>

                    {/* Người nhận */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex flex-col justify-between">
                      <div>
                        <div className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                          <span>Người nhận / Khách:</span>
                          {task.receiverLat && task.receiverLng && (
                            <Tag color="cyan" className="text-[10px] m-0 font-normal">📍 GPS</Tag>
                          )}
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

                      <Button
                        size="small"
                        icon={<Navigation size={12} className="text-emerald-500" />}
                        onClick={() => openGoogleMapsDirections(task.receiverLat, task.receiverLng, task.receiverAddress + (task.receiverWardName ? ', ' + task.receiverWardName : ''))}
                        className="text-xs font-semibold text-emerald-600 border-emerald-200 hover:bg-emerald-50 mt-2 self-start flex items-center"
                      >
                        Chỉ đường đến người nhận
                      </Button>
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

                  {/* Mục 3: Đơn đã giao cho kho -> Bưu tá có thể quét mã hoặc bấm xuất kho đi giao */}
                  {task.currentStatus === 'AT_SORTING_HUB' && (
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="w-full text-center py-2 px-3 bg-cyan-50 text-cyan-800 font-bold rounded-xl border border-cyan-200 text-xs flex items-center justify-center space-x-1.5">
                        <Scan size={14} className="text-cyan-700" />
                        <span>{task.deliveryAttempts && task.deliveryAttempts > 0 ? `Lưu kho (Chờ phát lại lần ${(task.deliveryAttempts || 0) + 1}/3)` : 'Đã lưu kho bưu cục'}</span>
                      </div>
                      <Button
                        type="primary"
                        icon={<Truck size={14} />}
                        onClick={async () => {
                          try {
                            await shipperApi.scanDelivery(task.trackingCode);
                            message.success(`Đã xuất kho đơn [${task.trackingCode}] mang đi phát!`);
                            loadTasksAndSummary();
                          } catch (err: any) {
                            message.error(err.response?.data?.message || 'Lỗi xuất kho đi giao!');
                          }
                        }}
                        className="bg-amber-500 hover:bg-amber-600 font-bold h-8.5 w-full rounded-xl text-xs shadow-xs"
                      >
                        {task.deliveryAttempts && task.deliveryAttempts > 0 ? `Xuất kho phát lại (Lần ${(task.deliveryAttempts || 0) + 1}/3)` : 'Xuất kho đi giao'}
                      </Button>
                    </div>
                  )}

                  {/* Mục 4: Đơn đã lấy ở kho mang đi giao -> Giao hàng POD, VietQR, Báo thất bại */}
                  {task.currentStatus === 'DELIVERING' && (
                    <div className="flex flex-col gap-1.5 w-full">
                      <Button
                        type="primary"
                        icon={<PenTool size={15} />}
                        onClick={() => {
                          setSelectedPodOrder(task);
                          setPodModalVisible(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 font-bold h-9 w-full rounded-xl shadow-xs text-xs"
                      >
                        Giao hàng POD (Ký + OTP)
                      </Button>
                      <Button
                        icon={<QrCode size={15} />}
                        onClick={() => {
                          setSelectedVietQrOrder(task);
                          setVietQrModalVisible(true);
                        }}
                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-300 font-bold h-8 w-full rounded-xl text-xs flex items-center justify-center space-x-1"
                      >
                        <span>Mã VietQR thu COD</span>
                      </Button>
                      <Button
                        danger
                        icon={<XCircle size={15} />}
                        onClick={() => {
                          setSelectedFailureOrder(task);
                          setFailureModalVisible(true);
                        }}
                        className="h-8 w-full rounded-xl font-medium text-xs"
                      >
                        Báo phát thất bại
                      </Button>
                    </div>
                  )}

                  {/* Mục 6: Đơn không giao được -> Bưu tá mang về kho để nhân viên kho quét nhập lại, hoặc chuyển hoàn nếu đủ 3 lần */}
                  {task.currentStatus === 'DELIVERY_FAILED' && (
                    <div className="flex flex-col gap-1.5 w-full">
                      <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-1.5 text-center">
                        Phát thất bại: {task.deliveryAttempts || 1}/3 lần - Cần mang về kho
                      </div>
                      {canInboundWarehouse && (
                        <Button
                          type="primary"
                          icon={<Building2 size={15} />}
                          onClick={async () => {
                            try {
                              await shipperApi.scanInbound(task.trackingCode);
                              message.success(`Đã quét tiếp nhận nhập kho bưu cục lưu trữ đơn [${task.trackingCode}], sẵn sàng để bưu tá xuất kho đi phát lại!`);
                              loadTasksAndSummary();
                            } catch (err: any) {
                              message.error(err.response?.data?.message || 'Lỗi nhập kho!');
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 font-bold h-9 w-full rounded-xl shadow-xs text-xs"
                        >
                          Quét nhập lại vào kho
                        </Button>
                      )}
                      {canInboundWarehouse && (
                        (task.deliveryAttempts || 0) >= 3 ? (
                          <Button
                            type="primary"
                            icon={<RotateCcw size={15} />}
                            onClick={() => openReturnModal(task.trackingCode)}
                            className="bg-orange-600 hover:bg-orange-700 font-bold h-9 w-full rounded-xl shadow-xs text-xs"
                          >
                            Chuyển hoàn về Shop (Đủ 3 lần)
                          </Button>
                        ) : (
                          <Tooltip title={`Chỉ được phép chuyển hoàn khi giao thất bại đủ 3 lần (Hiện tại: ${task.deliveryAttempts || 1}/3 lần). Vui lòng quét nhập kho bưu cục để phát lại vào hôm sau.`}>
                            <span>
                              <Button
                                disabled
                                icon={<RotateCcw size={15} />}
                                className="bg-gray-100 text-gray-400 border-gray-200 font-bold h-9 w-full rounded-xl text-xs cursor-not-allowed"
                              >
                                Chuyển hoàn về Shop ({task.deliveryAttempts || 1}/3 lần)
                              </Button>
                            </span>
                          </Tooltip>
                        )
                      )}
                      <Button
                        icon={<RotateCcw size={15} />}
                        onClick={() => handleQuickUpdateStatus(task.trackingCode, 'DELIVERING', 'Bưu tá lên lịch đi giao lại')}
                        className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold h-9 w-full rounded-xl border border-rose-200 text-xs"
                      >
                        Giao lại đơn này
                      </Button>
                    </div>
                  )}

                  {task.currentStatus === 'RETURNING' && (
                    <div className="w-full flex flex-col gap-2">
                      <div className="text-center py-1.5 px-3 bg-orange-50 text-orange-800 font-bold rounded-xl border border-orange-200 text-xs">
                        🔄 Đang chuyển hoàn về Shop
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          icon={<Send size={13} />}
                          onClick={async () => {
                            try {
                              await shipperApi.scanOutboundReturn(task.trackingCode);
                              message.success(`Đã xuất kho lấy đơn [${task.trackingCode}] đi trả Shop thành công!`);
                              loadTasksAndSummary();
                            } catch (e: any) {
                              message.error(e.response?.data?.message || 'Lỗi khi xuất kho trả Shop');
                            }
                          }}
                          className="bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold h-8 rounded-lg border border-amber-300 text-[11px]"
                        >
                          Đi trả Shop
                        </Button>
                        <Button
                          type="primary"
                          icon={<Camera size={13} />}
                          onClick={() => {
                            setSelectedReturnOrder(task);
                            setReturnProofModalVisible(true);
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-bold h-8 rounded-lg text-[11px]"
                        >
                          Đã trả (Chụp ảnh)
                        </Button>
                      </div>
                    </div>
                  )}

                  {task.currentStatus === 'RETURNED' && (
                    <div className="w-full space-y-1.5">
                      <div className="w-full text-center py-2 px-3 bg-purple-50 text-purple-800 font-bold rounded-xl border border-purple-200 text-xs">
                        ✓ Đã hoàn trả về Shop thành công (Kết thúc đơn)
                      </div>
                      {task.podPhotoUrl && (
                        <Button
                          size="small"
                          icon={<Camera size={13} />}
                          onClick={() => {
                            setSelectedPodOrder(task);
                            setViewPodModalVisible(true);
                          }}
                          className="w-full text-xs font-semibold text-purple-700 border-purple-200 hover:border-purple-400 rounded-lg h-7"
                        >
                          Xem ảnh bằng chứng hoàn hàng
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Mục 5 & 7: Đơn đã giao cho khách / Đã thu tiền */}
                  {task.currentStatus === 'DELIVERED' && (
                    <div className="w-full flex flex-col gap-1.5">
                      <div className="text-center py-1.5 px-3 bg-emerald-50 text-emerald-800 font-bold rounded-xl border border-emerald-200 text-xs">
                        ✓ Giao thành công
                      </div>
                      {(task.podSignatureUrl || task.podPhotoUrl) && (
                        <Button
                          size="small"
                          icon={<Sparkles size={13} className="text-emerald-600" />}
                          onClick={() => {
                            setViewPodOrder(task);
                            setViewPodModalVisible(true);
                          }}
                          className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded-lg font-medium"
                        >
                          Xem bằng chứng POD
                        </Button>
                      )}
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

      {/* Modal Quét Mã Thu Hồi Đơn Hàng Hoàn Về Kho (POST_OFFICE_MANAGER / WAREHOUSE_STAFF) */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-orange-600 font-bold">
            <RotateCcw size={20} />
            <span>Thu hồi đơn hàng hoàn về kho: {returnTrackingCode}</span>
          </div>
        }
        open={returnModalVisible}
        onOk={handleConfirmReturn}
        onCancel={() => setReturnModalVisible(false)}
        okText="Xác nhận thu hồi hoàn kho"
        cancelText="Hủy bỏ"
        okButtonProps={{ className: 'bg-orange-600 hover:bg-orange-700 font-bold' }}
      >
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-700">
            Mã bưu gửi thu hồi: <strong className="font-mono text-orange-600 font-bold">{returnTrackingCode}</strong>
          </p>

          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
              Chọn nhanh lý do thu hồi hoàn kho:
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {[
                'Khách từ chối nhận hàng nhiều lần',
                'Sai địa chỉ nhận / Không liên lạc được',
                'Khách hủy đơn hàng / Đổi ý không mua',
                'Hàng bị hư hỏng / Người nhận từ chối',
                'Shop yêu cầu thu hồi hoàn gấp',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReturnReason(reason)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition text-left ${
                    returnReason === reason
                      ? 'bg-orange-50 border-orange-500 text-orange-700 font-bold'
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
              Chi tiết lý do hoàn hàng (*):
            </label>
            <Input.TextArea
              rows={2}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Nhập lý do tại sao không giao được nên hoàn về..."
              className="rounded-lg"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 uppercase block mb-1">
              Ghi chú bưu cục khi nhập kho thu hồi:
            </label>
            <Input
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="Ví dụ: Đã nhận lại gói hàng từ bưu tá, nguyên vẹn..."
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
        canDelivery={true}
        canReturn={canInboundWarehouse}
        canOutboundReturn={true}
        onOrderUpdated={loadTasksAndSummary}
        onOpenReturnProof={(ord) => {
          setSelectedReturnOrder(ord);
          setReturnProofModalVisible(true);
        }}
      />

      {/* Modal Xác Nhận Hoàn Hàng Cho Shop Kèm Ảnh Bằng Chứng Bắt Buộc */}
      <ReturnProofModal
        visible={returnProofModalVisible}
        order={selectedReturnOrder}
        onClose={() => setReturnProofModalVisible(false)}
        onSuccess={loadTasksAndSummary}
      />

      {/* Sprint 3 - US-15 & US-16: Bằng chứng giao hàng POD & Xác thực OTP */}
      <PodModal
        visible={podModalVisible}
        order={selectedPodOrder}
        onClose={() => {
          setPodModalVisible(false);
          setSelectedPodOrder(null);
        }}
        onSuccess={() => {
          loadTasksAndSummary();
        }}
        onOpenVietQr={() => {
          if (selectedPodOrder) {
            setSelectedVietQrOrder(selectedPodOrder);
            setVietQrModalVisible(true);
          }
        }}
      />

      {/* Sprint 3 - US-17: Modal Mã VietQR Thu Tiền Động NAPAS */}
      <VietQrModal
        visible={vietQrModalVisible}
        order={selectedVietQrOrder}
        onClose={() => {
          setVietQrModalVisible(false);
          setSelectedVietQrOrder(null);
        }}
        onConfirmPaid={() => {
          message.success('Đã xác nhận khách chuyển khoản VietQR thành công!');
          loadTasksAndSummary();
        }}
      />

      {/* Sprint 3 - US-18: Modal Báo Cáo Giao Thất Bại & Hẹn Ngày Phát / Hàng Hoàn */}
      <DeliveryFailureModal
        visible={failureModalVisible}
        order={selectedFailureOrder}
        onClose={() => {
          setFailureModalVisible(false);
          setSelectedFailureOrder(null);
        }}
        onSuccess={() => {
          loadTasksAndSummary();
        }}
      />

      {/* Sprint 3 - US-17 & Sprint 4: Modal Bảng Kê Nộp Tiền Cuối Ca & PayOS VietQR */}
      <CashReconciliationModal
        visible={cashReconciliationVisible}
        onClose={() => {
          setCashReconciliationVisible(false);
          loadTasksAndSummary();
        }}
        shipperId={selectedShipperId}
      />

      {/* Sprint 3 - US-13: Modal Điều Phối Thông Minh Smart Dispatch TMS */}
      <SmartDispatchModal
        visible={smartDispatchVisible}
        onClose={() => setSmartDispatchVisible(false)}
        onSuccess={() => {
          loadTasksAndSummary();
        }}
      />

      {/* Modal Xem Chi Tiết Bằng Chứng POD Đã Lưu */}
      <Modal
        open={viewPodModalVisible}
        onCancel={() => {
          setViewPodModalVisible(false);
          setViewPodOrder(null);
        }}
        footer={null}
        width={500}
        centered
        title={
          <div className="flex items-center space-x-2 text-emerald-700">
            <CheckCircle2 size={20} />
            <span>
              {viewPodOrder?.currentStatus === 'RETURNED'
                ? `Bằng Chứng Hoàn Hàng Cho Shop #${viewPodOrder?.trackingCode}`
                : `Bằng Chứng Giao Hàng POD #${viewPodOrder?.trackingCode}`}
            </span>
          </div>
        }
      >
        <div className="space-y-3 py-2 text-xs">
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500">
                {viewPodOrder?.currentStatus === 'RETURNED' ? 'Đại diện Shop nhận hàng hoàn:' : 'Người nhận hàng:'}
              </span>
              <span className="font-bold text-gray-800">
                {viewPodOrder?.podReceiverName || (viewPodOrder?.currentStatus === 'RETURNED' ? viewPodOrder?.senderName : viewPodOrder?.receiverName)}
              </span>
            </div>
            {viewPodOrder?.currentStatus !== 'RETURNED' && (
              <div className="flex justify-between mb-1">
                <span className="text-gray-500">Hình thức thanh toán:</span>
                <span className="font-bold text-blue-700">{viewPodOrder?.paymentMethod || 'Tiền mặt (CASH)'}</span>
              </div>
            )}
            {viewPodOrder?.podLatitude && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tọa độ GPS hiện trường:</span>
                <span className="font-mono font-bold text-green-700">
                  {viewPodOrder.podLatitude.toFixed(6)}, {viewPodOrder.podLongitude?.toFixed(6)}
                </span>
              </div>
            )}
          </div>

          {viewPodOrder?.podSignatureUrl && (
            <div>
              <div className="font-bold text-gray-700 mb-1 flex items-center space-x-1">
                <PenTool size={13} className="text-blue-600" />
                <span>Chữ ký số cảm ứng của người nhận:</span>
              </div>
              <div className="border border-gray-200 rounded-xl p-2 bg-white text-center">
                <img
                  src={viewPodOrder.podSignatureUrl}
                  alt="Chữ ký POD"
                  className="max-h-28 mx-auto object-contain"
                />
              </div>
            </div>
          )}

          {viewPodOrder?.podPhotoUrl && (
            <div>
              <div className="font-bold text-gray-700 mb-1 flex items-center space-x-1">
                <Camera size={13} className="text-green-600" />
                <span>
                  {viewPodOrder?.currentStatus === 'RETURNED'
                    ? 'Ảnh chụp hiện trường bàn giao hàng hoàn cho Shop (Watermark):'
                    : 'Ảnh hiện trường đóng dấu Watermark GPS:'}
                </span>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <img
                  src={viewPodOrder.podPhotoUrl}
                  alt="Ảnh POD Watermark"
                  className="w-full max-h-60 object-cover"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button onClick={() => setViewPodModalVisible(false)}>Đóng</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
