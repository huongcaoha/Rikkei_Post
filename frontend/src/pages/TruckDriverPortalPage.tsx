import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Input,
  Space,
  Row,
  Col,
  Statistic,
  message,
  Tabs,
  Alert,
  Modal,
  Typography
} from 'antd';
import {
  CarOutlined,
  BarcodeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ArrowRightOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { wmsApi } from '../api/wms';
import { MasterBag } from '../types';
import { useAuth } from '../context/AuthContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';

const { Title, Text } = Typography;

export const TruckDriverPortalPage: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<MasterBag[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');

  // Quét nhận bao tải
  const [scanCode, setScanCode] = useState('');
  const [scanning, setScanning] = useState(false);

  // Chi tiết bao tải
  const [selectedBag, setSelectedBag] = useState<MasterBag | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  const fetchDriverTasks = async () => {
    try {
      setLoading(true);
      const data = await wmsApi.getDriverTasks(user?.id);
      setTasks(data || []);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải danh sách nhiệm vụ tài xế');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverTasks();
  }, [user]);

  // Lắng nghe realtime khi được gán bao tải mới
  useOrderWebSocket({
    onEvent: (event) => {
      if (
        event.type === 'BAG_ASSIGNED_TO_DRIVER' ||
        event.type === 'MASTER_BAG_IN_TRANSIT' ||
        event.type === 'MASTER_BAG_ARRIVED_AT_HUB'
      ) {
        fetchDriverTasks();
      }
    },
    showNotification: true,
  });

  const handleScanTransit = async (codeToScan?: string) => {
    const code = (codeToScan || scanCode).trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng nhập hoặc quét mã bao tải!');
      return;
    }

    setScanning(true);
    try {
      const res = await wmsApi.driverScanTransit(code);
      message.success(`Đã quét nhận bao tải [${res.bagCode}] lên xe thành công! Toàn bộ đơn hàng đã chuyển sang trạng thái đang trung chuyển qua Kafka.`);
      setScanCode('');
      fetchDriverTasks();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Lỗi quét nhận bao tải';
      message.error(errMsg);
    } finally {
      setScanning(false);
    }
  };

  const handleOpenDetail = async (bag: MasterBag) => {
    try {
      const detail = await wmsApi.getBagById(bag.id);
      setSelectedBag(detail);
      setDetailModalOpen(true);
    } catch (err: any) {
      setSelectedBag(bag);
      setDetailModalOpen(true);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'WAITING') return ['SEALED', 'ASSIGNED_TO_DRIVER'].includes(t.status);
    if (activeTab === 'TRANSIT') return t.status === 'IN_TRANSIT';
    if (activeTab === 'COMPLETED') return ['ARRIVED_AT_HUB', 'UNSEALED', 'RECEIVED'].includes(t.status);
    return true;
  });

  const waitingCount = tasks.filter(t => ['SEALED', 'ASSIGNED_TO_DRIVER'].includes(t.status)).length;
  const transitCount = tasks.filter(t => t.status === 'IN_TRANSIT').length;
  const completedCount = tasks.filter(t => ['ARRIVED_AT_HUB', 'UNSEALED', 'RECEIVED'].includes(t.status)).length;

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'SEALED':
      case 'ASSIGNED_TO_DRIVER':
        return <Tag color="gold" icon={<ClockCircleOutlined />}>Chờ tài xế lấy</Tag>;
      case 'IN_TRANSIT':
        return <Tag color="blue" icon={<SyncOutlined spin />}>Đang trên xe trung chuyển</Tag>;
      case 'ARRIVED_AT_HUB':
        return <Tag color="cyan" icon={<CheckCircleOutlined />}>Đã đến kho Hub</Tag>;
      case 'UNSEALED':
      case 'RECEIVED':
        return <Tag color="green" icon={<CheckCircleOutlined />}>Đã bàn giao hoàn tất</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Mã Bao Tải & Kẹp Chì',
      key: 'bagInfo',
      render: (_: any, r: MasterBag) => (
        <div>
          <span className="font-mono font-bold text-blue-700 text-base">{r.bagCode}</span>
          {r.sealNumber && (
            <div className="mt-1">
              <Tag color="volcano" className="font-mono text-xs">Seal: {r.sealNumber}</Tag>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Lộ Trình Vận Chuyển',
      key: 'route',
      render: (_: any, r: MasterBag) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-800 flex items-center gap-1">
              <EnvironmentOutlined className="text-gray-400" /> {r.originWarehouseName}
            </span>
            <ArrowRightOutlined className="text-gray-400" />
            <span className="font-bold text-red-600 flex items-center gap-1">
              <EnvironmentOutlined className="text-red-500" /> {r.destWarehouseName}
            </span>
          </div>
          {r.assignedTruckPlate && (
            <div className="text-xs text-gray-500">
              Xe tải chuyên chở: <Tag color="gold" className="font-bold">{r.assignedTruckPlate}</Tag>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Số Kiện & Tải trọng',
      key: 'cargo',
      render: (_: any, r: MasterBag) => (
        <div>
          <div className="font-bold text-gray-900">{r.totalItems} kiện hàng</div>
          <div className="text-xs text-gray-500">{Number(r.totalWeightKg).toFixed(2)} kg</div>
        </div>
      )
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => renderStatusTag(st)
    },
    {
      title: 'Thao Tác Tác Nghiệp',
      key: 'actions',
      render: (_: any, r: MasterBag) => (
        <Space size="small">
          {['SEALED', 'ASSIGNED_TO_DRIVER'].includes(r.status) && (
            <Button
              type="primary"
              size="middle"
              icon={<CarOutlined />}
              onClick={() => handleScanTransit(r.bagCode)}
              loading={scanning}
              className="bg-blue-600 hover:bg-blue-700 font-semibold"
            >
              Quét nhận & Lên xe
            </Button>
          )}

          <Button size="middle" onClick={() => handleOpenDetail(r)}>
            Xem kiện bên trong
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-sm font-semibold mb-1">
            <CarOutlined /> CỔNG TÁC NGHIỆP VẬN TẢI ĐƯỜNG TRỤC
          </div>
          <h1 className="text-2xl font-bold text-white mb-0">
            Tài Xế Xe Tải: {user?.fullName} ({user?.phoneNumber})
          </h1>
          <p className="text-blue-100 text-xs mt-1">
            Quét mã bao tải kẹp chì để vận chuyển trung chuyển liên bưu cục và kho Hub trung tâm
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="large"
            icon={<SyncOutlined />}
            onClick={fetchDriverTasks}
            loading={loading}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Quét nhanh mã bao tải */}
      <Card className="shadow-sm border-2 border-blue-200 bg-blue-50/50">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
              Quét Barcode / QR Code hoặc Nhập Mã Bao Tải Để Lên Xe Trung Chuyển
            </label>
            <Input
              size="large"
              prefix={<BarcodeOutlined className="text-blue-600 text-xl" />}
              placeholder="Nhập hoặc quét mã bao tải (Vd: BAG261124xxxx hoặc mã Seal)..."
              value={scanCode}
              onChange={e => setScanCode(e.target.value)}
              onPressEnter={() => handleScanTransit()}
              className="font-mono font-bold text-lg uppercase h-12"
              autoFocus
            />
          </div>
          <Button
            type="primary"
            size="large"
            icon={<CarOutlined />}
            onClick={() => handleScanTransit()}
            loading={scanning}
            className="bg-blue-600 hover:bg-blue-700 h-12 px-6 text-base font-bold w-full md:w-auto"
          >
            Quét Nhận Lên Xe (IN_TRANSIT)
          </Button>
        </div>
        <p className="text-xs text-blue-700 mt-2 italic mb-0">
          * Lưu ý: Chỉ tài xế được chỉ định cho bao tải mới có thể quét nhận. Khi quét, hệ thống tự động qua Kafka chuyển toàn bộ đơn hàng trong bao sang trạng thái đang trung chuyển.
        </p>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Bao tải chờ lấy hàng"
              value={waitingCount}
              valueStyle={{ color: '#d48806' }}
              suffix="bao"
              prefix={<InboxOutlined className="mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Đang trên xe trung chuyển"
              value={transitCount}
              valueStyle={{ color: '#1890ff' }}
              suffix="bao"
              prefix={<SyncOutlined spin className="mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Đã bàn giao đến Hub"
              value={completedCount}
              valueStyle={{ color: '#52c41a' }}
              suffix="bao"
              prefix={<CheckCircleOutlined className="mr-2" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng danh sách nhiệm vụ */}
      <Card bordered={false} className="shadow-sm">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'ALL', label: `Tất cả (${tasks.length})` },
            { key: 'WAITING', label: `Chờ lấy hàng (${waitingCount})` },
            { key: 'TRANSIT', label: `Đang đi đường (${transitCount})` },
            { key: 'COMPLETED', label: `Đã giao Hub (${completedCount})` },
          ]}
        />

        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          bordered
        />
      </Card>

      {/* Modal Chi tiết kiện hàng trong bao */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-gray-800">
            <InboxOutlined className="text-blue-600" />
            Chi Tiết Các Kiện Hàng Trong Bao [{selectedBag?.bagCode}]
          </div>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalOpen(false)}>
            Đóng
          </Button>
        ]}
        width={750}
      >
        {selectedBag && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-gray-500 block">Tuyến gửi:</span>
                <span className="font-bold text-gray-800 text-sm">
                  {selectedBag.originWarehouseName} ➔ {selectedBag.destWarehouseName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Mã kẹp chì (Seal):</span>
                <span className="font-mono font-bold text-red-600 text-sm">
                  {selectedBag.sealNumber || 'Chưa kẹp chì'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Tổng số kiện hàng:</span>
                <span className="font-bold text-gray-800 text-sm">{selectedBag.totalItems} kiện</span>
              </div>
              <div>
                <span className="text-gray-500 block">Tổng khối lượng:</span>
                <span className="font-bold text-gray-800 text-sm">{Number(selectedBag.totalWeightKg).toFixed(2)} kg</span>
              </div>
            </div>

            <Table
              dataSource={selectedBag.items || []}
              rowKey="trackingCode"
              size="small"
              pagination={{ pageSize: 5 }}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 50,
                  align: 'center' as const,
                  render: (_: any, __: any, idx: number) => idx + 1
                },
                {
                  title: 'Mã Vận Đơn',
                  dataIndex: 'trackingCode',
                  key: 'trackingCode',
                  render: (c: string) => <span className="font-mono font-bold text-blue-700 text-xs">{c}</span>
                },
                {
                  title: 'Tên Hàng Hóa',
                  dataIndex: 'itemName',
                  key: 'itemName',
                  render: (n: string) => <span className="text-xs text-gray-800">{n || 'Kiện hàng'}</span>
                },
                {
                  title: 'Khối Lượng',
                  dataIndex: 'weightGram',
                  key: 'weightGram',
                  render: (w: number) => <span className="text-xs font-semibold">{w}g</span>
                },
                {
                  title: 'Địa Chỉ Nhận',
                  dataIndex: 'receiverAddress',
                  key: 'receiverAddress',
                  render: (addr: string) => <span className="text-xs text-gray-600">{addr || '—'}</span>
                }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
export default TruckDriverPortalPage;
