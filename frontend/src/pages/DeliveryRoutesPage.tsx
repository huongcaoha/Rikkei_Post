import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, Tag, Space, message, Row, Col, Tabs, Alert, Tooltip } from 'antd';
import { Route as RouteIcon, Plus, Edit2, UserCheck, MapPin, Building2, Tag as TagIcon, Truck } from 'lucide-react';
import { routeApi } from '../api/route';
import { staffApi } from '../api/staff';
import { locationApi } from '../api/location';
import { truckApi } from '../api/truck';
import { useAuth } from '../context/AuthContext';
import { DeliveryRoute, StaffUser, Province, Ward } from '../types';

export const DeliveryRoutesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const userWarehouseId = user?.assignedPostOfficeId || (user as any)?.warehouseId;
  const userPostOfficeName = user?.postOfficeName || (userWarehouseId ? `Bưu cục ID ${userWarehouseId}` : '');

  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [shippers, setShippers] = useState<StaffUser[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: number; fullName: string; phoneNumber?: string; assignedPostOfficeId?: number; postOfficeName?: string }>>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<string>('MOTORBIKE_DELIVERY');
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<DeliveryRoute | null>(null);
  const [form] = Form.useForm();

  const selectedRouteType = Form.useWatch('routeType', form);

  const loadData = async () => {
    setLoading(true);
    try {
      const [routeData, shipperData, provData, driverRes] = await Promise.all([
        routeApi.getRoutes(
          selectedProvinceId,
          !isAdmin && userWarehouseId ? userWarehouseId : undefined,
          undefined,
          activeTab
        ),
        staffApi.getStaffList('ROLE_SHIPPER'),
        locationApi.getProvinces(),
        truckApi.getTruckDrivers()
      ]);
      setRoutes(routeData);
      setShippers(shipperData);
      setProvinces(provData);
      if (driverRes.success) {
        setDrivers(driverRes.data);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải dữ liệu tuyến đường!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProvinceId, activeTab]);

  const handleProvinceChangeInModal = async (provinceId: number) => {
    form.setFieldsValue({ wardName: undefined });
    if (!provinceId) {
      setWards([]);
      return;
    }
    try {
      const wardData = await locationApi.getWardsByProvince(provinceId);
      setWards(wardData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRoute(null);
    form.resetFields();
    setWards([]);
    form.setFieldsValue({
      routeType: activeTab === 'ALL' ? 'MOTORBIKE_DELIVERY' : activeTab,
      postOfficeName: userPostOfficeName || undefined,
      postOfficeId: userWarehouseId || undefined,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (record: DeliveryRoute) => {
    setEditingRoute(record);
    if (record.provinceId) {
      try {
        const wardData = await locationApi.getWardsByProvince(record.provinceId);
        setWards(wardData);
      } catch (e) {
        console.error(e);
      }
    }
    form.setFieldsValue({
      routeCode: record.routeCode,
      routeName: record.routeName,
      routeType: record.routeType || 'MOTORBIKE_DELIVERY',
      provinceId: record.provinceId,
      districtName: record.districtName,
      wardName: record.wardName,
      streetKeywords: record.streetKeywords,
      postOfficeName: record.postOfficeName,
      postOfficeId: record.postOfficeId,
      assignedShipperId: record.assignedShipperId,
      description: record.description,
      isActive: record.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const prov = provinces.find((p) => p.id === values.provinceId);
      const isTruckRoute = values.routeType === 'TRUCK_TRANSFER';
      let assigneeName: string | undefined = undefined;
      let assigneePhone: string | undefined = undefined;

      if (isTruckRoute) {
        const driver = drivers.find(d => d.id === values.assignedShipperId);
        if (driver) {
          assigneeName = driver.fullName;
          assigneePhone = driver.phoneNumber;
        }
      } else {
        const shipper = shippers.find(s => s.id === values.assignedShipperId);
        if (shipper) {
          assigneeName = shipper.fullName;
          assigneePhone = shipper.phoneNumber;
        }
      }

      const payload: Partial<DeliveryRoute> = {
        routeCode: values.routeCode,
        routeName: values.routeName,
        routeType: values.routeType || 'MOTORBIKE_DELIVERY',
        provinceId: values.provinceId,
        provinceName: prov ? prov.name : '',
        districtName: values.districtName,
        wardName: values.wardName,
        streetKeywords: values.streetKeywords,
        postOfficeId: !isAdmin && userWarehouseId ? userWarehouseId : (values.postOfficeId || undefined),
        postOfficeName: !isAdmin && userPostOfficeName ? userPostOfficeName : values.postOfficeName,
        assignedShipperId: values.assignedShipperId,
        assignedShipperName: assigneeName,
        assignedShipperPhone: assigneePhone,
        description: values.description,
        isActive: values.isActive ?? true,
      };

      if (editingRoute) {
        await routeApi.updateRoute(editingRoute.id, payload);
        message.success('Cập nhật tuyến đường thành công!');
      } else {
        await routeApi.createRoute(payload);
        message.success('Tạo tuyến đường mới thành công!');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác không thành công!');
    }
  };

  const columns = [
    {
      title: 'Loại tuyến',
      key: 'routeType',
      width: 150,
      render: (_: any, record: DeliveryRoute) => {
        const isTruck = record.routeType === 'TRUCK_TRANSFER';
        return (
          <Tag color={isTruck ? 'purple' : 'cyan'} className="font-semibold px-2 py-0.5 rounded-md">
            {isTruck ? '🚛 Ô tô gom/Hub' : '🛵 Xe máy Shipper'}
          </Tag>
        );
      }
    },
    {
      title: 'Mã & Tên tuyến đường',
      key: 'route',
      render: (_: any, record: DeliveryRoute) => (
        <div>
          <div className="font-bold text-gray-800">{record.routeName}</div>
          <div className="text-xs text-red-600 font-mono font-semibold">{record.routeCode}</div>
          {record.description && <div className="text-xs text-gray-400 mt-0.5">{record.description}</div>}
        </div>
      ),
    },
    {
      title: 'Khu vực Xã / Phường / Tỉnh',
      key: 'location',
      render: (_: any, record: DeliveryRoute) => (
        <div className="text-xs space-y-1">
          <div className="font-medium text-gray-700 flex items-center">
            <MapPin size={12} className="mr-1 text-red-500" />
            {record.wardName ? `${record.wardName}, ` : ''}{record.districtName ? `${record.districtName}, ` : ''}{record.provinceName || 'Tỉnh ID: ' + record.provinceId}
          </div>
          {record.postOfficeName && (
            <div className="text-gray-500 flex items-center font-medium">
              <Building2 size={12} className="mr-1 text-blue-500" />
              Bưu cục: {record.postOfficeName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Từ khóa tuyến phố / Phạm vi gom',
      dataIndex: 'streetKeywords',
      key: 'streetKeywords',
      render: (keywords: string) => {
        if (!keywords) return <span className="text-gray-400 italic">Toàn bộ địa bàn xã/phường</span>;
        const list = keywords.split(/[,;]/).map((k) => k.trim()).filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {list.map((kw, i) => (
              <Tag key={i} color="orange" className="text-xs">
                {kw}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: 'Nhân sự phụ trách tuyến',
      key: 'assignee',
      render: (_: any, record: DeliveryRoute) => {
        const isTruck = record.routeType === 'TRUCK_TRANSFER';
        if (!record.assignedShipperId) {
          return <Tag color="default">Chưa phân công</Tag>;
        }
        return (
          <div className="text-sm">
            <div className={`font-semibold ${isTruck ? 'text-purple-700' : 'text-blue-700'} flex items-center`}>
              {isTruck ? <Truck size={14} className="mr-1 text-purple-600" /> : <UserCheck size={14} className="mr-1 text-blue-600" />}
              {record.assignedShipperName || `ID #${record.assignedShipperId}`}
            </div>
            <div className="text-xs text-gray-500 font-mono">{record.assignedShipperPhone || 'Chưa có SĐT'}</div>
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Đang kích hoạt' : 'Ngưng phục vụ'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 110,
      render: (_: any, record: DeliveryRoute) => (
        <Button
          type="link"
          icon={<Edit2 size={15} />}
          onClick={() => handleOpenEditModal(record)}
          className="text-blue-600 hover:text-blue-800"
        >
          Sửa & Gán
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <RouteIcon className="mr-2 text-red-600" size={28} />
            Quản Lý Tuyến Đường & Phân Tuyến Bưu Tá
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Phân chia tuyến đường giao hàng xe máy cho Shipper và tuyến ô tô gom hàng / trung chuyển Hub
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={handleOpenCreateModal}
          className="bg-red-600 hover:bg-red-700 font-semibold h-10 px-5 shadow-sm rounded-xl"
        >
          Thêm tuyến đường mới
        </Button>
      </div>

      {!isAdmin && userWarehouseId && (
        <Alert
          message={
            <div className="text-xs text-blue-800">
              <span className="font-bold">Đang hiển thị dữ liệu bưu cục quản lý:</span> {userPostOfficeName} (ID: {userWarehouseId}). Khi tạo mới tuyến đường, thông tin bưu cục sẽ được tự động gắn vào kho của bạn.
            </div>
          }
          type="info"
          showIcon
          className="rounded-xl border-blue-200 bg-blue-50/60"
        />
      )}

      <Card className="shadow-xs border-gray-200 rounded-2xl">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          items={[
            {
              key: 'MOTORBIKE_DELIVERY',
              label: (
                <span className="font-semibold flex items-center gap-1.5">
                  🛵 Tuyến Shipper Giao Hàng Xe Máy
                </span>
              ),
            },
            {
              key: 'TRUCK_TRANSFER',
              label: (
                <span className="font-semibold flex items-center gap-1.5">
                  🚛 Tuyến Tài Xế Ô Tô Gom & Chuyển Kho
                </span>
              ),
            },
            {
              key: 'ALL',
              label: <span className="font-semibold">📋 Tất cả tuyến</span>,
            },
          ]}
        />

        <div className="flex items-center space-x-4 mb-4 mt-2">
          <div className="text-sm font-medium text-gray-700">Lọc theo Tỉnh/TP:</div>
          <Select
            allowClear
            showSearch
            placeholder="Tất cả Tỉnh / Thành"
            className="w-64"
            value={selectedProvinceId}
            onChange={(val) => setSelectedProvinceId(val)}
            filterOption={(input, option) =>
              (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
            }
            options={provinces.map((p) => ({ label: p.name, value: p.id }))}
          />
        </div>

        <Table
          dataSource={routes}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          className="rounded-xl overflow-hidden"
        />
      </Card>

      {/* Modal Thêm / Cập nhật Tuyến đường */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800 border-b pb-3">
            <RouteIcon className="text-red-600" size={20} />
            <span>{editingRoute ? `Cập nhật tuyến: ${editingRoute.routeName}` : 'Tạo tuyến đường mới'}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="pt-3">
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item
                name="routeCode"
                label="Mã tuyến"
                rules={[{ required: true, message: 'Nhập mã tuyến (e.g. ROUTE_HN_CG_01)' }]}
              >
                <Input placeholder="ROUTE_HN_CG_01" className="font-mono font-semibold" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item
                name="routeName"
                label="Tên tuyến đường / Khu vực"
                rules={[{ required: true, message: 'Vui lòng nhập tên tuyến' }]}
              >
                <Input placeholder="Tuyến Cầu Giấy - Duy Tân & Trần Thái Tông" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="routeType"
                label="Loại hình phân tuyến"
                rules={[{ required: true, message: 'Vui lòng chọn loại tuyến' }]}
              >
                <Select
                  options={[
                    { label: '🛵 Tuyến Shipper giao hàng bằng xe máy', value: 'MOTORBIKE_DELIVERY' },
                    { label: '🚛 Tuyến Tài xế ô tô gom hàng / chuyển Hub', value: 'TRUCK_TRANSFER' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="postOfficeName"
                label="Bưu cục quản lý tuyến"
                extra={!isAdmin && userWarehouseId ? "Mặc định bưu cục bạn đang trực thuộc" : undefined}
              >
                <Input
                  placeholder="e.g. Bưu cục Cầu Giấy"
                  disabled={!isAdmin && !!userWarehouseId}
                  className={!isAdmin && !!userWarehouseId ? "bg-gray-50 text-gray-700 font-semibold" : ""}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="provinceId"
                label="Tỉnh / Thành phố"
                rules={[{ required: true, message: 'Chọn tỉnh thành' }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn Tỉnh / Thành"
                  onChange={handleProvinceChangeInModal}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={provinces.map((p) => ({ label: p.name, value: p.id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="wardName" label="Xã / Phường phụ trách">
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn Xã / Phường"
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={wards.map((w) => ({ label: w.name, value: w.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="streetKeywords"
            label="Từ khóa tuyến phố, đường (Cách nhau bởi dấu phẩy)"
            extra="Hệ thống dựa vào từ khóa này để tự động gán Shipper/Tài xế khi có đơn lấy hàng tận nơi hoặc giao chặng cuối."
          >
            <Input.TextArea
              rows={2}
              placeholder="e.g. Duy Tân, Trần Thái Tông, Tôn Thất Thuyết, Dịch Vọng Hậu"
            />
          </Form.Item>

          <Form.Item
            name="assignedShipperId"
            label={
              selectedRouteType === 'TRUCK_TRANSFER'
                ? 'Phân công Tài xế ô tô phụ trách tuyến gom / trung chuyển'
                : 'Phân công Bưu tá (Shipper) xe máy phụ trách tuyến giao nhận'
            }
          >
            {selectedRouteType === 'TRUCK_TRANSFER' ? (
              <Select
                allowClear
                placeholder="Chọn tài xế xe tải (ROLE_TRUCK_DRIVER)"
                options={drivers
                  .filter(d => !userWarehouseId || !d.assignedPostOfficeId || d.assignedPostOfficeId === userWarehouseId)
                  .map(d => ({
                    label: `👨‍✈️ ${d.fullName} (SĐT: ${d.phoneNumber || 'N/A'}) ${d.postOfficeName ? `[${d.postOfficeName}]` : ''}`,
                    value: d.id,
                  }))}
              />
            ) : (
              <Select
                allowClear
                placeholder="Chọn bưu tá xe máy (ROLE_SHIPPER)"
                options={shippers
                  .filter(s => !userWarehouseId || !(s as any).assignedPostOfficeId || (s as any).assignedPostOfficeId === userWarehouseId)
                  .map((s) => ({
                    label: `🛵 ${s.fullName} (SĐT: ${s.phoneNumber || s.username})`,
                    value: s.id,
                  }))}
              />
            )}
          </Form.Item>

          <Form.Item name="description" label="Ghi chú chi tiết">
            <Input placeholder="Ghi chú lộ trình, khung giờ gom hoặc lưu ý giao nhận đặc thù" />
          </Form.Item>

          {editingRoute && (
            <Form.Item name="isActive" label="Trạng thái">
              <Select
                options={[
                  { label: 'Đang kích hoạt', value: true },
                  { label: 'Ngưng phục vụ', value: false },
                ]}
              />
            </Form.Item>
          )}

          <div className="flex justify-end space-x-3 mt-4 pt-3 border-t">
            <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-red-600 hover:bg-red-700">
              {editingRoute ? 'Lưu thay đổi' : 'Tạo tuyến'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default DeliveryRoutesPage;
