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
  Row,
  Col,
  Statistic,
  Space,
  Popconfirm,
  message,
  Typography,
  Divider,
  Alert,
  Tooltip,
} from 'antd';
import {
  Package,
  Plus,
  Lock,
  Unlock,
  Printer,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  Trash2,
  Barcode,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { wmsApi } from '../api/wms';
import { locationApi } from '../api/location';
import { MasterBag, Warehouse } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const STATUS_TAGS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Đang mở đóng kiện', color: 'blue' },
  SEALED: { label: 'Đã kẹp chì (Seal)', color: 'orange' },
  MANIFESTED: { label: 'Đã lên bảng kê xe', color: 'cyan' },
  DISPATCHED: { label: 'Đang luân chuyển xe', color: 'purple' },
  RECEIVED: { label: 'Đã nhận tại kho đích', color: 'green' },
  UNSEALED: { label: 'Đã cắt chì / Mở bao', color: 'default' },
};

export const MasterBagPage: React.FC = () => {
  const [bags, setBags] = useState<MasterBag[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal tạo bao mới
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState<boolean>(false);

  // Drawer chi tiết bàn đóng bao
  const [activeBag, setActiveBag] = useState<MasterBag | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [scanItemInput, setScanItemInput] = useState<string>('');
  const [scanningItem, setScanningItem] = useState<boolean>(false);
  const scanInputRef = useRef<any>(null);

  // Modal kẹp chì
  const [sealModalOpen, setSealModalOpen] = useState<boolean>(false);
  const [sealForm] = Form.useForm();
  const [sealing, setSealing] = useState<boolean>(false);

  // Modal in nhãn bao
  const [printBag, setPrintBag] = useState<MasterBag | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bagsData, whData] = await Promise.all([
        wmsApi.getAllBags(),
        locationApi.getAllWarehouses().catch(() => []),
      ]);
      setBags(bagsData || []);
      setWarehouses(whData || []);
    } catch (err: any) {
      message.error('Không thể tải danh sách bao tải: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBag = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const newBag = await wmsApi.createBag({
        originWarehouseId: values.originWarehouseId,
        destWarehouseId: values.destWarehouseId,
        notes: values.notes,
      });
      message.success(`Đã tạo bao tải mới [${newBag.bagCode}] thành công!`);
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchData();
      // Mở ngay drawer đóng hàng cho bao mới tạo
      openBagDrawer(newBag);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi khi tạo bao tải');
    } finally {
      setCreating(false);
    }
  };

  const openBagDrawer = async (bag: MasterBag) => {
    try {
      const detail = await wmsApi.getBagById(bag.id);
      setActiveBag(detail);
      setDrawerOpen(true);
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 300);
    } catch (err: any) {
      message.error('Lỗi tải chi tiết bao: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleScanItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBag || !scanItemInput.trim()) return;

    const code = scanItemInput.trim().toUpperCase();
    setScanningItem(true);
    try {
      const updated = await wmsApi.addItemToBag(activeBag.id, code);
      setActiveBag(updated);
      message.success(`Đã thêm kiện [${code}] vào bao thành công!`);
      setScanItemInput('');
      // Cập nhật lại trong bảng danh sách
      setBags((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      message.error(err.response?.data?.message || `Lỗi khi nạp kiện [${code}] vào bao`);
    } finally {
      setScanningItem(false);
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  };

  const handleRemoveItem = async (trackingCode: string) => {
    if (!activeBag) return;
    try {
      const updated = await wmsApi.removeItemFromBag(activeBag.id, trackingCode);
      setActiveBag(updated);
      message.success(`Đã gỡ kiện [${trackingCode}] ra khỏi bao!`);
      setBags((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi gỡ kiện hàng');
    }
  };

  const handleOpenSealModal = (bag: MasterBag) => {
    setActiveBag(bag);
    sealForm.resetFields();
    // Gợi ý mã seal chì ngẫu nhiên
    const randomSeal = 'SEAL' + Math.floor(100000 + Math.random() * 900000);
    sealForm.setFieldsValue({ sealNumber: randomSeal });
    setSealModalOpen(true);
  };

  const handleConfirmSeal = async () => {
    if (!activeBag) return;
    try {
      const values = await sealForm.validateFields();
      setSealing(true);
      const updated = await wmsApi.sealBag(activeBag.id, values.sealNumber);
      message.success(`Niêm phong kẹp chì bao [${updated.bagCode}] thành công!`);
      setSealModalOpen(false);
      setActiveBag(updated);
      setBags((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi khi kẹp chì');
    } finally {
      setSealing(false);
    }
  };

  const handleUnseal = async (bag: MasterBag) => {
    try {
      const updated = await wmsApi.unsealBag(bag.id);
      message.success(`Đã cắt chì mở bao [${updated.bagCode}] và nhập kho đích thành công!`);
      if (activeBag?.id === bag.id) {
        setActiveBag(updated);
      }
      setBags((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi cắt chì mở bao');
    }
  };

  const filteredBags = bags.filter((b) => {
    if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      const matchCode = b.bagCode.toLowerCase().includes(kw);
      const matchSeal = b.sealNumber?.toLowerCase().includes(kw);
      const matchOrig = b.originWarehouseName.toLowerCase().includes(kw);
      const matchDest = b.destWarehouseName.toLowerCase().includes(kw);
      return matchCode || matchSeal || matchOrig || matchDest;
    }
    return true;
  });

  const totalBags = bags.length;
  const openBags = bags.filter((b) => b.status === 'OPEN').length;
  const sealedBags = bags.filter((b) => b.status === 'SEALED').length;
  const inTransitBags = bags.filter((b) => ['MANIFESTED', 'DISPATCHED'].includes(b.status)).length;

  const columns = [
    {
      title: 'Mã Bao Tải',
      dataIndex: 'bagCode',
      key: 'bagCode',
      render: (code: string, record: MasterBag) => (
        <div>
          <span className="font-mono font-bold text-blue-600 text-sm">{code}</span>
          {record.sealNumber && (
            <div className="mt-1">
              <Tag color="volcano" className="font-mono text-xs">
                Seal: {record.sealNumber}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tuyến Vận Chuyển',
      key: 'route',
      render: (_: any, record: MasterBag) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-gray-700">{record.originWarehouseName}</span>
          <ArrowRight size={14} className="text-gray-400 shrink-0" />
          <span className="font-bold text-red-600">{record.destWarehouseName}</span>
        </div>
      ),
    },
    {
      title: 'Số Kiện',
      dataIndex: 'totalItems',
      key: 'totalItems',
      render: (count: number) => (
        <span className="font-bold text-gray-800">{count} kiện</span>
      ),
    },
    {
      title: 'Tổng Trọng Lượng',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      render: (kg: number) => (
        <span className="font-semibold text-gray-700">{Number(kg).toFixed(2)} kg</span>
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
      title: 'Thời Gian Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (dt: string) => (
        <span className="text-xs text-gray-500">
          {dt ? new Date(dt).toLocaleString('vi-VN') : '-'}
        </span>
      ),
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      render: (_: any, record: MasterBag) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<Package size={14} />}
            onClick={() => openBagDrawer(record)}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            Đóng hàng
          </Button>

          {record.status === 'OPEN' && record.totalItems > 0 && (
            <Button
              size="small"
              icon={<Lock size={14} />}
              onClick={() => handleOpenSealModal(record)}
              className="border-orange-500 text-orange-600 hover:bg-orange-50 text-xs"
            >
              Kẹp chì
            </Button>
          )}

          {['DISPATCHED', 'RECEIVED'].includes(record.status) && (
            <Popconfirm
              title="Xác nhận cắt chì mở bao"
              description="Các kiện hàng bên trong sẽ được tự động nhập kho tại Hub đích."
              onConfirm={() => handleUnseal(record)}
              okText="Cắt chì"
              cancelText="Hủy"
            >
              <Button
                size="small"
                icon={<Unlock size={14} />}
                className="border-green-600 text-green-600 hover:bg-green-50 text-xs"
              >
                Cắt chì
              </Button>
            </Popconfirm>
          )}

          <Button
            size="small"
            icon={<Printer size={14} />}
            onClick={() => setPrintBag(record)}
            className="text-gray-600 hover:text-black text-xs"
            title="In tem nhãn bao tải A6"
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
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Layers size={28} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-gray-800">
              Quy Trình Đóng Bao Tải Master Bag & Kẹp Chì Seal
            </Title>
            <Text type="secondary" className="text-sm">
              Gom kiện hàng theo tuyến đích, niêm phong mã chì Seal và in tem nhãn bao tải trước khi chuyển lên xe tải.
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
              setCreateModalOpen(true);
            }}
            className="bg-red-600 hover:bg-red-700"
          >
            Tạo bao tải mới
          </Button>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Tổng số bao tải"
              value={totalBags}
              suffix="bao"
              prefix={<Layers size={20} className="text-blue-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đang mở đóng hàng"
              value={openBags}
              suffix="bao"
              valueStyle={{ color: '#2563eb' }}
              prefix={<Package size={20} className="text-blue-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đã kẹp chì (Sẵn sàng)"
              value={sealedBags}
              suffix="bao"
              valueStyle={{ color: '#ea580c' }}
              prefix={<Lock size={20} className="text-orange-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đang trên xe luân chuyển"
              value={inTransitBags}
              suffix="bao"
              valueStyle={{ color: '#7c3aed' }}
              prefix={<Truck size={20} className="text-purple-600 mr-2" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng danh sách bao tải */}
      <Card className="rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              prefix={<Search size={16} className="text-gray-400" />}
              placeholder="Tìm theo mã bao, mã seal, tên kho..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 200 }}
            >
              <Option value="ALL">Tất cả trạng thái</Option>
              <Option value="OPEN">Đang mở đóng kiện</Option>
              <Option value="SEALED">Đã kẹp chì (Seal)</Option>
              <Option value="MANIFESTED">Đã lên bảng kê xe</Option>
              <Option value="DISPATCHED">Đang luân chuyển</Option>
              <Option value="RECEIVED">Đã nhận kho đích</Option>
              <Option value="UNSEALED">Đã cắt chì / Mở bao</Option>
            </Select>
          </div>

          <Text type="secondary" className="text-xs">
            Hiển thị {filteredBags.length} / {bags.length} bao tải
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredBags}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          className="overflow-x-auto"
        />
      </Card>

      {/* Drawer: Bàn Đóng Bao Tải Chi Tiết (Active Bag Workspace) */}
      <Drawer
        title={
          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center gap-2">
              <Package size={20} className="text-blue-600" />
              <span className="font-bold text-base">Bàn Đóng Bao: {activeBag?.bagCode}</span>
              {activeBag && (
                <Tag color={STATUS_TAGS[activeBag.status]?.color || 'default'} className="ml-2 font-medium">
                  {STATUS_TAGS[activeBag.status]?.label || activeBag.status}
                </Tag>
              )}
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        destroyOnClose
      >
        {activeBag && (
          <div className="space-y-6">
            {/* Header thông tin bao */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">Kho xuất phát:</span>
                  <span className="font-bold text-gray-800">{activeBag.originWarehouseName}</span>
                </div>
                <ArrowRight size={18} className="text-blue-500" />
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Kho / Hub đích:</span>
                  <span className="font-bold text-red-600">{activeBag.destWarehouseName}</span>
                </div>
              </div>

              <Divider className="my-2" />

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-500">Số kiện hiện có: </span>
                  <span className="font-bold text-base text-blue-700">{activeBag.totalItems} kiện</span>
                </div>
                <div>
                  <span className="text-gray-500">Tổng trọng lượng: </span>
                  <span className="font-bold text-base text-gray-800">{Number(activeBag.totalWeightKg).toFixed(2)} kg</span>
                </div>
                {activeBag.sealNumber && (
                  <div>
                    <span className="text-gray-500">Mã Seal chì: </span>
                    <span className="font-mono font-bold text-red-600">{activeBag.sealNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ô quét mã vận đơn (chỉ cho phép khi trạng thái OPEN) */}
            {activeBag.status === 'OPEN' ? (
              <form onSubmit={handleScanItem} className="space-y-2">
                <Text strong className="text-gray-800 text-sm block">
                  Bắn mã vạch đơn hàng để gom vào bao (Súng barcode hoặc gõ Enter):
                </Text>
                <div className="flex gap-2">
                  <Input
                    ref={scanInputRef}
                    size="large"
                    prefix={<Barcode size={20} className="text-gray-400" />}
                    placeholder="Quét mã vận đơn (ví dụ: RKP...)"
                    value={scanItemInput}
                    onChange={(e) => setScanItemInput(e.target.value)}
                    disabled={scanningItem}
                    className="font-mono font-bold text-base"
                  />
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    loading={scanningItem}
                    className="bg-blue-600 hover:bg-blue-700 font-semibold"
                  >
                    Nạp vào bao
                  </Button>
                </div>
              </form>
            ) : (
              <Alert
                type="info"
                message={`Bao tải này đã được ${STATUS_TAGS[activeBag.status]?.label || activeBag.status}`}
                description="Không thể thêm hoặc gỡ kiện hàng khỏi bao tải đã được niêm phong."
                showIcon
              />
            )}

            {/* Bảng danh sách kiện hàng bên trong */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Text strong className="text-sm text-gray-700">
                  Danh sách kiện hàng trong bao ({activeBag.items?.length || 0}):
                </Text>
                {activeBag.status === 'OPEN' && activeBag.totalItems > 0 && (
                  <Button
                    type="primary"
                    icon={<Lock size={14} />}
                    onClick={() => handleOpenSealModal(activeBag)}
                    className="bg-orange-600 hover:bg-orange-700 text-xs"
                  >
                    Kẹp chì niêm phong
                  </Button>
                )}
              </div>

              <Table
                dataSource={activeBag.items || []}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                size="small"
                columns={[
                  {
                    title: 'Mã Vận Đơn',
                    dataIndex: 'trackingCode',
                    key: 'trackingCode',
                    render: (c: string) => <span className="font-mono font-bold text-red-600 text-xs">{c}</span>,
                  },
                  {
                    title: 'Tên hàng hóa',
                    dataIndex: 'itemName',
                    key: 'itemName',
                    ellipsis: true,
                    render: (n: string) => <span className="text-xs">{n || '-'}</span>,
                  },
                  {
                    title: 'Routing Code',
                    dataIndex: 'routingCode',
                    key: 'routingCode',
                    render: (rc: string) => <Tag color="blue" className="font-mono text-xs">{rc || '-'}</Tag>,
                  },
                  {
                    title: 'Cân nặng',
                    dataIndex: 'weightGram',
                    key: 'weightGram',
                    render: (w: number) => <span className="text-xs font-semibold">{w} g</span>,
                  },
                  {
                    title: '',
                    key: 'del',
                    render: (_: any, item: any) =>
                      activeBag.status === 'OPEN' ? (
                        <Popconfirm
                          title="Gỡ kiện hàng khỏi bao?"
                          onConfirm={() => handleRemoveItem(item.trackingCode)}
                          okText="Gỡ"
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

      {/* Modal Tạo Bao Tải Mới */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold">
            <Plus size={18} className="text-red-600" />
            Khởi Tạo Bao Tải Gom Hàng Mới
          </div>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreateBag}
        confirmLoading={creating}
        okText="Tạo bao tải"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Form.Item
            name="originWarehouseId"
            label="Kho / Bưu cục xuất phát (Nơi gom hàng)"
            rules={[{ required: true, message: 'Vui lòng chọn kho xuất phát' }]}
          >
            <Select placeholder="Chọn kho / bưu cục xuất phát" showSearch optionFilterProp="children">
              {warehouses.map((w) => (
                <Option key={w.id} value={w.id}>
                  {w.name} ({w.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="destWarehouseId"
            label="Kho / Hub đích đến (Nơi tiếp nhận bao)"
            rules={[{ required: true, message: 'Vui lòng chọn kho đích đến' }]}
          >
            <Select placeholder="Chọn kho / Hub đích đến" showSearch optionFilterProp="children">
              {warehouses.map((w) => (
                <Option key={w.id} value={w.id}>
                  {w.name} ({w.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú bao tải">
            <Input.TextArea placeholder="Ví dụ: Hàng dễ vỡ, bưu phẩm hỏa tốc..." rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Kẹp Chì (Seal) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-orange-600">
            <Lock size={18} />
            Niêm Phong Kẹp Chì Bao Tải [{activeBag?.bagCode}]
          </div>
        }
        open={sealModalOpen}
        onCancel={() => setSealModalOpen(false)}
        onOk={handleConfirmSeal}
        confirmLoading={sealing}
        okText="Xác nhận kẹp chì"
        cancelText="Hủy"
        destroyOnClose
      >
        <div className="my-2">
          <Alert
            type="warning"
            message="Lưu ý kẹp chì"
            description="Sau khi kẹp chì, bao tải sẽ bị khóa hoàn toàn. Không thể nạp thêm hoặc gỡ bỏ kiện hàng cho đến khi bao được cắt chì tại kho đích."
            showIcon
            className="mb-4"
          />
          <Form form={sealForm} layout="vertical">
            <Form.Item
              name="sealNumber"
              label="Mã số kẹp chì kim loại / Seal nhựa (Quét barcode hoặc nhập số)"
              rules={[{ required: true, message: 'Vui lòng nhập mã kẹp chì' }]}
            >
              <Input
                size="large"
                prefix={<Barcode size={20} className="text-gray-400" />}
                placeholder="Nhập hoặc quét mã số kẹp chì..."
                className="font-mono font-bold text-base"
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* Modal In Nhãn Nhiệt Bao Tải A6 */}
      <Modal
        title="Tem Nhãn Dán Bao Tải Master Bag (Khổ A6)"
        open={!!printBag}
        onCancel={() => setPrintBag(null)}
        footer={[
          <Button key="close" onClick={() => setPrintBag(null)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<Printer size={16} />}
            onClick={() => window.print()}
            className="bg-red-600 hover:bg-red-700"
          >
            In tem ngay
          </Button>,
        ]}
        width={500}
      >
        {printBag && (
          <div className="border-2 border-black p-4 rounded-lg bg-white font-sans text-black space-y-3 print:m-0">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <div>
                <span className="font-extrabold text-lg tracking-wider">RIKKEI POST</span>
                <div className="text-xs text-gray-600">SMART EXPRESS LOGISTICS</div>
              </div>
              <div className="text-right">
                <span className="font-mono font-extrabold text-xl">{printBag.bagCode}</span>
                <div className="text-xs">MÃ BAO TẢI TỔNG</div>
              </div>
            </div>

            <div className="border-b-2 border-black pb-2 space-y-1">
              <div className="text-xs font-semibold">TỪ: {printBag.originWarehouseName}</div>
              <div className="text-sm font-extrabold text-red-600">
                ĐẾN: {printBag.destWarehouseName}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-2 text-xs">
              <div>
                <span className="text-gray-600 block">Số lượng kiện:</span>
                <span className="font-extrabold text-base">{printBag.totalItems} KIỆN</span>
              </div>
              <div>
                <span className="text-gray-600 block">Tổng trọng lượng:</span>
                <span className="font-extrabold text-base">{Number(printBag.totalWeightKg).toFixed(2)} KG</span>
              </div>
            </div>

            <div className="border-b-2 border-black pb-2">
              <span className="text-xs text-gray-600 block">SỐ HIỆU KẸP CHÌ NIÊM PHONG (SEAL):</span>
              <span className="font-mono font-extrabold text-lg text-red-600">
                {printBag.sealNumber || 'CHƯA KẸP CHÌ'}
              </span>
            </div>

            <div className="text-center pt-2">
              <div className="inline-block p-2 bg-gray-100 rounded font-mono text-sm tracking-widest font-bold">
                * {printBag.bagCode} *
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Quét mã này khi xuất kho nạp lên xe tải vận chuyển
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
