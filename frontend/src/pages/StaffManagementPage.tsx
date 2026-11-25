import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Row, Col } from 'antd';
import { Users, UserPlus, Edit2, Shield, MapPin, Building2, CheckCircle, XCircle } from 'lucide-react';
import { staffApi } from '../api/staff';
import { locationApi } from '../api/location';
import { authApi } from '../api/auth';
import { StaffUser, Province, Warehouse, CreateStaffRequest, UpdateStaffRequest } from '../types';
import { useAuth } from '../context/AuthContext';

export const StaffManagementPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const selectedRole = Form.useWatch('role', form);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');
  const isPostOfficeManager = userRoles.includes('ROLE_POST_OFFICE_MANAGER');

  // Đảm bảo thông tin managedProvinceId và nạp sẵn bưu cục cho Branch Manager
  useEffect(() => {
    const ensureUserDataAndWarehouses = async () => {
      let provId = user?.managedProvinceId;
      if (!provId && (isBranchManager || isPostOfficeManager)) {
        try {
          const freshUser = await authApi.getCurrentUser();
          if (freshUser?.managedProvinceId) {
            provId = freshUser.managedProvinceId;
            updateUser(freshUser);
          }
        } catch (e) {
          console.error('Lỗi làm mới thông tin tài khoản:', e);
        }
      }

      if (provId) {
        loadWarehousesForProvince(provId);
      }
    };

    ensureUserDataAndWarehouses();
  }, [isBranchManager, isPostOfficeManager, user?.managedProvinceId]);

  // Khi chọn vai trò Quản lý chi nhánh thì tự động xóa gán bưu cục lẻ
  useEffect(() => {
    if (selectedRole === 'ROLE_BRANCH_MANAGER') {
      form.setFieldsValue({ assignedPostOfficeId: undefined });
    }
  }, [selectedRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staffData, rolesData, provData] = await Promise.all([
        staffApi.getStaffList(selectedRoleFilter),
        staffApi.getAssignableRoles(),
        locationApi.getProvinces(),
      ]);
      setStaffList(staffData);
      setAssignableRoles(rolesData);
      setProvinces(provData);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách nhân viên!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRoleFilter]);

  const loadWarehousesForProvince = async (provId?: number) => {
    if (!provId) {
      setWarehouses([]);
      return;
    }
    setLoadingWarehouses(true);
    try {
      const list = await locationApi.getWarehouses(provId);
      setWarehouses(list);
    } catch (e) {
      console.error('Lỗi nạp bưu cục theo tỉnh:', e);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setEditingStaff(null);
    form.resetFields();
    const defaultRole = assignableRoles.length > 0 ? assignableRoles[0] : 'ROLE_POST_OFFICE_MANAGER';

    let branchOrPoProvId = (isBranchManager || isPostOfficeManager) ? user?.managedProvinceId : undefined;

    // Nếu chưa có managedProvinceId trong local state, tải ngay từ API
    if (!branchOrPoProvId && (isBranchManager || isPostOfficeManager)) {
      try {
        const freshUser = await authApi.getCurrentUser();
        if (freshUser?.managedProvinceId) {
          branchOrPoProvId = freshUser.managedProvinceId;
          updateUser(freshUser);
        }
      } catch (e) {
        console.error('Lỗi lấy thông tin tỉnh:', e);
      }
    }

    form.setFieldsValue({
      role: defaultRole,
      password: 'Password@123',
      managedProvinceId: branchOrPoProvId,
      assignedPostOfficeId: isPostOfficeManager ? user?.assignedPostOfficeId : undefined,
    });

    if (branchOrPoProvId) {
      loadWarehousesForProvince(branchOrPoProvId);
    } else {
      setWarehouses([]);
    }

    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: StaffUser) => {
    setEditingStaff(record);
    const primaryRole = record.roles && record.roles.length > 0 ? record.roles[0] : undefined;
    form.setFieldsValue({
      username: record.username,
      fullName: record.fullName,
      phoneNumber: record.phoneNumber,
      email: record.email,
      role: primaryRole,
      managedProvinceId: record.managedProvinceId,
      assignedPostOfficeId: primaryRole === 'ROLE_BRANCH_MANAGER' ? undefined : record.assignedPostOfficeId,
      isActive: record.isActive,
    });
    if (record.managedProvinceId) {
      loadWarehousesForProvince(record.managedProvinceId);
    } else {
      setWarehouses([]);
    }
    setIsModalOpen(true);
  };

  const handleProvinceChangeInModal = (provId?: number) => {
    form.setFieldsValue({ assignedPostOfficeId: undefined });
    loadWarehousesForProvince(provId);
  };

  const handleSubmit = async (values: any) => {
    try {
      const provId = (isBranchManager || isPostOfficeManager) && user?.managedProvinceId
        ? user.managedProvinceId
        : values.managedProvinceId;

      // Quản lý chi nhánh quản lý toàn bộ các bưu cục thuộc chi nhánh, không gán bưu cục lẻ
      const assignedPoId = values.role === 'ROLE_BRANCH_MANAGER' ? undefined : values.assignedPostOfficeId;

      const selectedWh = warehouses.find((w) => w.id === assignedPoId);
      const prov = provinces.find((p) => p.id === provId);

      if (editingStaff) {
        const updateReq: UpdateStaffRequest = {
          fullName: values.fullName,
          phoneNumber: values.phoneNumber,
          email: values.email,
          password: values.password || undefined,
          newPassword: values.password || undefined,
          role: values.role,
          roles: values.role ? [values.role] : [],
          managedProvinceId: provId,
          managedProvinceName: prov?.name,
          assignedPostOfficeId: assignedPoId,
          postOfficeName: selectedWh?.name,
          isActive: values.isActive,
        };
        await staffApi.updateStaff(editingStaff.id, updateReq);
        message.success('Cập nhật thông tin nhân viên thành công!');
      } else {
        const createReq: CreateStaffRequest = {
          username: values.username,
          password: values.password || 'Password@123',
          fullName: values.fullName,
          phoneNumber: values.phoneNumber,
          email: values.email,
          role: values.role,
          roles: values.role ? [values.role] : [],
          managedProvinceId: provId,
          managedProvinceName: prov?.name,
          assignedPostOfficeId: assignedPoId,
          postOfficeName: selectedWh?.name,
        };
        await staffApi.createStaff(createReq);
        message.success('Tạo mới nhân viên thành công!');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác không thành công!');
    }
  };

  const getRoleBadge = (roleName: string) => {
    switch (roleName) {
      case 'ROLE_ADMIN':
        return <Tag color="purple">Quản trị viên</Tag>;
      case 'ROLE_BRANCH_MANAGER':
        return <Tag color="gold">Quản lý Chi nhánh</Tag>;
      case 'ROLE_POST_OFFICE_MANAGER':
        return <Tag color="cyan">Quản lý Bưu cục</Tag>;
      case 'ROLE_SHIPPER':
        return <Tag color="blue">Bưu tá (Shipper)</Tag>;
      case 'ROLE_WAREHOUSE_STAFF':
        return <Tag color="green">Nhân viên kho</Tag>;
      case 'ROLE_TRUCK_DRIVER':
        return <Tag color="orange">Tài xế xe tải</Tag>;
      case 'ROLE_ACCOUNTANT':
        return <Tag color="magenta">Kế toán viên</Tag>;
      default:
        return <Tag>{roleName.replace('ROLE_', '')}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Tài khoản & Họ tên',
      key: 'user',
      render: (_: any, record: StaffUser) => (
        <div>
          <div className="font-semibold text-gray-800">{record.fullName}</div>
          <div className="text-xs text-gray-500 font-mono">@{record.username}</div>
        </div>
      ),
    },
    {
      title: 'Vai trò (Role)',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => (
        <Space direction="vertical" size={2}>
          {roles?.map((r) => (
            <span key={r}>{getRoleBadge(r)}</span>
          ))}
        </Space>
      ),
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      render: (_: any, record: StaffUser) => (
        <div className="text-sm">
          <div>{record.phoneNumber || '-'}</div>
          <div className="text-xs text-gray-400">{record.email || '-'}</div>
        </div>
      ),
    },
    {
      title: 'Phạm vi quản lý / Phụ trách',
      key: 'scope',
      render: (_: any, record: StaffUser) => (
        <div className="text-xs">
          {record.managedProvinceName && (
            <div className="flex items-center text-gray-700">
              <MapPin size={13} className="mr-1 text-red-500" />
              Tỉnh/TP: <span className="font-semibold ml-1">{record.managedProvinceName}</span>
            </div>
          )}
          {record.postOfficeName && (
            <div className="flex items-center text-gray-700 mt-1">
              <Building2 size={13} className="mr-1 text-blue-500" />
              Bưu cục: <span className="font-semibold ml-1">{record.postOfficeName}</span>
            </div>
          )}
          {!record.managedProvinceName && !record.postOfficeName && (
            <span className="text-gray-400 italic">Toàn quốc / Chưa gắn</span>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'} className="flex items-center w-fit">
          {isActive ? <CheckCircle size={12} className="mr-1" /> : <XCircle size={12} className="mr-1" />}
          {isActive ? 'Đang hoạt động' : 'Tạm khóa'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: StaffUser) => {
        if (!isAdmin) {
          return (
            <span className="text-gray-400 text-xs italic">
              Chỉ xem
            </span>
          );
        }
        return (
          <Button
            type="link"
            icon={<Edit2 size={15} />}
            onClick={() => handleOpenEditModal(record)}
            className="text-blue-600 hover:text-blue-800"
          >
            Cập nhật
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <Users className="mr-2 text-red-600" size={28} />
            Quản Lý Nhân Sự & Phân Quyền Vận Hành
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Phân cấp ủy quyền: Admin quản lý toàn bộ nhân viên; Quản lý chi nhánh quản lý bưu cục và shipper trên địa bàn.
          </p>
        </div>
        <Button
          type="primary"
          icon={<UserPlus size={16} />}
          onClick={handleOpenCreateModal}
          className="bg-red-600 hover:bg-red-700 font-semibold h-10 px-5 shadow-sm"
        >
          Thêm nhân viên mới
        </Button>
      </div>

      <Card className="shadow-xs border-gray-200">
        <div className="flex items-center space-x-4 mb-4">
          <div className="text-sm font-medium text-gray-700">Lọc theo vai trò:</div>
          <Select
            allowClear
            placeholder="Tất cả vai trò"
            className="w-64"
            value={selectedRoleFilter}
            onChange={(val) => setSelectedRoleFilter(val)}
            options={[
              { label: 'Quản lý Chi nhánh (BRANCH_MANAGER)', value: 'ROLE_BRANCH_MANAGER' },
              { label: 'Quản lý Bưu cục (POST_OFFICE_MANAGER)', value: 'ROLE_POST_OFFICE_MANAGER' },
              { label: 'Bưu tá giao nhận (SHIPPER)', value: 'ROLE_SHIPPER' },
              { label: 'Nhân viên kho (WAREHOUSE_STAFF)', value: 'ROLE_WAREHOUSE_STAFF' },
              { label: 'Tài xế xe tải (TRUCK_DRIVER)', value: 'ROLE_TRUCK_DRIVER' },
              { label: 'Kế toán viên (ACCOUNTANT)', value: 'ROLE_ACCOUNTANT' },
            ]}
          />
        </div>

        <Table
          dataSource={staffList}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Modal Thêm / Cập nhật nhân viên */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800 border-b pb-3">
            <Shield className="text-red-600" size={20} />
            <span>{editingStaff ? `Cập nhật nhân viên: ${editingStaff.fullName}` : 'Thêm nhân viên mới'}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
        width={650}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="pt-3">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="Tên đăng nhập"
                rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
              >
                <Input disabled={!!editingStaff} placeholder="e.g. shipper_hn01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label={editingStaff ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu khởi tạo'}
                rules={[{ required: !editingStaff, message: 'Vui lòng nhập mật khẩu' }]}
              >
                <Input.Password placeholder="Tối thiểu 6 ký tự" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fullName"
                label="Họ và tên"
                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
              >
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phoneNumber"
                label="Số điện thoại"
                rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
              >
                <Input placeholder="0987654321" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input placeholder="staff@rikkeipost.vn" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="role"
                label="Phân quyền vai trò"
                rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
              >
                <Select placeholder="Chọn vai trò">
                  {assignableRoles.map((r) => (
                    <Select.Option key={r} value={r}>
                      {r === 'ROLE_ADMIN' && 'Quản trị viên hệ thống (Admin)'}
                      {r === 'ROLE_BRANCH_MANAGER' && 'Quản lý Chi nhánh Tỉnh/TP'}
                      {r === 'ROLE_POST_OFFICE_MANAGER' && 'Quản lý Bưu cục kho vận'}
                      {r === 'ROLE_SHIPPER' && 'Bưu tá (Shipper)'}
                      {r === 'ROLE_WAREHOUSE_STAFF' && 'Nhân viên khai thác kho'}
                      {r === 'ROLE_TRUCK_DRIVER' && 'Tài xế xe tải trung chuyển (TRUCK_DRIVER)'}
                      {r === 'ROLE_ACCOUNTANT' && 'Kế toán viên / Kế toán trưởng (Accountant)'}
                      {r === 'ROLE_MERCHANT' && 'Khách hàng / Shop'}
                      {r !== 'ROLE_ADMIN' &&
                        r !== 'ROLE_BRANCH_MANAGER' &&
                        r !== 'ROLE_POST_OFFICE_MANAGER' &&
                        r !== 'ROLE_SHIPPER' &&
                        r !== 'ROLE_WAREHOUSE_STAFF' &&
                        r !== 'ROLE_TRUCK_DRIVER' &&
                        r !== 'ROLE_MERCHANT' &&
                        r.replace('ROLE_', '')}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="managedProvinceId"
                label={
                  <span>
                    Chi nhánh Tỉnh/TP quản lý
                    {(isBranchManager || isPostOfficeManager) && (
                      <span className="text-xs text-red-500 font-normal ml-1">
                        (Cố định theo tài khoản của bạn)
                      </span>
                    )}
                  </span>
                }
                rules={[
                  {
                    required:
                      selectedRole === 'ROLE_BRANCH_MANAGER' ||
                      selectedRole === 'ROLE_POST_OFFICE_MANAGER',
                    message: 'Vui lòng chọn Tỉnh/Thành phố quản lý',
                  },
                ]}
              >
                <Select
                  disabled={isBranchManager || isPostOfficeManager}
                  allowClear={isAdmin}
                  showSearch
                  placeholder="Chọn tỉnh thành phụ trách"
                  onChange={handleProvinceChangeInModal}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={provinces.map((p) => ({ label: p.name, value: p.id }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="assignedPostOfficeId"
                label={
                  <span>
                    Bưu cục / Kho trực thuộc
                    {isPostOfficeManager && (
                      <span className="text-xs text-red-500 font-normal ml-1">
                        (Cố định theo bưu cục của bạn)
                      </span>
                    )}
                    {selectedRole === 'ROLE_BRANCH_MANAGER' && (
                      <span className="text-xs text-blue-600 font-normal ml-1">
                        (Quản lý toàn bộ bưu cục)
                      </span>
                    )}
                  </span>
                }
                rules={[
                  {
                    required:
                      selectedRole === 'ROLE_POST_OFFICE_MANAGER' ||
                      selectedRole === 'ROLE_SHIPPER' ||
                      selectedRole === 'ROLE_WAREHOUSE_STAFF' ||
                      selectedRole === 'ROLE_TRUCK_DRIVER',
                    message: 'Vui lòng chọn bưu cục / kho trực thuộc',
                  },
                ]}
              >
                <Select
                  disabled={isPostOfficeManager || selectedRole === 'ROLE_BRANCH_MANAGER'}
                  allowClear={selectedRole !== 'ROLE_POST_OFFICE_MANAGER'}
                  showSearch
                  loading={loadingWarehouses}
                  placeholder={
                    selectedRole === 'ROLE_BRANCH_MANAGER'
                      ? 'Quản lý toàn bộ bưu cục trong chi nhánh'
                      : warehouses.length > 0
                        ? 'Chọn bưu cục / kho thuộc chi nhánh'
                        : 'Chọn tỉnh thành trước (hoặc chưa có kho)'
                  }
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={warehouses.map((wh) => ({
                    label: `${wh.name} (${wh.code})`,
                    value: wh.id,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {editingStaff && (
            <Form.Item name="isActive" label="Trạng thái tài khoản">
              <Select
                options={[
                  { label: 'Đang hoạt động', value: true },
                  { label: 'Khóa tài khoản', value: false },
                ]}
              />
            </Form.Item>
          )}

          <div className="flex justify-end space-x-3 mt-4 pt-3 border-t">
            <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-red-600 hover:bg-red-700">
              {editingStaff ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
