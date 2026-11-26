import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  message,
  Popconfirm,
  Badge,
  Typography,
  Tooltip,
  Divider,
  Progress,
  Alert
} from 'antd';
import {
  Truck,
  Navigation,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Barcode,
  Trash2,
  Building2,
  RefreshCw,
  Eye,
  AlertCircle,
  FileText,
  ScanLine,
  Check,
  XCircle,
  MapPin,
  Calendar
} from 'lucide-react';
import { dispatchApi, DispatchFilterParams } from '../api/dispatch';
import { locationApi } from '../api/location';
import { truckApi } from '../api/truck';
import { useAuth } from '../context/AuthContext';
import {
  DispatchOrder,
  DispatchOrderItem,
  Warehouse,
  Truck as TruckType,
  MasterBag
} from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Âm thanh beep khi quét thành công
const playBeep = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) {}
};

export const DispatchManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dispatchOrders, setDispatchOrders] = useState<DispatchOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [trucks, setTrucks] = useState<TruckType[]>([]);

  // Filters
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedDestWarehouseId, setSelectedDestWarehouseId] = useState<number | undefined>(undefined);
  const [keyword, setKeyword] = useState<string>('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);
  const [isLoadBagModalOpen, setIsLoadBagModalOpen] = useState(false);
  const [selectedDispatch, setSelectedDispatch] = useState<DispatchOrder | null>(null);

  // Form tạo lệnh điều vận
  const [form] = Form.useForm();
  const [createLoading, setCreateLoading] = useState(false);

  // Modal tài xế quét nạp bao tải lên xe
  const [loadBagInput, setLoadBagInput] = useState('');
  const [loadBagLoading, setLoadBagLoading] = useState(false);
  const loadBagInputRef = useRef<any>(null);

  // Modal quét nhập kho đích
  const [inboundScanCode, setInboundScanCode] = useState('');
  const [inboundLoading, setInboundLoading] = useState(false);
  const inboundInputRef = useRef<any>(null);

  const userWarehouseId = user?.assignedPostOfficeId || (user as any)?.warehouseId;
  const userRoles: string[] = user?.roles || [];
  const isDriverOnly = userRoles.includes('ROLE_TRUCK_DRIVER') &&
    !userRoles.some(r => ['ROLE_ADMIN', 'ROLE_BRANCH_MANAGER', 'ROLE_POST_OFFICE_MANAGER', 'ROLE_WAREHOUSE_STAFF'].includes(r));
  const canCreateDispatch = !isDriverOnly;

  // Load danh mục
  const fetchMetadata = async () => {
    try {
      const [whList, driversRes, trucksRes] = await Promise.all([
        locationApi.getWarehouses(),
        truckApi.getTruckDrivers(),
        truckApi.getTrucks()
      ]);
      if (Array.isArray(whList)) setWarehouses(whList);
      if (driversRes.success) setDrivers(driversRes.data);
      if (trucksRes.success) setTrucks(trucksRes.data);
    } catch (e) {
      console.error('Lỗi nạp metadata:', e);
    }
  };

  // Load danh sách lệnh điều vận
  const fetchDispatchOrders = async () => {
    try {
      setLoading(true);
      const params: DispatchFilterParams = {};

      if (selectedStatus && selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      if (selectedDestWarehouseId) {
        params.destWarehouseId = selectedDestWarehouseId;
      }
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      // Nếu không phải admin thì ưu tiên lọc theo kho của user nếu có
      if (userWarehouseId && !user?.roles?.includes('ROLE_ADMIN')) {
        params.originWarehouseId = userWarehouseId;
      }

      const res = await dispatchApi.getDispatchOrders(params);
      if (res.success) {
        setDispatchOrders(res.data);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải danh sách lệnh điều vận');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchDispatchOrders();
  }, [dateRange, selectedStatus, selectedDestWarehouseId]);

  // Sinh mã điều động ngẫu nhiên
  const generateNewDispatchCode = () => {
    const today = dayjs().format('YYMMDD');
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    return `DO${today}-${randomSeq}`;
  };

  // Mở modal tạo mới
  const handleOpenCreateModal = () => {
    form.resetFields();
    const defaultCode = generateNewDispatchCode();

    form.setFieldsValue({
      dispatchCode: defaultCode,
      originWarehouseId: userWarehouseId || (warehouses[0]?.id),
      destWarehouseId: undefined,
      driverId: undefined,
      truckId: undefined,
      departureTime: dayjs(),
      notes: ''
    });

    setIsCreateModalOpen(true);
  };

  // Submit tạo mới lệnh điều vận (Quản lý kho tạo lệnh - Bỏ quét bao tải)
  const handleCreateSubmit = async (values: any) => {
    try {
      setCreateLoading(true);
      const payload = {
        originWarehouseId: values.originWarehouseId,
        destWarehouseId: values.destWarehouseId,
        driverId: values.driverId,
        truckId: values.truckId,
        notes: values.notes,
        departureTime: values.departureTime ? values.departureTime.toISOString() : undefined,
        bagCodes: [] // Mặc định tạo lệnh chưa có bao tải, tài xế sẽ quét mã nạp bao khi thực hiện
      };

      const res = await dispatchApi.createDispatchOrder(payload);
      if (res.success) {
        message.success(`Khởi tạo lệnh điều vận [${res.data.dispatchCode}] thành công! Lệnh đã được gán cho tài xế.`);
        setIsCreateModalOpen(false);
        fetchDispatchOrders();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo lệnh điều vận');
    } finally {
      setCreateLoading(false);
    }
  };

  // Mở modal tài xế quét nạp bao tải lên xe
  const handleOpenLoadBagModal = (dispatch: DispatchOrder) => {
    setSelectedDispatch(dispatch);
    setLoadBagInput('');
    setIsLoadBagModalOpen(true);
    setTimeout(() => {
      loadBagInputRef.current?.focus();
    }, 200);
  };

  // Tài xế thực hiện quét nạp bao tải vào chuyến xe
  const handleLoadBagSubmit = async (codeToScan?: string) => {
    if (!selectedDispatch) return;
    const code = (codeToScan || loadBagInput).trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng nhập hoặc quét mã bao tải!');
      return;
    }

    try {
      setLoadBagLoading(true);
      const res = await dispatchApi.loadBag(selectedDispatch.id, code);
      if (res.success) {
        playBeep();
        message.success(`Đã nạp bao tải [${code}] lên chuyến xe điều vận thành công!`);
        setSelectedDispatch(res.data);
        setLoadBagInput('');
        fetchDispatchOrders();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Nạp bao tải lên chuyến xe thất bại');
    } finally {
      setLoadBagLoading(false);
      setTimeout(() => {
        loadBagInputRef.current?.focus();
      }, 100);
    }
  };

  // Cập nhật trạng thái chuyến xe (Quy tắc nghiêm ngặt)
  const handleUpdateStatus = async (dispatch: DispatchOrder, targetStatus: string) => {
    try {
      const res = await dispatchApi.updateDispatchStatus(dispatch.id, {
        status: targetStatus,
        notes: `Cập nhật sang trạng thái ${targetStatus} bởi ${user?.fullName || 'Người dùng'}`
      });
      if (res.success) {
        message.success(`Đã chuyển trạng thái chuyến xe [${dispatch.dispatchCode}] sang: ${res.data.statusDescription}`);
        fetchDispatchOrders();
        if (selectedDispatch && selectedDispatch.id === dispatch.id) {
          setSelectedDispatch(res.data);
        }
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi cập nhật trạng thái');
    }
  };

  // Mở modal quét nhập kho đích
  const handleOpenInboundModal = (dispatch: DispatchOrder) => {
    setSelectedDispatch(dispatch);
    setInboundScanCode('');
    setIsInboundModalOpen(true);
    setTimeout(() => {
      inboundInputRef.current?.focus();
    }, 200);
  };

  // Thực hiện quét nhận bao tải tại Hub đích
  const handleScanInboundSubmit = async (codeToScan?: string) => {
    if (!selectedDispatch) return;
    const code = (codeToScan || inboundScanCode).trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng nhập hoặc quét mã bao tải!');
      return;
    }

    try {
      setInboundLoading(true);
      const res = await dispatchApi.scanBagInbound(selectedDispatch.id, code);
      if (res.success) {
        playBeep();
        message.success(`Quét tiếp nhận bao tải [${code}] thành công! Toàn bộ đơn hàng đã tự động nhập kho đích.`);
        setSelectedDispatch(res.data);
        setInboundScanCode('');
        fetchDispatchOrders();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Quét nhận bao tải thất bại');
    } finally {
      setInboundLoading(false);
      setTimeout(() => {
        inboundInputRef.current?.focus();
      }, 100);
    }
  };

  // Thống kê nhanh KPI
  const totalDispatches = dispatchOrders.length;
  const pickedUpCount = dispatchOrders.filter(d => d.status === 'PICKED_UP').length;
  const inTransitCount = dispatchOrders.filter(d => d.status === 'IN_TRANSIT').length;
  const completedCount = dispatchOrders.filter(d => d.status === 'COMPLETED').length;
  const totalBagsCoordinated = dispatchOrders.reduce((sum, d) => sum + (d.totalBags || 0), 0);

  // Bộ lọc theo từ khóa tìm kiếm
  const filteredDispatches = dispatchOrders.filter(d => {
    if (!keyword.trim()) return true;
    const kw = keyword.toLowerCase();
    return (
      d.dispatchCode.toLowerCase().includes(kw) ||
      (d.driverName && d.driverName.toLowerCase().includes(kw)) ||
      (d.truckPlate && d.truckPlate.toLowerCase().includes(kw)) ||
      (d.originWarehouseName && d.originWarehouseName.toLowerCase().includes(kw)) ||
      (d.destWarehouseName && d.destWarehouseName.toLowerCase().includes(kw))
    );
  });

  // Cột bảng danh sách
  const columns = [
    {
      title: 'Mã Điều Động',
      dataIndex: 'dispatchCode',
      key: 'dispatchCode',
      render: (code: string, record: DispatchOrder) => (
        <div className="space-y-1">
          <Tag color="geekblue" className="font-mono font-bold text-xs px-2 py-0.5">
            {code}
          </Tag>
          <div className="text-[11px] text-gray-400">
            {dayjs(record.createdAt).format('HH:mm DD/MM/YYYY')}
          </div>
        </div>
      )
    },
    {
      title: 'Tuyến Trung Chuyển (Kho đi -> Kho đến)',
      key: 'route',
      render: (_: any, record: DispatchOrder) => (
        <div className="text-xs">
          <div className="font-bold text-gray-800 flex items-center gap-1.5">
            <Building2 size={13} className="text-blue-600 flex-shrink-0" />
            <span>{record.originWarehouseName}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400 my-0.5 ml-3 font-semibold">
            <ArrowRight size={12} className="text-orange-500" />
            <span className="text-[11px]">chuyển tiếp tới</span>
          </div>
          <div className="font-bold text-purple-700 flex items-center gap-1.5">
            <MapPin size={13} className="text-purple-600 flex-shrink-0" />
            <span>{record.destWarehouseName}</span>
          </div>
        </div>
      )
    },
    {
      title: 'Tài Xế & Xe Tải',
      key: 'driver',
      render: (_: any, record: DispatchOrder) => (
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-gray-800 flex items-center gap-1">
            <Truck size={14} className="text-indigo-600" />
            <span>{record.driverName || 'Chưa gán'}</span>
          </div>
          {record.driverPhone && (
            <div className="text-gray-500 text-[11px]">SĐT: {record.driverPhone}</div>
          )}
          {record.truckPlate && (
            <Tag color="cyan" className="font-mono text-[11px] font-bold">
              🚛 {record.truckPlate}
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Bao Hàng / Kiện',
      key: 'bags',
      render: (_: any, record: DispatchOrder) => {
        const receivedCount = record.items?.filter(it => it.isReceivedAtDest)?.length || 0;
        return (
          <div className="text-xs space-y-1">
            <div className="font-bold text-blue-700">
              {record.totalBags || 0} bao tải
              <span className="text-gray-500 font-normal"> ({record.totalItems || 0} đơn)</span>
            </div>
            <div className="text-[11px] text-gray-500">
              Khối lượng: <span className="font-semibold">{record.totalWeightKg || 0} kg</span>
            </div>
            {record.status === 'IN_TRANSIT' && record.totalBags > 0 && (
              <Progress
                percent={Math.round((receivedCount / record.totalBags) * 100)}
                size="small"
                status={receivedCount === record.totalBags ? 'success' : 'active'}
                format={() => `${receivedCount}/${record.totalBags} bao`}
              />
            )}
          </div>
        );
      }
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: DispatchOrder) => {
        let color = 'default';
        let icon = <Clock size={12} />;

        switch (status) {
          case 'PICKED_UP':
            color = 'blue';
            icon = <Check size={12} />;
            break;
          case 'IN_TRANSIT':
            color = 'orange';
            icon = <Truck size={12} />;
            break;
          case 'COMPLETED':
            color = 'success';
            icon = <CheckCircle2 size={12} />;
            break;
          case 'CANCELLED':
            color = 'error';
            icon = <XCircle size={12} />;
            break;
        }

        return (
          <div className="space-y-1">
            <Tag color={color} className="font-bold flex items-center gap-1 w-max">
              {icon} {record.statusDescription}
            </Tag>
            {record.departureTime && (
              <div className="text-[10px] text-gray-400">
                Xuất phát: {dayjs(record.departureTime).format('HH:mm DD/MM')}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      render: (_: any, record: DispatchOrder) => {
        const totalBags = record.totalBags || 0;
        const receivedCount = record.items?.filter(it => it.isReceivedAtDest)?.length || 0;
        const allReceived = totalBags > 0 && receivedCount === totalBags;

        return (
          <Space direction="vertical" size={2}>
            <Button
              size="small"
              icon={<Eye size={13} />}
              onClick={() => {
                setSelectedDispatch(record);
                setIsDetailModalOpen(true);
              }}
            >
              Chi tiết
            </Button>

            {/* Nút tài xế thực hiện quét nạp bao tải lên xe */}
            {['PICKED_UP', 'IN_TRANSIT'].includes(record.status) && (
              <Button
                size="small"
                type="primary"
                icon={<Barcode size={13} />}
                className="bg-blue-600 hover:bg-blue-700 font-bold"
                onClick={() => handleOpenLoadBagModal(record)}
              >
                📦 Quét nạp bao tải lên xe
              </Button>
            )}

            {/* Nút xuất phát đi giao (nếu đang PICKED_UP) */}
            {record.status === 'PICKED_UP' && (
              <Popconfirm
                title="Xuất phát chuyến xe"
                description={`Xác nhận tài xế ${record.driverName} đã chất hàng và bắt đầu xuất bến đi giao?`}
                onConfirm={() => handleUpdateStatus(record, 'IN_TRANSIT')}
                okText="Xuất bến ngay"
                cancelText="Hủy"
              >
                <Button size="small" type="primary" className="bg-orange-500 hover:bg-orange-600 font-bold">
                  🚚 Xuất bến đi giao
                </Button>
              </Popconfirm>
            )}

            {/* Nút quét nhập kho tại Hub đích */}
            {(record.status === 'IN_TRANSIT' || record.status === 'PICKED_UP') && (
              <Button
                size="small"
                type="primary"
                icon={<ScanLine size={13} />}
                className="bg-purple-600 hover:bg-purple-700 font-bold"
                onClick={() => handleOpenInboundModal(record)}
              >
                Quét nhận tại Hub đích
              </Button>
            )}

            {/* Nút hoàn thành chuyến đi: CHỈ CHO PHÉP khi tất cả bao tải đã được nhập hết vào kho đích */}
            {record.status === 'IN_TRANSIT' && (
              allReceived ? (
                <Popconfirm
                  title="Xác nhận hoàn thành chuyến xe"
                  description={`Toàn bộ ${totalBags} bao tải trên xe đã được kho đích [${record.destWarehouseName}] quét tiếp nhận nhập kho đầy đủ. Xác nhận hoàn tất chuyến đi?`}
                  onConfirm={() => handleUpdateStatus(record, 'COMPLETED')}
                  okText="Hoàn thành chuyến đi"
                  cancelText="Hủy"
                >
                  <Button size="small" type="primary" className="bg-green-600 hover:bg-green-700 font-bold">
                    ✅ Hoàn thành chuyến đi
                  </Button>
                </Popconfirm>
              ) : (
                <Tooltip
                  title={
                    totalBags === 0
                      ? 'Chưa thể hoàn thành: Chuyến xe chưa nạp bao tải nào!'
                      : `Chưa thể hoàn thành chuyến đi! Còn ${totalBags - receivedCount} bao tải chưa được kho đích [${record.destWarehouseName}] quét tiếp nhận nhập kho.`
                  }
                >
                  <Button size="small" disabled className="font-bold opacity-60 cursor-not-allowed">
                    ⏳ Chờ kho đích nhận ({receivedCount}/{totalBags} bao)
                  </Button>
                </Tooltip>
              )
            )}

            {/* Nút hủy lệnh (chỉ khi đang PICKED_UP và là Quản lý/Admin) */}
            {record.status === 'PICKED_UP' && canCreateDispatch && (
              <Popconfirm
                title="Hủy lệnh điều vận"
                description="Bạn có chắc chắn muốn hủy chuyến xe điều vận này? Các bao tải sẽ được trả lại trạng thái sẵn sàng."
                onConfirm={() => handleUpdateStatus(record, 'CANCELLED')}
                okText="Hủy chuyến"
                cancelText="Đóng"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger type="text">
                  Hủy lệnh
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Truck size={28} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-gray-800 flex items-center gap-2">
              Quản Lý Điều Vận Xe & Chuyến Xe Trung Chuyển (Transport Dispatch)
            </Title>
            <Text type="secondary" className="text-xs">
              Điều phối chuyến xe tải gom các bao hàng theo từng Hub trung chuyển tỉnh / miền và tiếp nhận tại kho đích
            </Text>
          </div>
        </div>

        <Space>
          <Button icon={<RefreshCw size={15} />} onClick={fetchDispatchOrders} loading={loading}>
            Làm mới
          </Button>
          {canCreateDispatch && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={handleOpenCreateModal}
              className="bg-purple-600 hover:bg-purple-700 font-bold h-10 px-5 rounded-xl shadow-md"
            >
              + Tạo Lệnh Điều Vận Chuyến Xe
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-white p-2">
            <div className="text-gray-500 text-xs font-semibold uppercase">Tổng chuyến điều vận</div>
            <div className="text-2xl font-black text-gray-800 mt-1">{totalDispatches}</div>
            <div className="text-[11px] text-gray-400">Trên toàn hệ thống</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-blue-100 shadow-xs bg-blue-50/50 p-2 border">
            <div className="text-blue-700 text-xs font-semibold uppercase">Đã nhận hàng tại kho</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{pickedUpCount}</div>
            <div className="text-[11px] text-blue-600">Đang chuẩn bị xuất bến</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-orange-100 shadow-xs bg-orange-50/50 p-2 border">
            <div className="text-orange-700 text-xs font-semibold uppercase">Đang đi giao</div>
            <div className="text-2xl font-black text-orange-700 mt-1">{inTransitCount}</div>
            <div className="text-[11px] text-orange-600">Đang trên đường tới Hub đích</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-green-100 shadow-xs bg-green-50/50 p-2 border">
            <div className="text-green-700 text-xs font-semibold uppercase">Đã giao xong</div>
            <div className="text-2xl font-black text-green-700 mt-1">{completedCount}</div>
            <div className="text-[11px] text-green-600">Hoàn tất nhập kho đích</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card className="rounded-2xl border-purple-100 shadow-xs bg-purple-50/50 p-2 border">
            <div className="text-purple-700 text-xs font-semibold uppercase">Tổng bao tải</div>
            <div className="text-2xl font-black text-purple-700 mt-1">{totalBagsCoordinated}</div>
            <div className="text-[11px] text-purple-600">Bao hàng luân chuyển</div>
          </Card>
        </Col>
      </Row>

      {/* Bộ lọc & Tìm kiếm */}
      <Card className="rounded-2xl shadow-xs border-gray-100">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <Input
              prefix={<Search size={16} className="text-gray-400" />}
              placeholder="Tìm theo mã điều động, tài xế, biển số xe, tên kho..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              allowClear
              className="w-full md:w-72 rounded-lg"
            />

            <RangePicker
              value={dateRange}
              onChange={val => setDateRange(val)}
              format="DD/MM/YYYY"
              placeholder={['Từ ngày', 'Đến ngày']}
              className="rounded-lg"
            />

            <Select
              value={selectedStatus}
              onChange={val => setSelectedStatus(val)}
              className="w-44 rounded-lg"
              options={[
                { label: 'Tất cả trạng thái', value: 'ALL' },
                { label: '📦 Đã nhận hàng tại kho', value: 'PICKED_UP' },
                { label: '🚚 Đang đi giao', value: 'IN_TRANSIT' },
                { label: '✅ Đã giao xong', value: 'COMPLETED' },
                { label: '❌ Đã hủy', value: 'CANCELLED' }
              ]}
            />

            <Select
              placeholder="Lọc theo Hub đích đến"
              allowClear
              value={selectedDestWarehouseId}
              onChange={val => setSelectedDestWarehouseId(val)}
              className="w-60 rounded-lg"
              options={warehouses
                .filter(w => w.type === 'HUB' || w.type === 'REGIONAL_HUB')
                .map(w => ({
                  label: `${w.type === 'REGIONAL_HUB' ? '🌐' : '🏢'} ${w.name}`,
                  value: w.id
                }))}
            />
          </div>
        </div>

        <Table
          dataSource={filteredDispatches}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8, showSizeChanger: true }}
          className="rounded-xl overflow-hidden"
        />
      </Card>

      {/* ================= MODAL TẠO LỆNH ĐIỀU VẬN MỚI ================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-gray-800">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <Truck size={18} />
            </div>
            <span>Khởi Tạo Lệnh Điều Vận Xe & Gom Bao Hàng Mới</span>
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={850}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSubmit} className="mt-4 space-y-4">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Mã Lệnh Điều Động (Tự sinh)</span>}
                name="dispatchCode"
              >
                <Input disabled className="font-mono font-bold text-blue-700 bg-gray-50 rounded-lg text-base" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Thời gian dự kiến xuất bến</span>}
                name="departureTime"
                rules={[{ required: true, message: 'Vui lòng chọn thời gian xuất bến' }]}
              >
                <DatePicker showTime format="HH:mm DD/MM/YYYY" className="w-full rounded-lg" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Kho / Hub Xuất Phát (Nơi xuất xe)</span>}
                name="originWarehouseId"
                rules={[{ required: true, message: 'Vui lòng chọn kho xuất phát' }]}
              >
                <Select
                  placeholder="Chọn kho xuất phát"
                  disabled={!user?.roles?.includes('ROLE_ADMIN') && !!userWarehouseId}
                  options={warehouses.map(w => ({
                    label: `${w.type === 'REGIONAL_HUB' ? '🌐' : w.type === 'HUB' ? '🏢' : '🛵'} ${w.name}`,
                    value: w.id
                  }))}
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Kho / Hub Đích Đến (Nơi tiếp nhận)</span>}
                name="destWarehouseId"
                rules={[{ required: true, message: 'Vui lòng chọn kho đích đến' }]}
              >
                <Select
                  placeholder="Chọn Hub tỉnh / miền đích đến"
                  options={warehouses
                    .filter(w => w.type === 'HUB' || w.type === 'REGIONAL_HUB')
                    .map(w => ({
                      label: `${w.type === 'REGIONAL_HUB' ? '🌐' : '🏢'} ${w.name} (${w.type === 'REGIONAL_HUB' ? 'KHO MIỀN' : 'HUB TỈNH'})`,
                      value: w.id
                    }))}
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Tài xế nhận lệnh chuyến xe</span>}
                name="driverId"
                rules={[{ required: true, message: 'Vui lòng chọn tài xế nhận lệnh' }]}
              >
                <Select
                  placeholder="Chọn tài xế xe tải (ROLE_TRUCK_DRIVER)"
                  options={drivers.map(d => ({
                    label: `👨‍✈️ ${d.fullName} (SĐT: ${d.phoneNumber || 'N/A'})`,
                    value: d.id
                  }))}
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Xe ô tô tải điều phối</span>}
                name="truckId"
              >
                <Select
                  placeholder="Chọn xe tải (Tùy chọn)"
                  allowClear
                  options={trucks.map(t => ({
                    label: `🚛 ${t.licensePlate} (${t.truckType} - ${t.payloadKg}kg) [${t.status}]`,
                    value: t.id
                  }))}
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={<span className="font-semibold text-gray-700">Ghi chú chuyến xe</span>} name="notes">
            <Input.TextArea rows={2} placeholder="Ghi chú về hàng hóa, hướng dẫn bàn giao tại Hub đích..." className="rounded-lg" />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setIsCreateModalOpen(false)}>Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={createLoading}
              className="bg-purple-600 hover:bg-purple-700 font-bold px-6"
            >
              🚀 Khởi Tạo Lệnh Điều Vận
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ================= MODAL TÀI XẾ QUÉT MÃ BAO TẢI LÊN XE MANG ĐI ================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-blue-700">
            <Barcode size={20} className="text-blue-600" />
            <span>Tài Xế Quét Mã Bao Tải Nạp Lên Xe [{selectedDispatch?.dispatchCode}]</span>
          </div>
        }
        open={isLoadBagModalOpen}
        onCancel={() => setIsLoadBagModalOpen(false)}
        footer={null}
        width={750}
        destroyOnClose
      >
        {selectedDispatch && (
          <div className="space-y-4 mt-2">
            <Alert
              message={
                <div>
                  Chuyến xe: <b className="font-mono text-blue-700">{selectedDispatch.dispatchCode}</b> | Tuyến:{' '}
                  <b>{selectedDispatch.originWarehouseName}</b> → <b>{selectedDispatch.destWarehouseName}</b>
                </div>
              }
              description="Tài xế dùng súng quét mã barcode hoặc nhập mã bao tải / mã seal kẹp chì để nạp bao lên xe. Khi quét nạp, bao tải sẽ tự động chuyển sang trạng thái Đang trung chuyển (IN_TRANSIT) và gán cho bạn."
              type="info"
              showIcon
              className="rounded-xl"
            />

            {/* Ô quét Barcode lớn */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl space-y-2">
              <label className="text-xs font-extrabold text-blue-900 uppercase tracking-wide block">
                Bắn Súng Quét Barcode Mã Bao Tải Hoặc Mã Kẹp Chì (Seal):
              </label>
              <div className="flex items-center gap-2">
                <Input
                  ref={loadBagInputRef}
                  prefix={<Barcode size={20} className="text-blue-600" />}
                  placeholder="Quét mã bao tải (VD: BAG2611...) rồi nhấn Enter..."
                  value={loadBagInput}
                  onChange={e => setLoadBagInput(e.target.value)}
                  onPressEnter={() => handleLoadBagSubmit()}
                  className="font-mono font-bold text-lg h-12 uppercase"
                  autoFocus
                  disabled={loadBagLoading}
                />
                <Button
                  type="primary"
                  onClick={() => handleLoadBagSubmit()}
                  loading={loadBagLoading}
                  className="bg-blue-600 hover:bg-blue-700 h-12 px-6 font-bold"
                >
                  Nạp Vào Xe
                </Button>
              </div>
            </div>

            {/* Thống kê bao tải hiện có trên xe */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">
                Tổng số bao tải đã nạp lên xe:
              </span>
              <span className="text-xs font-bold text-blue-700">
                {selectedDispatch.items ? selectedDispatch.items.length : 0} bao tải | {selectedDispatch.totalWeightKg || 0} kg
              </span>
            </div>

            {/* Bảng danh sách bao tải đã nạp */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 font-bold text-gray-700 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">STT</th>
                      <th className="p-2 text-left">Mã Bao Tải</th>
                      <th className="p-2 text-left">Mã Seal Chì</th>
                      <th className="p-2 text-center">Số Kiện</th>
                      <th className="p-2 text-right">Khối Lượng</th>
                      <th className="p-2 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!selectedDispatch.items || selectedDispatch.items.length === 0) ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-400">
                          Chưa có bao tải nào được nạp lên chuyến xe này. Hãy quét mã bao tải ở trên.
                        </td>
                      </tr>
                    ) : (
                      selectedDispatch.items.map((it, idx) => (
                        <tr key={it.id || idx} className="border-t border-gray-100 hover:bg-blue-50/30">
                          <td className="p-2 font-mono text-gray-500">{idx + 1}</td>
                          <td className="p-2 font-mono font-bold text-blue-700">{it.bagCode}</td>
                          <td className="p-2 font-mono text-gray-600">{it.sealNumber || 'N/A'}</td>
                          <td className="p-2 text-center font-semibold">{it.totalItems} đơn</td>
                          <td className="p-2 text-right font-medium">{it.weightKg} kg</td>
                          <td className="p-2 text-center">
                            {it.isReceivedAtDest ? (
                              <Tag color="success">Đã nhập kho đích</Tag>
                            ) : (
                              <Tag color="blue">Đang trên xe</Tag>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setIsLoadBagModalOpen(false)}>Đóng</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= MODAL QUÉT NHẬP KHO TẠI HUB ĐÍCH ================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-purple-800">
            <ScanLine size={20} className="text-purple-600" />
            <span>Tiếp Nhận & Quét Nhập Kho Bao Tải Tại Hub Đích</span>
          </div>
        }
        open={isInboundModalOpen}
        onCancel={() => setIsInboundModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedDispatch && (
          <div className="space-y-4 mt-2">
            <Alert
              message={
                <div>
                  Chuyến xe điều vận: <b className="font-mono text-blue-700">{selectedDispatch.dispatchCode}</b> | Kho đi: <b>{selectedDispatch.originWarehouseName}</b> → Kho đích: <b>{selectedDispatch.destWarehouseName}</b>
                </div>
              }
              description="Khi dùng súng quét mã vạch bắn vào tem bao tải hoặc kẹp chì, hệ thống sẽ tự động cập nhật trạng thái bao tải và tự động nhập toàn bộ các đơn hàng bên trong vào kho đích."
              type="info"
              showIcon
              className="rounded-xl"
            />

            {/* Ô quét Barcode lớn */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl space-y-2">
              <label className="text-xs font-extrabold text-purple-900 uppercase tracking-wide block">
                Bắn Súng Quét Barcode Mã Bao Tải Hoặc Mã Seal (Enter):
              </label>
              <div className="flex items-center gap-2">
                <Input
                  ref={inboundInputRef}
                  prefix={<Barcode size={20} className="text-purple-600" />}
                  placeholder="Quét mã bao tải (VD: BAG2611...) rồi nhấn Enter..."
                  value={inboundScanCode}
                  onChange={e => setInboundScanCode(e.target.value)}
                  onPressEnter={() => handleScanInboundSubmit()}
                  className="font-mono font-bold text-lg h-12 uppercase"
                  autoFocus
                />
                <Button
                  type="primary"
                  onClick={() => handleScanInboundSubmit()}
                  loading={inboundLoading}
                  className="bg-purple-600 hover:bg-purple-700 h-12 px-6 font-bold"
                >
                  Xác Nhận Nhập
                </Button>
              </div>
            </div>

            {/* Tiến độ tiếp nhận */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">
                Tiến độ bàn giao chuyến xe:
              </span>
              <span className="text-xs font-bold text-purple-700">
                {selectedDispatch.items.filter(it => it.isReceivedAtDest).length} / {selectedDispatch.totalBags} bao đã nhập kho
              </span>
            </div>

            {/* Danh sách bao tải và trạng thái nhận */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100 font-bold text-gray-700">
                  <tr>
                    <th className="p-2 text-left">Mã Bao Tải</th>
                    <th className="p-2 text-left">Mã Seal</th>
                    <th className="p-2 text-center">Số Kiện</th>
                    <th className="p-2 text-center">Trạng Thái Nhập Kho Đích</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDispatch.items.map(it => (
                    <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-2 font-mono font-bold text-blue-700">{it.bagCode}</td>
                      <td className="p-2 font-mono text-gray-600">{it.sealNumber || 'N/A'}</td>
                      <td className="p-2 text-center font-semibold">{it.totalItems} đơn</td>
                      <td className="p-2 text-center">
                        {it.isReceivedAtDest ? (
                          <Tag color="success" className="font-bold">
                            ✅ Đã nhập kho lúc {dayjs(it.receivedAt).format('HH:mm DD/MM')}
                          </Tag>
                        ) : (
                          <Tag color="warning" className="font-bold">
                            ⏳ Chờ quét nhận
                          </Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setIsInboundModalOpen(false)}>Đóng</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ================= MODAL CHI TIẾT LỆNH ĐIỀU VẬN ================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-gray-800">
            <FileText size={18} className="text-blue-600" />
            <span>Chi Tiết Lệnh Điều Vận Chuyến Xe [{selectedDispatch?.dispatchCode}]</span>
          </div>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={null}
        width={750}
      >
        {selectedDispatch && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 block">Kho xuất phát (Gom hàng):</span>
                <span className="font-bold text-gray-800 text-sm">{selectedDispatch.originWarehouseName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Kho đích đến (Tiếp nhận):</span>
                <span className="font-bold text-purple-700 text-sm">{selectedDispatch.destWarehouseName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Tài xế phụ trách:</span>
                <span className="font-bold text-gray-800">{selectedDispatch.driverName}</span>
                <span className="text-gray-500"> ({selectedDispatch.driverPhone || 'N/A'})</span>
              </div>
              <div>
                <span className="text-gray-500 block">Xe tải vận chuyển:</span>
                <span className="font-bold text-gray-800">{selectedDispatch.truckPlate || 'Chưa gán xe'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Thời gian tạo:</span>
                <span className="font-medium text-gray-700">{dayjs(selectedDispatch.createdAt).format('HH:mm DD/MM/YYYY')}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Trạng thái chuyến đi:</span>
                <Tag color={selectedDispatch.status === 'COMPLETED' ? 'success' : selectedDispatch.status === 'IN_TRANSIT' ? 'orange' : 'blue'} className="font-bold">
                  {selectedDispatch.statusDescription}
                </Tag>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-3 bg-gray-100 font-bold text-xs text-gray-700 flex justify-between">
                <span>Danh Sách {selectedDispatch.items.length} Bao Tải Trong Chuyến Xe:</span>
                <span>Tổng khối lượng: {selectedDispatch.totalWeightKg} kg</span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                  <tr>
                    <th className="p-2 text-left">Mã Bao Tải</th>
                    <th className="p-2 text-left">Mã Kẹp Chì</th>
                    <th className="p-2 text-center">Số Đơn</th>
                    <th className="p-2 text-right">Khối Lượng</th>
                    <th className="p-2 text-center">Bàn Giao Tại Đích</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDispatch.items.map(it => (
                    <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-2 font-mono font-bold text-blue-700">{it.bagCode}</td>
                      <td className="p-2 font-mono text-gray-600">{it.sealNumber || 'N/A'}</td>
                      <td className="p-2 text-center font-semibold">{it.totalItems}</td>
                      <td className="p-2 text-right">{it.weightKg} kg</td>
                      <td className="p-2 text-center">
                        {it.isReceivedAtDest ? (
                          <Tag color="success">Đã nhập kho ({dayjs(it.receivedAt).format('HH:mm DD/MM')})</Tag>
                        ) : (
                          <Tag color="warning">Chưa nhập kho</Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setIsDetailModalOpen(false)}>Đóng</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DispatchManagementPage;
