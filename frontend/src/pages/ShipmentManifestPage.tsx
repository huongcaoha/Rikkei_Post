import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Space,
  Popconfirm,
  message,
  Typography,
  Divider,
  Alert,
} from 'antd';
import {
  Truck,
  Plus,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Printer,
  Barcode,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Phone,
  Trash2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { tmsApi } from '../api/tms';
import { locationApi } from '../api/location';
import { ShipmentManifest, Warehouse } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const STATUS_TAGS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Lên lịch xuất bến', color: 'blue' },
  LOADING: { label: 'Đang bốc xếp bao tải', color: 'orange' },
  DISPATCHED: { label: 'Đã xuất bến luân chuyển', color: 'purple' },
  ARRIVED: { label: 'Đã cập bến Hub đích', color: 'green' },
  COMPLETED: { label: 'Hoàn tất chuyến xe', color: 'default' },
};

export const ShipmentManifestPage: React.FC = () => {
  const [manifests, setManifests] = useState<ShipmentManifest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal Tạo chuyến xe mới
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState<boolean>(false);

  // Drawer Bàn Nạp Bao Tải Lên Xe
  const [activeManifest, setActiveManifest] = useState<ShipmentManifest | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [scanBagInput, setScanBagInput] = useState<string>('');
  const [loadingBag, setLoadingBag] = useState<boolean>(false);
  const scanInputRef = useRef<any>(null);

  // Modal In Bảng Kê
  const [printManifest, setPrintManifest] = useState<ShipmentManifest | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mnfData, whData] = await Promise.all([
        tmsApi.getAllManifests(),
        locationApi.getAllWarehouses().catch(() => []),
      ]);
      setManifests(mnfData || []);
      setWarehouses(whData || []);
    } catch (err: any) {
      message.error('Lỗi tải danh sách chuyến xe: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManifest = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);

      const payload = {
        tripCode: values.tripCode,
        vehiclePlate: values.vehiclePlate,
        driverName: values.driverName,
        driverPhone: values.driverPhone,
        originHubId: values.originHubId,
        destHubId: values.destHubId,
        truckSealNumber: values.truckSealNumber,
        departureScheduledAt: values.departureScheduledAt.format('YYYY-MM-DDTHH:mm:ss'),
        arrivalEstimatedAt: values.arrivalEstimatedAt.format('YYYY-MM-DDTHH:mm:ss'),
        notes: values.notes,
      };

      const created = await tmsApi.createManifest(payload);
      message.success(`Đã tạo bảng kê chuyến xe mới [${created.manifestCode}] thành công!`);
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchData();
      openManifestDrawer(created);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tạo bảng kê chuyến xe');
    } finally {
      setCreating(false);
    }
  };

  const openManifestDrawer = async (item: ShipmentManifest) => {
    try {
      const detail = await tmsApi.getManifestById(item.id);
      setActiveManifest(detail);
      setDrawerOpen(true);
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 300);
    } catch (err: any) {
      message.error('Lỗi tải chi tiết chuyến xe: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleScanBag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeManifest || !scanBagInput.trim()) return;

    const bagCode = scanBagInput.trim().toUpperCase();
    setLoadingBag(true);
    try {
      const updated = await tmsApi.loadBag(activeManifest.id, bagCode);
      setActiveManifest(updated);
      message.success(`Đã nạp bao tải [${bagCode}] lên xe thành công!`);
      setScanBagInput('');
      setManifests((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: any) {
      message.error(err.response?.data?.message || `Lỗi khi nạp bao tải [${bagCode}]`);
    } finally {
      setLoadingBag(false);
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  };

  const handleRemoveBag = async (bagCode: string) => {
    if (!activeManifest) return;
    try {
      const updated = await tmsApi.removeBag(activeManifest.id, bagCode);
      setActiveManifest(updated);
      message.success(`Đã dỡ bao [${bagCode}] khỏi xe!`);
      setManifests((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi dỡ bao tải');
    }
  };

  const handleDispatch = async (manifestId: number) => {
    try {
      const updated = await tmsApi.dispatch(manifestId);
      message.success(`Chuyến xe [${updated.vehiclePlate}] (Bảng kê: ${updated.manifestCode}) đã chính thức xuất bến!`);
      if (activeManifest?.id === manifestId) setActiveManifest(updated);
      setManifests((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi xuất bến chuyến xe');
    }
  };

  const handleArrive = async (manifestId: number) => {
    try {
      const updated = await tmsApi.arrive(manifestId);
      message.success(`Chuyến xe [${updated.vehiclePlate}] đã cập bến Hub [${updated.destHubName}] an toàn!`);
      if (activeManifest?.id === manifestId) setActiveManifest(updated);
      setManifests((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi xác nhận cập bến');
    }
  };

  const filteredManifests = manifests.filter((m) => {
    if (filterStatus !== 'ALL' && m.status !== filterStatus) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      const matchCode = m.manifestCode.toLowerCase().includes(kw);
      const matchTrip = m.tripCode.toLowerCase().includes(kw);
      const matchPlate = m.vehiclePlate.toLowerCase().includes(kw);
      const matchDriver = m.driverName.toLowerCase().includes(kw);
      return matchCode || matchTrip || matchPlate || matchDriver;
    }
    return true;
  });

  const totalManifests = manifests.length;
  const loadingManifests = manifests.filter((m) => ['SCHEDULED', 'LOADING'].includes(m.status)).length;
  const dispatchedManifests = manifests.filter((m) => m.status === 'DISPATCHED').length;
  const arrivedManifests = manifests.filter((m) => ['ARRIVED', 'COMPLETED'].includes(m.status)).length;

  const columns = [
    {
      title: 'Mã Bảng Kê & Tuyến',
      key: 'code',
      render: (_: any, record: ShipmentManifest) => (
        <div>
          <span className="font-mono font-bold text-red-600 text-sm">{record.manifestCode}</span>
          <div className="text-xs text-gray-500 font-semibold">Chuyến: {record.tripCode}</div>
          <div className="mt-1">
            <Tag color="volcano" className="font-mono text-xs">
              Chì thùng: {record.truckSealNumber}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Tuyến Xe Vận Chuyển',
      key: 'route',
      render: (_: any, record: ShipmentManifest) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-700">{record.originHubName}</span>
            <ArrowRight size={14} className="text-gray-400 shrink-0" />
            <span className="font-bold text-blue-600">{record.destHubName}</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar size={13} />
            Xuất bến DK: {new Date(record.departureScheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(record.departureScheduledAt).toLocaleDateString('vi-VN')}
          </div>
        </div>
      ),
    },
    {
      title: 'Xe Tải & Lái Xe',
      key: 'truck',
      render: (_: any, record: ShipmentManifest) => (
        <div>
          <span className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <Truck size={15} className="text-blue-500" />
            {record.vehiclePlate}
          </span>
          <div className="text-xs text-gray-600 mt-0.5">
            {record.driverName} - <span className="text-blue-600">{record.driverPhone}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Tải Trọng Bốc Xếp',
      key: 'load',
      render: (_: any, record: ShipmentManifest) => (
        <div>
          <span className="font-extrabold text-blue-600 text-base">{record.totalBags}</span> bao tải
          <div className="text-xs text-gray-500 font-semibold">{record.totalPackages} kiện bưu phẩm</div>
        </div>
      ),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => {
        const info = STATUS_TAGS[st] || { label: st, color: 'default' };
        return <Tag color={info.color} className="font-semibold">{info.label}</Tag>;
      },
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      render: (_: any, record: ShipmentManifest) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<Layers size={14} />}
            onClick={() => openManifestDrawer(record)}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            Nạp bao
          </Button>

          {['SCHEDULED', 'LOADING'].includes(record.status) && (
            <Popconfirm
              title="Xác nhận xuất bến chuyến xe?"
              description="Toàn bộ các kiện hàng trong bao tải sẽ chuyển sang trạng thái Đang luân chuyển (IN_TRANSIT)."
              onConfirm={() => handleDispatch(record.id)}
              okText="Xuất bến"
              cancelText="Hủy"
            >
              <Button
                size="small"
                icon={<Truck size={14} />}
                className="bg-purple-600 hover:bg-purple-700 text-white border-none text-xs"
              >
                Xuất bến
              </Button>
            </Popconfirm>
          )}

          {record.status === 'DISPATCHED' && (
            <Popconfirm
              title="Xác nhận xe đã cập bến Hub đích?"
              onConfirm={() => handleArrive(record.id)}
              okText="Cập bến"
              cancelText="Hủy"
            >
              <Button
                size="small"
                icon={<CheckCircle2 size={14} />}
                className="bg-green-600 hover:bg-green-700 text-white border-none text-xs"
              >
                Cập bến
              </Button>
            </Popconfirm>
          )}

          <Button
            size="small"
            icon={<Printer size={14} />}
            onClick={() => setPrintManifest(record)}
            className="text-gray-600 hover:text-black text-xs"
            title="In Bảng kê xuất kho"
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Tiêu đề & Nút hành động */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <Truck size={28} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-gray-800">
              Quản Lý Xuất Kho & Bảng Kê Chuyến Xe Tải
            </Title>
            <Text type="secondary" className="text-sm">
              Tạo bảng kê chuyến xe luân chuyển liên tỉnh, quét nạp bao tải lên xe, kiểm tra chênh lệch và khai xuất bến.
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button icon={<RotateCcw size={16} />} onClick={fetchData} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              createForm.resetFields();
              createForm.setFieldsValue({
                departureScheduledAt: dayjs().add(2, 'hour'),
                arrivalEstimatedAt: dayjs().add(12, 'hour'),
                truckSealNumber: 'SEAL' + Math.floor(100000 + Math.random() * 900000),
              });
              setCreateModalOpen(true);
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            Tạo chuyến xe mới
          </Button>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Tổng số chuyến xe"
              value={totalManifests}
              suffix="chuyến"
              prefix={<Truck size={20} className="text-blue-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đang bốc xếp hàng"
              value={loadingManifests}
              suffix="chuyến"
              valueStyle={{ color: '#ea580c' }}
              prefix={<Layers size={20} className="text-orange-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đang trên đường (In Transit)"
              value={dispatchedManifests}
              suffix="chuyến"
              valueStyle={{ color: '#7c3aed' }}
              prefix={<Truck size={20} className="text-purple-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đã cập bến an toàn"
              value={arrivedManifests}
              suffix="chuyến"
              valueStyle={{ color: '#16a34a' }}
              prefix={<CheckCircle2 size={20} className="text-green-600 mr-2" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng danh sách chuyến xe */}
      <Card className="rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              prefix={<Search size={16} className="text-gray-400" />}
              placeholder="Tìm theo mã bảng kê, biển số xe, tên tài xế..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 300 }}
              allowClear
            />
            <Select value={filterStatus} onChange={setFilterStatus} style={{ width: 220 }}>
              <Option value="ALL">Tất cả trạng thái</Option>
              <Option value="SCHEDULED">Lên lịch xuất bến</Option>
              <Option value="LOADING">Đang bốc xếp bao tải</Option>
              <Option value="DISPATCHED">Đã xuất bến luân chuyển</Option>
              <Option value="ARRIVED">Đã cập bến Hub đích</Option>
              <Option value="COMPLETED">Hoàn tất chuyến xe</Option>
            </Select>
          </div>

          <Text type="secondary" className="text-xs">
            Hiển thị {filteredManifests.length} / {manifests.length} chuyến xe
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredManifests}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          className="overflow-x-auto"
        />
      </Card>

      {/* Drawer Bàn Nạp Bao Tải Lên Xe (Loading Workspace) */}
      <Drawer
        title={
          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center gap-2">
              <Truck size={20} className="text-purple-600" />
              <span className="font-bold text-base">Bốc Xếp Xe Tải: {activeManifest?.vehiclePlate}</span>
              {activeManifest && (
                <Tag color={STATUS_TAGS[activeManifest.status]?.color || 'default'} className="ml-2 font-medium">
                  {STATUS_TAGS[activeManifest.status]?.label || activeManifest.status}
                </Tag>
              )}
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={760}
        destroyOnClose
      >
        {activeManifest && (
          <div className="space-y-6">
            {/* Header thông tin chuyến xe */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">Hub Xuất phát:</span>
                  <span className="font-bold text-gray-800">{activeManifest.originHubName}</span>
                </div>
                <ArrowRight size={18} className="text-purple-500" />
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Hub Đích đến:</span>
                  <span className="font-bold text-red-600">{activeManifest.destHubName}</span>
                </div>
              </div>

              <Divider className="my-1" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block">Biển số xe:</span>
                  <span className="font-bold text-gray-800">{activeManifest.vehiclePlate}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Tài xế / SĐT:</span>
                  <span className="font-bold text-gray-800">{activeManifest.driverName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Chì niêm phong xe:</span>
                  <span className="font-mono font-bold text-red-600">{activeManifest.truckSealNumber}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Tổng bao / kiện:</span>
                  <span className="font-bold text-purple-700">
                    {activeManifest.totalBags} bao ({activeManifest.totalPackages} kiện)
                  </span>
                </div>
              </div>
            </div>

            {/* Ô quét mã bao tải nạp lên xe */}
            {['SCHEDULED', 'LOADING'].includes(activeManifest.status) ? (
              <form onSubmit={handleScanBag} className="space-y-2">
                <Text strong className="text-gray-800 text-sm block">
                  Bắn mã vạch bao tải để nạp lên xe (Súng barcode hoặc gõ Enter):
                </Text>
                <div className="flex gap-2">
                  <Input
                    ref={scanInputRef}
                    size="large"
                    prefix={<Barcode size={20} className="text-gray-400" />}
                    placeholder="Quét mã bao tải (ví dụ: BAG...)"
                    value={scanBagInput}
                    onChange={(e) => setScanBagInput(e.target.value)}
                    disabled={loadingBag}
                    className="font-mono font-bold text-base"
                  />
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    loading={loadingBag}
                    className="bg-purple-600 hover:bg-purple-700 font-semibold"
                  >
                    Nạp lên xe
                  </Button>
                </div>
              </form>
            ) : (
              <Alert
                type="info"
                message={`Chuyến xe này đã ${STATUS_TAGS[activeManifest.status]?.label || activeManifest.status}`}
                description="Không thể thay đổi danh sách bao tải sau khi xe đã xuất bến."
                showIcon
              />
            )}

            {/* Bảng danh sách bao tải trên xe */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Text strong className="text-sm text-gray-700">
                  Danh sách bao tải trên xe tải ({activeManifest.bags?.length || 0}):
                </Text>
                {['SCHEDULED', 'LOADING'].includes(activeManifest.status) && (activeManifest.bags?.length || 0) > 0 && (
                  <Popconfirm
                    title="Khai xuất bến chuyến xe ngay?"
                    description="Xác nhận khóa xe tải và xuất bến luân chuyển."
                    onConfirm={() => handleDispatch(activeManifest.id)}
                    okText="Xuất bến ngay"
                    cancelText="Hủy"
                  >
                    <Button type="primary" icon={<Truck size={14} />} className="bg-red-600 hover:bg-red-700 text-xs">
                      Khai xuất bến xe
                    </Button>
                  </Popconfirm>
                )}
              </div>

              <Table
                dataSource={activeManifest.bags || []}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                size="small"
                columns={[
                  {
                    title: 'Mã Bao Tải',
                    dataIndex: 'bagCode',
                    key: 'bagCode',
                    render: (c: string) => <span className="font-mono font-bold text-blue-600 text-xs">{c}</span>,
                  },
                  {
                    title: 'Mã Kẹp Chì',
                    dataIndex: 'sealNumber',
                    key: 'sealNumber',
                    render: (s: string) => <Tag color="volcano" className="font-mono text-xs">{s || '-'}</Tag>,
                  },
                  {
                    title: 'Đích Đến Bao',
                    dataIndex: 'destWarehouseName',
                    key: 'destWarehouseName',
                    render: (d: string) => (
                      <span className={`text-xs font-semibold ${d === activeManifest.destHubName ? 'text-green-600' : 'text-red-500'}`}>
                        {d} {d !== activeManifest.destHubName && '(LỆCH TUYẾN!)'}
                      </span>
                    ),
                  },
                  {
                    title: 'Số Kiện',
                    dataIndex: 'totalItems',
                    key: 'totalItems',
                    render: (cnt: number) => <span className="text-xs font-bold">{cnt} kiện</span>,
                  },
                  {
                    title: 'Trọng Lượng',
                    dataIndex: 'totalWeightKg',
                    key: 'totalWeightKg',
                    render: (kg: number) => <span className="text-xs">{Number(kg).toFixed(2)} kg</span>,
                  },
                  {
                    title: '',
                    key: 'del',
                    render: (_: any, bag: any) =>
                      ['SCHEDULED', 'LOADING'].includes(activeManifest.status) ? (
                        <Popconfirm
                          title="Dỡ bao tải khỏi chuyến xe?"
                          onConfirm={() => handleRemoveBag(bag.bagCode)}
                          okText="Dỡ bao"
                          cancelText="Hủy"
                        >
                          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
                        </Popconfirm>
                      ) : null,
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal Tạo Chuyến Xe Mới */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-purple-700">
            <Plus size={18} />
            Khởi Tạo Bảng Kê Chuyến Xe Tải Mới
          </div>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateManifest}
        confirmLoading={creating}
        okText="Tạo chuyến xe"
        cancelText="Hủy"
        width={620}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="tripCode"
                label="Mã số chuyến xe"
                rules={[{ required: true, message: 'Nhập mã chuyến (ví dụ: HN-SGN-01)' }]}
              >
                <Input placeholder="HN-SGN-01" className="font-mono uppercase" />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item
                name="vehiclePlate"
                label="Biển số xe tải"
                rules={[{ required: true, message: 'Nhập biển số xe (ví dụ: 29C-888.99)' }]}
              >
                <Input placeholder="29C-888.99" className="font-mono uppercase font-bold" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="driverName"
                label="Tên tài xế lái xe"
                rules={[{ required: true, message: 'Nhập tên tài xế' }]}
              >
                <Input placeholder="Nguyễn Văn Lái" />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item
                name="driverPhone"
                label="Số điện thoại tài xế"
                rules={[{ required: true, message: 'Nhập số điện thoại' }]}
              >
                <Input placeholder="0987654321" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="originHubId"
                label="Hub xuất phát (Nơi đi)"
                rules={[{ required: true, message: 'Chọn Hub xuất phát' }]}
              >
                <Select placeholder="Chọn Hub đi" showSearch optionFilterProp="children">
                  {warehouses.map((w) => (
                    <Option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item
                name="destHubId"
                label="Hub đích đến (Nơi đến)"
                rules={[{ required: true, message: 'Chọn Hub đích' }]}
              >
                <Select placeholder="Chọn Hub đến" showSearch optionFilterProp="children">
                  {warehouses.map((w) => (
                    <Option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="truckSealNumber"
                label="Mã kẹp chì niêm phong xe tải"
                rules={[{ required: true, message: 'Nhập mã chì thùng xe' }]}
              >
                <Input className="font-mono font-bold" />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item
                name="departureScheduledAt"
                label="Giờ xuất bến dự kiến"
                rules={[{ required: true, message: 'Chọn thời gian xuất bến' }]}
              >
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="arrivalEstimatedAt"
                label="Giờ đến dự kiến tại Hub đích"
                rules={[{ required: true, message: 'Chọn thời gian đến dự kiến' }]}
              >
                <DatePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item name="notes" label="Ghi chú chuyến xe">
                <Input placeholder="Ví dụ: Xe container chạy tuyến đêm..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal In Bảng Kê Vận Chuyển A4 */}
      <Modal
        title="Bảng Kê Vận Chuyển Hàng Hóa Xuất Kho (Khổ A4)"
        open={!!printManifest}
        onCancel={() => setPrintManifest(null)}
        footer={[
          <Button key="close" onClick={() => setPrintManifest(null)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<Printer size={16} />}
            onClick={() => window.print()}
            className="bg-red-600 hover:bg-red-700"
          >
            In bảng kê
          </Button>,
        ]}
        width={720}
      >
        {printManifest && (
          <div className="border border-gray-400 p-6 rounded-lg bg-white font-sans text-black space-y-4 print:m-0">
            <div className="text-center border-b pb-3">
              <span className="font-extrabold text-xl tracking-wider block">TỔNG CÔNG TY CHUYỂN PHÁT NHANH RIKKEI POST</span>
              <span className="font-bold text-base text-red-600 block">BẢNG KÊ GIAO NHẬN HÀNG HÓA LUÂN CHUYỂN LIÊN TỈNH</span>
              <span className="font-mono text-sm">MÃ BẢNG KÊ: {printManifest.manifestCode}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-b pb-3">
              <div>
                <p><strong>Hub Xuất Phát:</strong> {printManifest.originHubName}</p>
                <p><strong>Hub Đích Đến:</strong> {printManifest.destHubName}</p>
                <p><strong>Mã Chuyến:</strong> {printManifest.tripCode}</p>
              </div>
              <div>
                <p><strong>Biển Số Xe:</strong> {printManifest.vehiclePlate}</p>
                <p><strong>Tài Xế:</strong> {printManifest.driverName} - {printManifest.driverPhone}</p>
                <p><strong>Mã Chì Thùng Xe:</strong> {printManifest.truckSealNumber}</p>
              </div>
            </div>

            <div>
              <span className="font-bold text-xs block mb-1">
                TỔNG SỐ LƯỢNG: {printManifest.totalBags} BAO TẢI ({printManifest.totalPackages} KIỆN HÀNG)
              </span>
              <div className="border border-black p-2 text-xs">
                {printManifest.bags?.length ? (
                  <ul className="list-disc pl-5 space-y-1">
                    {printManifest.bags.map((b) => (
                      <li key={b.id}>
                        Bao tải: <strong>{b.bagCode}</strong> - Kẹp chì: <strong>{b.sealNumber || 'N/A'}</strong> - ({b.totalItems} kiện, {Number(b.totalWeightKg).toFixed(2)} kg) ➔ {b.destWarehouseName}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="italic text-gray-500">Chưa có bao tải nào được nạp lên xe</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center text-xs pt-4 border-t">
              <div>
                <strong>NGƯỜI LẬP BẢNG KÊ</strong>
                <p className="mt-8 italic">(Ký và ghi rõ họ tên)</p>
              </div>
              <div>
                <strong>LÁI XE VẬN CHUYỂN</strong>
                <p className="mt-8 italic">(Ký và ghi rõ họ tên)</p>
              </div>
              <div>
                <strong>ĐIỀU ĐỘ HUB XUẤT</strong>
                <p className="mt-8 italic">(Ký và đóng dấu)</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
