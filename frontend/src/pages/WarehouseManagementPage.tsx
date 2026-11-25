import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Row,
  Col,
  Space,
  Tooltip,
} from 'antd';
import {
  Building2,
  Plus,
  MapPin,
  ExternalLink,
  Edit,
  Navigation,
  RefreshCw,
  Search,
  CheckCircle,
  AlertCircle,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { locationApi, WarehouseRequest } from '../api/location';
import { Province, Warehouse } from '../types';
import { LocationPickerModal } from '../components/LocationPickerModal';

export const WarehouseManagementPage: React.FC = () => {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterProvinceId, setFilterProvinceId] = useState<number | undefined>(undefined);

  // Modal Thêm / Sửa Kho bưu cục
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [form] = Form.useForm();

  // Bản đồ chọn tọa độ Leaflet / Google Maps
  const [isMapModalOpen, setIsMapModalOpen] = useState<boolean>(false);
  const [mapInitialCoords, setMapInitialCoords] = useState<{ lat?: number; lng?: number }>({});

  const fetchWarehouses = async () => {
    try {
      setLoading(true);
      const data = await locationApi.getAllWarehouses();
      setWarehouses(data);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể tải danh sách kho/bưu cục!');
    } finally {
      setLoading(false);
    }
  };

  const fetchProvinces = async () => {
    try {
      const data = await locationApi.getProvinces();
      setProvinces(data);
    } catch (error) {
      console.error('Lỗi tải danh mục tỉnh thành:', error);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    fetchProvinces();
  }, []);

  // Lọc danh sách kho
  const filteredWarehouses = warehouses.filter((wh) => {
    const matchKeyword =
      !searchKeyword ||
      wh.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      wh.code.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      wh.address.toLowerCase().includes(searchKeyword.toLowerCase());

    const matchType = filterType === 'ALL' || wh.type === filterType;
    const matchProvince = !filterProvinceId || wh.provinceId === filterProvinceId;

    return matchKeyword && matchType && matchProvince;
  });

  // Mở modal thêm mới
  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'SPOKE_POST_OFFICE',
      provinceId: isBranchManager && user?.managedProvinceId ? user.managedProvinceId : undefined,
      capacityPackages: 50000,
      isActive: true,
      latitude: 21.0285,
      longitude: 105.8542,
    });
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleOpenEditModal = (record: Warehouse) => {
    setEditingWarehouse(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      type: record.type,
      provinceId: record.provinceId,
      districtId: record.districtId,
      address: record.address,
      latitude: record.latitude,
      longitude: record.longitude,
      capacityPackages: record.capacityPackages || 50000,
      isActive: record.isActive,
    });
    setIsModalOpen(true);
  };

  // Lưu thông tin kho bưu cục
  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      const payload: WarehouseRequest = {
        code: values.code.trim().toUpperCase(),
        name: values.name.trim(),
        type: values.type,
        provinceId: values.provinceId,
        districtId: values.districtId || 0,
        address: values.address.trim(),
        latitude: parseFloat(values.latitude),
        longitude: parseFloat(values.longitude),
        capacityPackages: values.capacityPackages || 50000,
        isActive: values.isActive ?? true,
      };

      if (editingWarehouse) {
        await locationApi.updateWarehouse(editingWarehouse.id, payload);
        message.success(`Đã cập nhật kho/bưu cục [${payload.name}] thành công!`);
      } else {
        await locationApi.createWarehouse(payload);
        message.success(`Đã thêm mới kho/bưu cục [${payload.name}] thành công!`);
      }

      setIsModalOpen(false);
      fetchWarehouses();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin kho bưu cục!');
    } finally {
      setSubmitting(false);
    }
  };

  // Đổi trạng thái hoạt động (Active/Inactive)
  const handleToggleStatus = async (record: Warehouse) => {
    try {
      await locationApi.toggleWarehouseStatus(record.id);
      message.success(
        `Đã ${record.isActive ? 'tạm dừng' : 'kích hoạt lại'} hoạt động của bưu cục [${record.code}]!`
      );
      fetchWarehouses();
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Không thể đổi trạng thái bưu cục!');
    }
  };

  // Lấy vị trí GPS hiện tại của máy tính / điện thoại
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      message.error('Trình duyệt không hỗ trợ định vị GPS!');
      return;
    }
    const hide = message.loading('Đang lấy tọa độ GPS từ thiết bị...', 0);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        hide();
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        form.setFieldsValue({ latitude: lat, longitude: lng });
        message.success(`Đã lấy vị trí GPS thành công: (${lat}, ${lng})`);
      },
      (err) => {
        hide();
        message.error(`Không thể lấy vị trí GPS: ${err.message}. Bạn có thể chọn trên bản đồ!`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Mở bản đồ Google Maps / Leaflet tương tác
  const handleOpenMapPicker = () => {
    const curLat = form.getFieldValue('latitude');
    const curLng = form.getFieldValue('longitude');
    setMapInitialCoords({
      lat: curLat ? parseFloat(curLat) : 21.0285,
      lng: curLng ? parseFloat(curLng) : 105.8542,
    });
    setIsMapModalOpen(true);
  };

  // Nhận tọa độ chọn từ bản đồ
  const handleSelectLocationFromMap = (lat: number, lng: number, addressText?: string) => {
    form.setFieldsValue({
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6)),
    });
    if (addressText && (!form.getFieldValue('address') || form.getFieldValue('address').length < 5)) {
      form.setFieldsValue({ address: addressText });
    }
    message.success(`Đã cập nhật tọa độ bưu cục: (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
  };

  // Mở Google Maps xem thực tế
  const openGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // Thống kê nhanh
  const totalCount = warehouses.length;
  const regionalHubCount = warehouses.filter((w) => w.type === 'REGIONAL_HUB').length;
  const hubCount = warehouses.filter((w) => w.type === 'HUB').length;
  const spokeCount = warehouses.filter((w) => w.type === 'SPOKE_POST_OFFICE').length;
  const activeCount = warehouses.filter((w) => w.isActive).length;

  const columns = [
    {
      title: 'Mã bưu cục',
      dataIndex: 'code',
      key: 'code',
      width: 170,
      render: (code: string, record: Warehouse) => {
        let tagColor = 'blue';
        if (record.type === 'REGIONAL_HUB') tagColor = 'purple';
        else if (record.type === 'HUB') tagColor = 'volcano';

        return (
          <div>
            <Tag color={tagColor} className="font-mono font-bold text-xs">
              {code}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Tên kho / Bưu cục',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Warehouse) => (
        <div>
          <div className="font-bold text-gray-800 flex items-center gap-1.5">
            {record.type === 'REGIONAL_HUB' ? (
              <Building2 size={16} className="text-purple-600" />
            ) : record.type === 'HUB' ? (
              <Building2 size={16} className="text-orange-600" />
            ) : (
              <WarehouseIcon size={16} className="text-blue-600" />
            )}
            <span>{name}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {record.type === 'REGIONAL_HUB' ? (
              <span className="text-purple-600 font-semibold">🌐 Kho trung chuyển khu vực / miền (Gom hàng liên tỉnh)</span>
            ) : record.type === 'HUB' ? (
              <span className="text-orange-600 font-semibold">🏢 Trung tâm chia chọn tỉnh (HUB)</span>
            ) : (
              <span className="text-blue-600 font-semibold">🛵 Bưu cục phát chặng cuối (SPOKE)</span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Tỉnh / Thành phố',
      dataIndex: 'provinceId',
      key: 'provinceId',
      width: 150,
      render: (provId: number) => {
        const prov = provinces.find((p) => p.id === provId);
        return <span className="font-medium text-gray-700">{prov ? prov.name : `Tỉnh #${provId}`}</span>;
      },
    },
    {
      title: 'Địa chỉ chi tiết',
      dataIndex: 'address',
      key: 'address',
      render: (addr: string) => <span className="text-gray-600 text-xs">{addr}</span>,
    },
    {
      title: 'Tọa độ GPS & Google Map',
      key: 'coords',
      width: 220,
      render: (_: any, record: Warehouse) => {
        const hasCoords = record.latitude && record.longitude;
        return (
          <div>
            {hasCoords ? (
              <div className="flex flex-col gap-1">
                <div className="text-[11px] font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md inline-block">
                  📍 {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
                </div>
                <button
                  type="button"
                  onClick={() => openGoogleMaps(record.latitude, record.longitude)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 mt-0.5 hover:underline"
                >
                  <ExternalLink size={12} />
                  <span>Xem trên Google Maps</span>
                </button>
              </div>
            ) : (
              <Tag color="default">Chưa có tọa độ</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Sức chứa',
      dataIndex: 'capacityPackages',
      key: 'capacityPackages',
      width: 120,
      render: (cap: number) => (
        <span className="font-semibold text-gray-700 text-xs">
          {(cap || 50000).toLocaleString('vi-VN')} kiện
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      render: (isActive: boolean, record: Warehouse) => (
        <Popconfirm
          title={`Bạn có chắc muốn ${isActive ? 'tạm dừng' : 'kích hoạt'} bưu cục này?`}
          onConfirm={() => handleToggleStatus(record)}
          okText="Đồng ý"
          cancelText="Hủy"
        >
          <div className="cursor-pointer">
            {isActive ? (
              <Tag icon={<CheckCircle size={12} className="inline mr-1" />} color="success">
                Đang hoạt động
              </Tag>
            ) : (
              <Tag icon={<AlertCircle size={12} className="inline mr-1" />} color="error">
                Tạm dừng
              </Tag>
            )}
          </div>
        </Popconfirm>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 90,
      render: (_: any, record: Warehouse) => (
        <Button
          size="small"
          type="text"
          icon={<Edit size={14} className="text-blue-600" />}
          onClick={() => handleOpenEditModal(record)}
          className="text-blue-600 hover:bg-blue-50"
        >
          Sửa
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Tiêu đề & Nút thêm mới */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-800 m-0">
                {isAdmin
                  ? 'Quản lý Hệ Thống Kho & Bưu Cục Toàn Quốc'
                  : `Quản lý Bưu Cục Chi Nhánh ${user?.managedProvinceName || ''}`}
              </h1>
              <p className="text-gray-500 text-xs mt-0.5 mb-0">
                Khai báo thông tin kho bưu cục, tọa độ Google Maps để tự động định tuyến đơn hàng gần nhất
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            icon={<RefreshCw size={15} />}
            onClick={fetchWarehouses}
            loading={loading}
            className="rounded-xl h-10"
          >
            Làm mới
          </Button>

          {(isAdmin || isBranchManager) && (
            <Button
              type="primary"
              icon={<Plus size={16} />}
              onClick={handleOpenCreateModal}
              className="bg-red-600 hover:bg-red-700 font-bold border-none h-10 px-4 rounded-xl shadow-md flex items-center justify-center"
            >
              Thêm bưu cục mới
            </Button>
          )}
        </div>
      </div>

      {/* 5 Thẻ thống kê */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-white p-2">
            <div className="text-gray-500 text-xs font-semibold uppercase">Tổng bưu cục/kho</div>
            <div className="text-2xl font-black text-gray-800 mt-1">{totalCount}</div>
            <div className="text-[11px] text-gray-400">Toàn hệ thống</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-purple-100 shadow-xs bg-purple-50/50 p-2 border">
            <div className="text-purple-700 text-xs font-semibold uppercase">Kho trung chuyển miền</div>
            <div className="text-2xl font-black text-purple-700 mt-1">{regionalHubCount}</div>
            <div className="text-[11px] text-purple-600">Gom hàng liên tỉnh</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-white p-2">
            <div className="text-orange-600 text-xs font-semibold uppercase">HUB tỉnh / thành</div>
            <div className="text-2xl font-black text-orange-600 mt-1">{hubCount}</div>
            <div className="text-[11px] text-orange-500">Khai thác cấp tỉnh</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-white p-2">
            <div className="text-blue-600 text-xs font-semibold uppercase">Bưu cục phát (SPOKE)</div>
            <div className="text-2xl font-black text-blue-600 mt-1">{spokeCount}</div>
            <div className="text-[11px] text-blue-500">Phát hàng chặng cuối</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-white p-2">
            <div className="text-green-600 text-xs font-semibold uppercase">Đang hoạt động</div>
            <div className="text-2xl font-black text-green-600 mt-1">{activeCount}</div>
            <div className="text-[11px] text-green-500">Sẵn sàng nhận đơn</div>
          </Card>
        </Col>
      </Row>

      {/* Thanh lọc & Bảng danh sách */}
      <Card className="rounded-2xl shadow-xs border-gray-100">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <Input
              prefix={<Search size={16} className="text-gray-400" />}
              placeholder="Tìm theo tên bưu cục, mã kho, địa chỉ..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              allowClear
              className="w-full md:w-72 rounded-lg"
            />

            <Select
              value={filterType}
              onChange={(val) => setFilterType(val)}
              className="w-48 rounded-lg"
              options={[
                { label: 'Tất cả loại kho', value: 'ALL' },
                { label: '🌐 Kho miền (REGIONAL HUB)', value: 'REGIONAL_HUB' },
                { label: '🏢 HUB tỉnh (Trung tâm)', value: 'HUB' },
                { label: '🛵 SPOKE (Bưu cục phát)', value: 'SPOKE_POST_OFFICE' },
              ]}
            />

            {isAdmin && (
              <Select
                placeholder="Lọc theo Tỉnh/TP"
                allowClear
                value={filterProvinceId}
                onChange={(val) => setFilterProvinceId(val)}
                className="w-48 rounded-lg"
                options={[
                  { label: 'Toàn quốc', value: undefined },
                  ...provinces.map((p) => ({ label: p.name, value: p.id })),
                ]}
              />
            )}
          </div>
        </div>

        <Table
          dataSource={filteredWarehouses}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 1000 }}
          className="rounded-xl overflow-hidden"
        />
      </Card>

      {/* Modal Thêm Mới / Chỉnh Sửa Kho Bưu Cục */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-gray-800">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
              <Building2 size={18} />
            </div>
            <span>{editingWarehouse ? 'Cập Nhật Thông Tin Bưu Cục' : 'Thêm Mới Kho / Bưu Cục Vận Hành'}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Mã bưu cục / Kho</span>}
                name="code"
                rules={[{ required: true, message: 'Vui lòng nhập mã bưu cục (VD: SPOKE_HN_CG)' }]}
                tooltip="Mã định danh duy nhất (VD: HUB_HN_NORTH, SPOKE_HN_HBT)"
              >
                <Input
                  placeholder="VD: SPOKE_HN_CG"
                  disabled={!!editingWarehouse}
                  className="font-mono font-bold uppercase rounded-lg"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Tên kho / bưu cục</span>}
                name="name"
                rules={[{ required: true, message: 'Vui lòng nhập tên bưu cục' }]}
              >
                <Input placeholder="VD: Bưu cục Cầu Giấy" className="rounded-lg font-medium" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Phân loại kho</span>}
                name="type"
                rules={[{ required: true, message: 'Vui lòng chọn loại kho' }]}
              >
                <Select
                  options={[
                    { label: '🌐 Kho trung chuyển khu vực / miền (REGIONAL HUB - Gom hàng liên tỉnh & điều vận)', value: 'REGIONAL_HUB' },
                    { label: '🏢 Trung tâm chia chọn & khai thác tỉnh (HUB)', value: 'HUB' },
                    { label: '🛵 Bưu cục giao dịch & phát chặng cuối (SPOKE)', value: 'SPOKE_POST_OFFICE' },
                  ]}
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Tỉnh / Thành phố trực thuộc</span>}
                name="provinceId"
                rules={[{ required: true, message: 'Vui lòng chọn Tỉnh/Thành phố' }]}
              >
                <Select
                  placeholder="Chọn Tỉnh / TP"
                  disabled={isBranchManager && !isAdmin}
                  options={provinces.map((p) => ({ label: p.name, value: p.id }))}
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label={<span className="font-semibold text-gray-700">Địa chỉ cụ thể của bưu cục</span>}
            name="address"
            rules={[{ required: true, message: 'Vui lòng nhập địa chỉ cụ thể' }]}
          >
            <Input
              placeholder="VD: Số 200 Đường Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội"
              className="rounded-lg"
            />
          </Form.Item>

          {/* Phần Tọa Độ GPS & Google Maps - Trọng tâm của hệ thống định tuyến */}
          <div className="bg-red-50/70 border border-red-200 rounded-xl p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-red-600 shrink-0" />
                <span className="font-bold text-gray-800 text-sm">Tọa độ vị trí bưu cục (Bản đồ Google Maps)</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="small"
                  type="primary"
                  icon={<MapPin size={13} />}
                  onClick={handleOpenMapPicker}
                  className="bg-red-600 hover:bg-red-700 text-xs font-semibold rounded-lg flex items-center gap-1 border-none"
                >
                  Chọn trên bản đồ
                </Button>
                <Button
                  size="small"
                  icon={<Navigation size={13} />}
                  onClick={handleGetDeviceLocation}
                  className="text-xs text-blue-600 border-blue-300 rounded-lg flex items-center gap-1"
                >
                  Lấy GPS thiết bị
                </Button>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              * Tọa độ kinh độ và vĩ độ được hệ thống sử dụng để tự động tính toán khoảng cách Haversine và chuyển đơn hàng của Shop về bưu cục gần nhất.
            </p>

            <Row gutter={12}>
              <Col xs={12}>
                <Form.Item
                  label={<span className="text-xs font-semibold text-gray-700">Vĩ độ (Latitude)</span>}
                  name="latitude"
                  rules={[{ required: true, message: 'Vui lòng nhập hoặc chọn Vĩ độ' }]}
                  className="mb-0"
                >
                  <InputNumber
                    step={0.000001}
                    placeholder="VD: 21.03130"
                    className="w-full font-mono rounded-lg"
                  />
                </Form.Item>
              </Col>
              <Col xs={12}>
                <Form.Item
                  label={<span className="text-xs font-semibold text-gray-700">Kinh độ (Longitude)</span>}
                  name="longitude"
                  rules={[{ required: true, message: 'Vui lòng nhập hoặc chọn Kinh độ' }]}
                  className="mb-0"
                >
                  <InputNumber
                    step={0.000001}
                    placeholder="VD: 105.78360"
                    className="w-full font-mono rounded-lg"
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Sức chứa tối đa (kiện hàng)</span>}
                name="capacityPackages"
              >
                <InputNumber
                  min={1000}
                  max={1000000}
                  step={5000}
                  className="w-full rounded-lg"
                  placeholder="50000"
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label={<span className="font-semibold text-gray-700">Trạng thái hoạt động</span>}
                name="isActive"
                valuePropName="checked"
              >
                <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Tạm dừng" />
              </Form.Item>
            </Col>
          </Row>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button onClick={() => setIsModalOpen(false)} className="rounded-lg">
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg border-none px-6"
            >
              {editingWarehouse ? 'Lưu thay đổi' : 'Tạo bưu cục'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Bản Đồ Leaflet / Google Maps Picker */}
      <LocationPickerModal
        open={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        initialLat={mapInitialCoords.lat}
        initialLng={mapInitialCoords.lng}
        onSelectLocation={handleSelectLocationFromMap}
        title="Chọn Vị Trí Kho / Bưu Cục Trên Bản Đồ"
      />
    </div>
  );
};
