import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, Tag, Space, message, Row, Col } from 'antd';
import { Route as RouteIcon, Plus, Edit2, UserCheck, MapPin, Building2, Tag as TagIcon } from 'lucide-react';
import { routeApi } from '../api/route';
import { staffApi } from '../api/staff';
import { locationApi } from '../api/location';
import { DeliveryRoute, StaffUser, Province, Ward } from '../types';

export const DeliveryRoutesPage: React.FC = () => {
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [shippers, setShippers] = useState<StaffUser[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState<number | undefined>(undefined);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<DeliveryRoute | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [routeData, shipperData, provData] = await Promise.all([
        routeApi.getRoutes(selectedProvinceId),
        staffApi.getStaffList('ROLE_SHIPPER'),
        locationApi.getProvinces(),
      ]);
      setRoutes(routeData);
      setShippers(shipperData);
      setProvinces(provData);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải dữ liệu tuyến đường!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProvinceId]);

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
      provinceId: record.provinceId,
      districtName: record.districtName,
      wardName: record.wardName,
      streetKeywords: record.streetKeywords,
      postOfficeName: record.postOfficeName,
      assignedShipperId: record.assignedShipperId,
      description: record.description,
      isActive: record.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      const prov = provinces.find((p) => p.id === values.provinceId);
      const selectedShipper = shippers.find((s) => s.id === values.assignedShipperId);

      const payload: Partial<DeliveryRoute> = {
        routeCode: values.routeCode,
        routeName: values.routeName,
        provinceId: values.provinceId,
        provinceName: prov ? prov.name : '',
        districtName: values.districtName,
        wardName: values.wardName,
        streetKeywords: values.streetKeywords,
        postOfficeName: values.postOfficeName,
        assignedShipperId: values.assignedShipperId,
        assignedShipperName: selectedShipper ? selectedShipper.fullName : undefined,
        assignedShipperPhone: selectedShipper ? selectedShipper.phoneNumber : undefined,
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
            <div className="text-gray-500 flex items-center">
              <Building2 size={12} className="mr-1 text-blue-500" />
              Bưu cục: {record.postOfficeName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Từ khóa tuyến phố (Đường, ngõ)',
      dataIndex: 'streetKeywords',
      key: 'streetKeywords',
      render: (keywords: string) => {
        if (!keywords) return <span className="text-gray-400 italic">Tất cả tuyến đường xã</span>;
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
      title: 'Bưu tá (Shipper) phụ trách',
      key: 'shipper',
      render: (_: any, record: DeliveryRoute) => {
        if (!record.assignedShipperId) {
          return <Tag color="default">Chưa phân công</Tag>;
        }
        return (
          <div className="text-sm">
            <div className="font-semibold text-blue-700 flex items-center">
              <UserCheck size={14} className="mr-1 text-blue-600" />
              {record.assignedShipperName || `Shipper #${record.assignedShipperId}`}
            </div>
            <div className="text-xs text-gray-500 font-mono">{record.assignedShipperPhone}</div>
          </div>
        );
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Đang kích hoạt' : 'Ngưng phục vụ'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <RouteIcon className="mr-2 text-red-600" size={28} />
            Quản Lý Tuyến Đường & Phân Tuyến Bưu Tá
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Thiết lập các tuyến đường, khu vực trực thuộc phường/xã để quản lý bưu cục phân chia địa bàn phụ trách cho Shipper.
          </p>
        </div>
        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={handleOpenCreateModal}
          className="bg-red-600 hover:bg-red-700 font-semibold h-10 px-5 shadow-sm"
        >
          Thêm tuyến đường mới
        </Button>
      </div>

      <Card className="shadow-xs border-gray-200">
        <div className="flex items-center space-x-4 mb-4">
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
          pagination={{ pageSize: 10 }}
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
        width={680}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="pt-3">
          <Row gutter={16}>
            <Col span={10}>
              <Form.Item
                name="routeCode"
                label="Mã tuyến"
                rules={[{ required: true, message: 'Nhập mã tuyến (e.g. ROUTE_HN_CG_01)' }]}
              >
                <Input placeholder="ROUTE_HN_CG_01" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item
                name="routeName"
                label="Tên tuyến đường / Khu vực"
                rules={[{ required: true, message: 'Vui lòng nhập tên tuyến' }]}
              >
                <Input placeholder="Tuyến Duy Tân - Trần Thái Tông - Dịch Vọng Hậu" />
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
            extra="Hệ thống sẽ dựa vào từ khóa này để tự động gán Shipper khi Shop tạo đơn hàng tận nơi (DOOR_PICKUP)."
          >
            <Input.TextArea
              rows={2}
              placeholder="e.g. Duy Tân, Trần Thái Tông, Tôn Thất Thuyết, Cầu Giấy, Xuân Thủy"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="postOfficeName" label="Bưu cục quản lý">
                <Input placeholder="e.g. Bưu cục Cầu Giấy" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="assignedShipperId"
                label="Phân công Bưu tá (Shipper) phụ trách tuyến"
              >
                <Select
                  allowClear
                  placeholder="Chọn bưu tá chạy tuyến này"
                  options={shippers.map((s) => ({
                    label: `${s.fullName} (${s.phoneNumber || s.username})`,
                    value: s.id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Ghi chú chi tiết">
            <Input placeholder="Ghi chú khu vực hoặc lưu ý giao nhận đặc thù" />
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
