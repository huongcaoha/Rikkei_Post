import React, { useState, useEffect } from 'react';
import {
  Table,
  Card,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Modal,
  Form,
  InputNumber,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  CarOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserSwitchOutlined,
  SearchOutlined,
  SyncOutlined,
  ToolOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { truckApi } from '../api/truck';
import { locationApi } from '../api/location';
import { Truck, Warehouse, CreateTruckRequest, UpdateTruckRequest } from '../types';
import { useAuth } from '../context/AuthContext';

export const TruckManagementPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isManager = user?.roles?.some(r => ['ROLE_ADMIN', 'ROLE_BRANCH_MANAGER', 'ROLE_POST_OFFICE_MANAGER'].includes(r));

  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: number; username: string; fullName: string; phoneNumber: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined);

  // Modal create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [form] = Form.useForm();

  // Modal assign driver
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningTruck, setAssigningTruck] = useState<Truck | null>(null);
  const [assignForm] = Form.useForm();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [trucksRes, whRes, driversRes] = await Promise.all([
        truckApi.getTrucks({
          warehouseId: selectedWarehouseId,
          status: selectedStatus,
          keyword: keyword.trim() || undefined
        }),
        locationApi.getWarehouses(),
        truckApi.getTruckDrivers()
      ]);

      if (trucksRes.success) setTrucks(trucksRes.data);
      if (Array.isArray(whRes)) setWarehouses(whRes);
      if (driversRes.success) setDrivers(driversRes.data);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải danh sách xe tải');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedWarehouseId, selectedStatus]);

  const handleSearch = () => {
    fetchData();
  };

  const handleOpenCreateModal = () => {
    setEditingTruck(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'AT_WAREHOUSE',
      payloadKg: 2500,
      currentWarehouseId: warehouses.length > 0 ? warehouses[0].id : undefined
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (truck: Truck) => {
    setEditingTruck(truck);
    form.setFieldsValue({
      truckType: truck.truckType,
      payloadKg: truck.payloadKg,
      licensePlate: truck.licensePlate,
      currentWarehouseId: truck.currentWarehouseId,
      status: truck.status,
      currentDriverId: truck.currentDriverId,
      notes: truck.notes
    });
    setIsModalOpen(true);
  };

  const handleSaveTruck = async () => {
    try {
      const values = await form.validateFields();
      if (editingTruck) {
        const updateData: UpdateTruckRequest = {
          ...values,
          currentDriverId: values.currentDriverId || 0
        };
        const res = await truckApi.updateTruck(editingTruck.id, updateData);
        if (res.success) {
          message.success('Cập nhật thông tin xe tải thành công');
          setIsModalOpen(false);
          fetchData();
        }
      } else {
        const createData: CreateTruckRequest = {
          ...values
        };
        const res = await truckApi.createTruck(createData);
        if (res.success) {
          message.success('Thêm mới xe tải thành công');
          setIsModalOpen(false);
          fetchData();
        }
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message);
      }
    }
  };

  const handleDeleteTruck = async (id: number) => {
    try {
      const res = await truckApi.deleteTruck(id);
      if (res.success) {
        message.success('Đã xóa xe tải thành công');
        fetchData();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể xóa xe tải');
    }
  };

  const handleOpenAssignModal = (truck: Truck) => {
    setAssigningTruck(truck);
    assignForm.setFieldsValue({
      driverId: truck.currentDriverId || undefined
    });
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignDriver = async () => {
    try {
      if (!assigningTruck) return;
      const values = await assignForm.validateFields();
      const res = await truckApi.assignDriver(assigningTruck.id, values.driverId || 0);
      if (res.success) {
        message.success('Gán tài xế phụ trách xe thành công');
        setIsAssignModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể gán tài xế');
    }
  };

  const handleQuickStatusChange = async (truck: Truck, newStatus: string) => {
    try {
      const res = await truckApi.updateStatus(truck.id, newStatus);
      if (res.success) {
        message.success(`Đã chuyển trạng thái xe sang: ${newStatus === 'MAINTENANCE' ? 'Bảo dưỡng' : 'Ở kho'}`);
        fetchData();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể đổi trạng thái xe');
    }
  };

  // Stats
  const totalTrucks = trucks.length;
  const inWarehouseTrucks = trucks.filter(t => t.status === 'AT_WAREHOUSE').length;
  const inTransitTrucks = trucks.filter(t => t.status === 'IN_TRANSIT').length;
  const maintenanceTrucks = trucks.filter(t => t.status === 'MAINTENANCE').length;

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'AT_WAREHOUSE':
        return <Tag color="green" icon={<CheckCircleOutlined />}>Đang ở kho</Tag>;
      case 'IN_TRANSIT':
        return <Tag color="blue" icon={<SyncOutlined spin />}>Đang đi trung chuyển</Tag>;
      case 'MAINTENANCE':
        return <Tag color="orange" icon={<ToolOutlined />}>Đang bảo dưỡng</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Mã xe',
      dataIndex: 'id',
      key: 'id',
      width: 70,
      render: (id: number) => <span className="font-semibold text-gray-500">#{id}</span>
    },
    {
      title: 'Biển số xe',
      dataIndex: 'licensePlate',
      key: 'licensePlate',
      render: (plate: string) => (
        <span className="font-bold text-base px-2 py-1 bg-yellow-100 border border-yellow-300 rounded text-yellow-900 tracking-wider">
          {plate}
        </span>
      )
    },
    {
      title: 'Loại xe & Tải trọng',
      key: 'type',
      render: (_: any, r: Truck) => (
        <div>
          <div className="font-medium text-gray-900">{r.truckType}</div>
          <div className="text-xs text-gray-500">Tải trọng: <span className="font-semibold text-blue-600">{r.payloadKg?.toLocaleString('vi-VN')} kg</span></div>
        </div>
      )
    },
    {
      title: 'Thuộc Kho Trung Chuyển (HUB)',
      key: 'warehouse',
      render: (_: any, r: Truck) => (
        <div>
          <div className="font-medium text-gray-800">{r.currentWarehouseName || 'Chưa gán kho'}</div>
          {r.currentWarehouseCode && (
            <Tag color="cyan" className="text-xs">{r.currentWarehouseCode}</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Tài xế phụ trách',
      key: 'driver',
      render: (_: any, r: Truck) => (
        <div>
          {r.currentDriverName ? (
            <div>
              <div className="font-medium text-gray-900">{r.currentDriverName}</div>
              <div className="text-xs text-gray-500">SĐT: {r.currentDriverPhone || 'N/A'}</div>
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic">Chưa gán tài xế</span>
          )}
        </div>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => renderStatusTag(st)
    },
    {
      title: 'Thời gian tạo xe',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (dt: string) => (
        <span className="text-xs text-gray-500">
          {dt ? new Date(dt).toLocaleString('vi-VN') : '—'}
        </span>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, r: Truck) => (
        <Space size="small">
          {isManager && (
            <>
              <Tooltip title="Gán tài xế phụ trách">
                <Button
                  size="small"
                  icon={<UserSwitchOutlined />}
                  onClick={() => handleOpenAssignModal(r)}
                />
              </Tooltip>
              <Tooltip title="Chỉnh sửa thông tin">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenEditModal(r)}
                />
              </Tooltip>
              {r.status === 'AT_WAREHOUSE' && (
                <Tooltip title="Chuyển vào bảo dưỡng">
                  <Button
                    size="small"
                    icon={<ToolOutlined />}
                    danger
                    onClick={() => handleQuickStatusChange(r, 'MAINTENANCE')}
                  />
                </Tooltip>
              )}
              {r.status === 'MAINTENANCE' && (
                <Tooltip title="Hoàn tất bảo dưỡng về kho">
                  <Button
                    size="small"
                    icon={<CheckCircleOutlined />}
                    type="primary"
                    onClick={() => handleQuickStatusChange(r, 'AT_WAREHOUSE')}
                  />
                </Tooltip>
              )}
            </>
          )}
          {isAdmin && (
            <Popconfirm
              title="Xóa xe tải"
              description={`Bạn có chắc chắn muốn xóa xe ${r.licensePlate}?`}
              onConfirm={() => handleDeleteTruck(r.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CarOutlined className="text-blue-600" /> Quản lý Đội Xe Ô Tô Tải (Fleet Management)
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Quản lý phương tiện vận tải đường trục, gom hàng bưu cục và trung chuyển liên Hub
          </p>
        </div>
        {isManager && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={handleOpenCreateModal}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Thêm Xe Tải Mới
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Tổng số xe tải"
              value={totalTrucks}
              suffix="xe"
              prefix={<CarOutlined className="text-blue-500 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Đang ở kho"
              value={inWarehouseTrucks}
              valueStyle={{ color: '#52c41a' }}
              suffix="xe"
              prefix={<CheckCircleOutlined className="mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Đang đi trung chuyển"
              value={inTransitTrucks}
              valueStyle={{ color: '#1890ff' }}
              suffix="xe"
              prefix={<SyncOutlined spin className="mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Đang bảo dưỡng"
              value={maintenanceTrucks}
              valueStyle={{ color: '#fa8c16' }}
              suffix="xe"
              prefix={<ToolOutlined className="mr-2" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Table */}
      <Card bordered={false} className="shadow-sm">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            placeholder="Tìm biển số, loại xe, tài xế..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            className="w-64"
            allowClear
          />
          <Select
            placeholder="Chọn Kho / Hub"
            value={selectedWarehouseId}
            onChange={setSelectedWarehouseId}
            allowClear
            className="w-60"
          >
            {warehouses.map(w => (
              <Select.Option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="Trạng thái xe"
            value={selectedStatus}
            onChange={setSelectedStatus}
            allowClear
            className="w-48"
          >
            <Select.Option value="AT_WAREHOUSE">Đang ở kho</Select.Option>
            <Select.Option value="IN_TRANSIT">Đang đi trung chuyển</Select.Option>
            <Select.Option value="MAINTENANCE">Đang bảo dưỡng</Select.Option>
          </Select>
          <Button icon={<SearchOutlined />} onClick={handleSearch} type="primary" ghost>
            Lọc
          </Button>
          <Button icon={<SyncOutlined />} onClick={fetchData}>
            Làm mới
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={trucks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: total => `Tổng số ${total} xe tải` }}
          bordered
        />
      </Card>

      {/* Modal Thêm / Sửa Xe Tải */}
      <Modal
        title={editingTruck ? `Chỉnh sửa thông tin xe tải: ${editingTruck.licensePlate}` : 'Thêm mới xe ô tô tải vào hệ thống'}
        open={isModalOpen}
        onOk={handleSaveTruck}
        onCancel={() => setIsModalOpen(false)}
        okText={editingTruck ? 'Lưu thay đổi' : 'Thêm xe tải'}
        cancelText="Hủy"
        width={650}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="licensePlate"
                label="Biển số xe"
                rules={[
                  { required: true, message: 'Vui lòng nhập biển số xe' },
                  { pattern: /^[0-9]{2}[A-Z]-[0-9]{3,5}(\.[0-9]{2})?$/, message: 'Định dạng biển số vd: 29C-123.45 hoặc 29C-12345' }
                ]}
              >
                <Input placeholder="Vd: 29C-888.88" className="font-semibold uppercase" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="truckType"
                label="Loại xe tải"
                rules={[{ required: true, message: 'Vui lòng nhập/chọn loại xe' }]}
              >
                <Select
                  placeholder="Chọn hoặc nhập loại xe"
                  showSearch
                  allowClear
                  options={[
                    { label: 'Xe tải 1.25 tấn gọn nhẹ', value: 'Xe tải 1.25 tấn gọn nhẹ' },
                    { label: 'Xe tải 2.5 tấn thùng kín', value: 'Xe tải 2.5 tấn thùng kín' },
                    { label: 'Xe tải 3.5 tấn thùng kín', value: 'Xe tải 3.5 tấn thùng kín' },
                    { label: 'Xe tải 5 tấn thùng bạt', value: 'Xe tải 5 tấn thùng bạt' },
                    { label: 'Xe tải 8 tấn đường dài', value: 'Xe tải 8 tấn đường dài' },
                    { label: 'Xe Container 40 feet đường trục', value: 'Xe Container 40 feet đường trục' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="payloadKg"
                label="Tải trọng tối đa (kg)"
                rules={[{ required: true, message: 'Vui lòng nhập tải trọng' }]}
              >
                <InputNumber
                  min={100}
                  max={50000}
                  step={100}
                  className="w-full"
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value: any) => value.replace(/\$\s?|(,*)/g, '')}
                  addonAfter="kg"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currentWarehouseId"
                label="Thuộc Kho Trung Chuyển (HUB) / Bưu cục"
                rules={[{ required: true, message: 'Vui lòng chọn kho / bưu cục' }]}
              >
                <Select placeholder="Chọn Kho / Hub trực thuộc" showSearch optionFilterProp="children">
                  {warehouses.map(w => (
                    <Select.Option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="Trạng thái hoạt động"
                rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
              >
                <Select>
                  <Select.Option value="AT_WAREHOUSE">Đang ở kho</Select.Option>
                  <Select.Option value="IN_TRANSIT">Đang đi trung chuyển</Select.Option>
                  <Select.Option value="MAINTENANCE">Đang bảo dưỡng</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="currentDriverId"
                label="Tài xế phụ trách xe (tùy chọn)"
              >
                <Select placeholder="Chọn tài xế xe tải" allowClear showSearch optionFilterProp="children">
                  {drivers.map(d => (
                    <Select.Option key={d.id} value={d.id}>
                      {d.fullName} ({d.phoneNumber})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Ghi chú kỹ thuật / hành trình">
            <Input.TextArea rows={3} placeholder="Ghi chú về bảo dưỡng, đăng kiểm, niên hạn sử dụng..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Gán Tài Xế Nhanh */}
      <Modal
        title={`Gán tài xế xe tải cho xe ${assigningTruck?.licensePlate}`}
        open={isAssignModalOpen}
        onOk={handleSaveAssignDriver}
        onCancel={() => setIsAssignModalOpen(false)}
        okText="Xác nhận gán"
        cancelText="Hủy"
      >
        <Form form={assignForm} layout="vertical" className="mt-4">
          <Form.Item
            name="driverId"
            label="Chọn tài xế lái xe tải (ROLE_TRUCK_DRIVER)"
            rules={[{ required: true, message: 'Vui lòng chọn tài xế' }]}
          >
            <Select placeholder="Chọn tài xế" showSearch optionFilterProp="children">
              {drivers.map(d => (
                <Select.Option key={d.id} value={d.id}>
                  {d.fullName} (SĐT: {d.phoneNumber})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default TruckManagementPage;
