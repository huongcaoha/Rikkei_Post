import React, { useState, useEffect, useRef } from 'react';
import { Table, Card, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Row, Col, Alert } from 'antd';
import { Users, UserPlus, Edit2, Shield, MapPin, Building2, CheckCircle, XCircle, Camera, Upload, Smartphone, AlertTriangle, ShieldCheck } from 'lucide-react';
import { staffApi } from '../api/staff';
import { locationApi } from '../api/location';
import { authApi } from '../api/auth';
import { attendanceApi } from '../api/attendance';
import { roleApi, RoleItem } from '../api/role';
import { StaffUser, Province, Warehouse, CreateStaffRequest, UpdateStaffRequest } from '../types';
import { useAuth } from '../context/AuthContext';

export const StaffManagementPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [assignableRoles, setAssignableRoles] = useState<string[]>([]);
  const [allRoles, setAllRoles] = useState<RoleItem[]>([]);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [addingRole, setAddingRole] = useState<boolean>(false);
  const [roleForm] = Form.useForm();
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();
  const selectedRole = Form.useWatch('role', form);

  // State quản lý FaceID cho nhân viên
  const [faceModalOpen, setFaceModalOpen] = useState<boolean>(false);
  const [selectedStaffForFace, setSelectedStaffForFace] = useState<StaffUser | null>(null);
  const [capturedFacePhoto, setCapturedFacePhoto] = useState<string | null>(null);
  const [faceModalLoading, setFaceModalLoading] = useState<boolean>(false);
  const [faceCameraActive, setFaceCameraActive] = useState<boolean>(false);
  const faceVideoRef = useRef<HTMLVideoElement | null>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceFileInputRef = useRef<HTMLInputElement | null>(null);
  const faceUploadInputRef = useRef<HTMLInputElement | null>(null);

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
      const [staffData, rolesData, provData, allRolesRes] = await Promise.all([
        staffApi.getStaffList(selectedRoleFilter),
        staffApi.getAssignableRoles(),
        locationApi.getProvinces(),
        roleApi.getAllRoles(),
      ]);
      setStaffList(staffData);
      setAssignableRoles(rolesData);
      setProvinces(provData);
      if (allRolesRes?.data) {
        setAllRoles(allRolesRes.data);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách nhân viên!');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (values: { roleName: string; description: string }) => {
    setAddingRole(true);
    try {
      await roleApi.createRole(values);
      message.success('Thêm vai trò mới thành công! Bạn có thể phân quyền vai trò này ngay.');
      roleForm.resetFields();
      const [rolesRes, assignable] = await Promise.all([
        roleApi.getAllRoles(),
        staffApi.getAssignableRoles()
      ]);
      if (rolesRes?.data) setAllRoles(rolesRes.data);
      setAssignableRoles(assignable);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo vai trò mới');
    } finally {
      setAddingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    try {
      await roleApi.deleteRole(roleId);
      message.success('Đã xóa vai trò thành công!');
      const [rolesRes, assignable] = await Promise.all([
        roleApi.getAllRoles(),
        staffApi.getAssignableRoles()
      ]);
      if (rolesRes?.data) setAllRoles(rolesRes.data);
      setAssignableRoles(assignable);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể xóa vai trò');
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

  const handleOpenFaceModal = (staff: StaffUser) => {
    setSelectedStaffForFace(staff);
    setCapturedFacePhoto(null);
    setFaceModalOpen(true);
    setTimeout(() => {
      startFaceCamera();
    }, 400);
  };

  const startFaceCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setFaceCameraActive(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      if (faceVideoRef.current) {
        faceVideoRef.current.srcObject = stream;
        setFaceCameraActive(true);
      }
    } catch (e) {
      console.warn('Không thể mở camera:', e);
      setFaceCameraActive(false);
    }
  };

  const stopFaceCamera = () => {
    if (faceVideoRef.current && faceVideoRef.current.srcObject) {
      const stream = faceVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      faceVideoRef.current.srcObject = null;
    }
    setFaceCameraActive(false);
  };

  const captureFacePhoto = () => {
    if (faceVideoRef.current && faceCanvasRef.current) {
      const video = faceVideoRef.current;
      const canvas = faceCanvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedFacePhoto(dataUri);
        message.success('Đã chụp ảnh khuôn mặt thành công!');
      }
    }
  };

  const handleFaceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedFacePhoto(ev.target?.result as string);
      message.success('Đã nạp ảnh khuôn mặt thành công!');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveFaceProfile = async () => {
    if (!selectedStaffForFace || !capturedFacePhoto) {
      message.warning('Vui lòng chụp hoặc tải ảnh khuôn mặt trước khi lưu!');
      return;
    }
    setFaceModalLoading(true);
    try {
      await attendanceApi.registerFaceByManager(selectedStaffForFace.id, {
        facePhotoBase64: capturedFacePhoto,
      });
      message.success(`🎉 Đã cập nhật hồ sơ FaceID thành công cho nhân viên ${selectedStaffForFace.fullName}!`);
      setFaceModalOpen(false);
      stopFaceCamera();
      loadData();
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || 'Lỗi khi cập nhật FaceID!');
    } finally {
      setFaceModalLoading(false);
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
      case 'ROLE_INVENTORY_MANAGER':
        return <Tag color="geekblue">Quản lý kho vật tư</Tag>;
      case 'ROLE_SHIPPER':
        return <Tag color="blue">Bưu tá (Shipper)</Tag>;
      case 'ROLE_WAREHOUSE_STAFF':
        return <Tag color="green">Nhân viên kho</Tag>;
      case 'ROLE_TRUCK_DRIVER':
        return <Tag color="orange">Tài xế xe tải</Tag>;
      case 'ROLE_ACCOUNTANT':
        return <Tag color="magenta">Kế toán viên</Tag>;
      default: {
        const found = allRoles.find(r => r.roleName === roleName);
        return <Tag color="default">{found?.description || roleName.replace('ROLE_', '')}</Tag>;
      }
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
      title: 'Hồ sơ FaceID',
      key: 'faceId',
      render: (_: any, record: StaffUser) => {
        const canManage =
          isAdmin ||
          (isBranchManager && user?.managedProvinceId === record.managedProvinceId) ||
          (isPostOfficeManager && user?.assignedPostOfficeId === record.assignedPostOfficeId);

        return (
          <div className="space-y-1">
            {record.isFaceEnrolled ? (
              <Tag color="green" className="flex items-center gap-1 w-fit">
                <CheckCircle size={12} /> Đã có FaceID
              </Tag>
            ) : (
              <Tag color="orange" className="flex items-center gap-1 w-fit">
                <AlertTriangle size={12} /> Chưa đăng ký
              </Tag>
            )}
            {canManage && (
              <Button
                size="small"
                icon={<Camera size={12} />}
                onClick={() => handleOpenFaceModal(record)}
                className="text-xs flex items-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                {record.isFaceEnrolled ? 'Cập nhật ảnh' : 'Đăng ký ảnh'}
              </Button>
            )}
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: StaffUser) => {
        const canEdit =
          isAdmin ||
          (isBranchManager && user?.managedProvinceId === record.managedProvinceId) ||
          (isPostOfficeManager && user?.assignedPostOfficeId === record.assignedPostOfficeId);

        if (!canEdit) {
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
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              icon={<Shield size={16} />}
              onClick={() => setIsRoleModalOpen(true)}
              className="border-purple-600 text-purple-700 hover:bg-purple-50 font-semibold h-10 px-4"
            >
              Quản lý Vai trò (Roles)
            </Button>
          )}
          <Button
            type="primary"
            icon={<UserPlus size={16} />}
            onClick={handleOpenCreateModal}
            className="bg-red-600 hover:bg-red-700 font-semibold h-10 px-5 shadow-sm"
          >
            Thêm nhân viên mới
          </Button>
        </div>
      </div>

      <Card className="shadow-xs border-gray-200">
        <div className="flex items-center space-x-4 mb-4">
          <div className="text-sm font-medium text-gray-700">Lọc theo vai trò:</div>
          <Select
            allowClear
            placeholder="Tất cả vai trò"
            className="w-72"
            value={selectedRoleFilter}
            onChange={(val) => setSelectedRoleFilter(val)}
            options={
              allRoles.length > 0
                ? allRoles.map((r) => ({
                    label: `${r.description || r.roleName} (${r.roleName})`,
                    value: r.roleName,
                  }))
                : [
                    { label: 'Quản trị viên (ADMIN)', value: 'ROLE_ADMIN' },
                    { label: 'Quản lý kho vật tư (INVENTORY_MANAGER)', value: 'ROLE_INVENTORY_MANAGER' },
                    { label: 'Quản lý Chi nhánh (BRANCH_MANAGER)', value: 'ROLE_BRANCH_MANAGER' },
                    { label: 'Quản lý Bưu cục (POST_OFFICE_MANAGER)', value: 'ROLE_POST_OFFICE_MANAGER' },
                    { label: 'Bưu tá giao nhận (SHIPPER)', value: 'ROLE_SHIPPER' },
                    { label: 'Nhân viên kho (WAREHOUSE_STAFF)', value: 'ROLE_WAREHOUSE_STAFF' },
                    { label: 'Tài xế xe tải (TRUCK_DRIVER)', value: 'ROLE_TRUCK_DRIVER' },
                    { label: 'Kế toán viên (ACCOUNTANT)', value: 'ROLE_ACCOUNTANT' },
                  ]
            }
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
                  {assignableRoles.map((r) => {
                    const matched = allRoles.find((role) => role.roleName === r);
                    let label = matched?.description;
                    if (!label) {
                      if (r === 'ROLE_ADMIN') label = 'Quản trị viên hệ thống (Admin)';
                      else if (r === 'ROLE_INVENTORY_MANAGER') label = 'Quản lý kho vật tư & trang thiết bị doanh nghiệp';
                      else if (r === 'ROLE_BRANCH_MANAGER') label = 'Quản lý Chi nhánh Tỉnh/TP';
                      else if (r === 'ROLE_POST_OFFICE_MANAGER') label = 'Quản lý Bưu cục kho vận';
                      else if (r === 'ROLE_SHIPPER') label = 'Bưu tá (Shipper)';
                      else if (r === 'ROLE_WAREHOUSE_STAFF') label = 'Nhân viên khai thác kho';
                      else if (r === 'ROLE_TRUCK_DRIVER') label = 'Tài xế xe tải trung chuyển (TRUCK_DRIVER)';
                      else if (r === 'ROLE_ACCOUNTANT') label = 'Kế toán viên / Kế toán trưởng (Accountant)';
                      else if (r === 'ROLE_MERCHANT') label = 'Khách hàng / Shop';
                      else label = r.replace('ROLE_', '');
                    }
                    return (
                      <Select.Option key={r} value={r}>
                        {label} <span className="text-gray-400 font-mono text-xs">({r})</span>
                      </Select.Option>
                    );
                  })}
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

      {/* Modal Quản Lý & Cập Nhật FaceID cho Nhân viên (Dành cho Quản lý / Admin) */}
      <Modal
        open={faceModalOpen}
        onCancel={() => {
          stopFaceCamera();
          setFaceModalOpen(false);
        }}
        footer={null}
        width={720}
        title={
          <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
            <Camera size={22} />
            Đăng Ký & Cập Nhật Hồ Sơ FaceID Nhân Viên
          </div>
        }
        destroyOnClose
      >
        {selectedStaffForFace && (
          <div className="space-y-4 py-2">
            <Alert
              type="info"
              showIcon
              icon={<ShieldCheck className="text-blue-600" />}
              message={`Hồ sơ FaceID của nhân viên: ${selectedStaffForFace.fullName} (@${selectedStaffForFace.username})`}
              description={`Bưu cục công tác: ${selectedStaffForFace.postOfficeName || 'Toàn quốc'}. Hình ảnh này sẽ được lưu làm khuôn mặt mẫu để đối soát bắt buộc mỗi khi nhân viên thực hiện Check-in / Check-out.`}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cột 1: Camera Chụp Trực Tiếp */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700">1. Chụp ảnh trực tiếp khuôn mặt:</div>
                <div className="relative rounded-2xl overflow-hidden bg-black flex items-center justify-center aspect-4/3 border-2 border-dashed border-gray-300">
                  <video
                    ref={faceVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-52 border-2 border-red-500 rounded-full border-dashed opacity-75"></div>
                  </div>
                  {faceCameraActive && (
                    <Button
                      type="primary"
                      icon={<Camera size={14} />}
                      onClick={captureFacePhoto}
                      className="absolute bottom-3 bg-red-600 hover:bg-red-700 font-semibold rounded-full px-4 shadow-lg z-10"
                    >
                      Chụp ảnh
                    </Button>
                  )}
                  {!faceCameraActive && (
                    <div className="absolute inset-0 bg-gray-900/90 text-white flex flex-col items-center justify-center p-3 text-center z-20">
                      <Camera size={32} className="text-gray-400 mb-2" />
                      <div className="text-xs font-semibold mb-2">Chưa mở Web Camera</div>
                      <div className="flex gap-2">
                        <Button
                          type="primary"
                          size="small"
                          onClick={startFaceCamera}
                          className="bg-blue-600"
                        >
                          Mở Web Cam
                        </Button>
                        <Button
                          size="small"
                          className="bg-emerald-600 text-white border-none"
                          onClick={() => faceFileInputRef.current?.click()}
                        >
                          📱 Camera máy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    size="small"
                    icon={<Smartphone size={13} />}
                    onClick={() => faceFileInputRef.current?.click()}
                    className="text-xs font-medium text-emerald-700 border-emerald-300"
                  >
                    📱 Chụp camera điện thoại
                  </Button>
                  <Button
                    size="small"
                    icon={<Upload size={13} />}
                    onClick={() => faceUploadInputRef.current?.click()}
                    className="text-xs font-medium text-gray-700"
                  >
                    Tải ảnh thẻ chân dung
                  </Button>
                </div>

                {/* Ẩn inputs */}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  ref={faceFileInputRef}
                  onChange={handleFaceFileChange}
                  className="hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  ref={faceUploadInputRef}
                  onChange={handleFaceFileChange}
                  className="hidden"
                />
                <canvas ref={faceCanvasRef} className="hidden" />
              </div>

              {/* Cột 2: Ảnh Xem Trước & Ảnh Hiện Tại */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700">2. Xem trước ảnh đăng ký:</div>
                <div className="rounded-2xl border border-gray-200 p-3 flex flex-col items-center justify-center bg-gray-50 aspect-4/3">
                  {capturedFacePhoto ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <img
                        src={capturedFacePhoto}
                        alt="Face Preview"
                        className="max-h-44 rounded-xl shadow-md object-contain border"
                      />
                      <span className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
                        <CheckCircle size={14} /> Ảnh sẵn sàng cập nhật
                      </span>
                    </div>
                  ) : selectedStaffForFace.facePhotoUrl ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <img
                        src={selectedStaffForFace.facePhotoUrl}
                        alt="Current Face"
                        className="max-h-44 rounded-xl shadow-md object-contain border"
                      />
                      <span className="text-xs text-blue-600 font-semibold mt-2">
                        Ảnh FaceID hiện tại trên hệ thống
                      </span>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <Camera size={40} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Nhân viên này chưa có ảnh mẫu FaceID.</p>
                      <p className="text-xs text-gray-500">Hãy chụp hoặc tải ảnh chân dung chính diện rõ nét.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <Button
                onClick={() => {
                  stopFaceCamera();
                  setFaceModalOpen(false);
                }}
              >
                Đóng
              </Button>
              <Button
                type="primary"
                onClick={handleSaveFaceProfile}
                loading={faceModalLoading}
                disabled={!capturedFacePhoto}
                className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
              >
                Lưu hồ sơ FaceID cho nhân viên
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Quản lý Vai trò (Roles) cho Admin */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800 border-b pb-3">
            <Shield className="text-purple-600" size={20} />
            <span>Quản Lý Danh Mục Vai Trò (Roles) Hệ Thống</span>
          </div>
        }
        open={isRoleModalOpen}
        onCancel={() => setIsRoleModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsRoleModalOpen(false)}>
            Đóng
          </Button>
        ]}
        width={700}
        destroyOnClose
      >
        <div className="space-y-4 pt-2">
          <Alert
            message="Quản lý vai trò động"
            description="Admin có thể thêm mới vai trò tùy biến tại đây. Các vai trò mới thêm sẽ có hiệu lực ngay lập tức trong form phân quyền nhân viên mà không cần sửa code."
            type="info"
            showIcon
          />

          <Card title="Thêm vai trò mới" size="small" className="bg-gray-50/70 border-purple-200">
            <Form form={roleForm} layout="vertical" onFinish={handleCreateRole}>
              <Row gutter={12}>
                <Col span={10}>
                  <Form.Item
                    name="roleName"
                    label="Mã vai trò (Bắt đầu bằng ROLE_)"
                    rules={[{ required: true, message: 'Nhập mã vai trò (vd: ROLE_SECURITY)' }]}
                  >
                    <Input placeholder="e.g. ROLE_SECURITY" className="font-mono uppercase font-bold" />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item
                    name="description"
                    label="Tên / Mô tả chi tiết vai trò"
                    rules={[{ required: true, message: 'Nhập mô tả vai trò' }]}
                  >
                    <Input placeholder="e.g. Nhân viên an ninh / Bảo vệ kho" />
                  </Form.Item>
                </Col>
              </Row>
              <div className="flex justify-end">
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={addingRole}
                  className="bg-purple-600 hover:bg-purple-700 font-bold"
                >
                  + Thêm vai trò mới
                </Button>
              </div>
            </Form>
          </Card>

          <div>
            <div className="font-bold text-gray-800 text-sm mb-2">Danh sách tất cả vai trò hiện có ({allRoles.length}):</div>
            <Table
              dataSource={allRoles}
              rowKey="id"
              pagination={{ pageSize: 6 }}
              size="small"
              columns={[
                {
                  title: 'Mã vai trò',
                  dataIndex: 'roleName',
                  key: 'roleName',
                  render: (code: string) => <Tag color="purple" className="font-mono font-bold">{code}</Tag>
                },
                {
                  title: 'Mô tả vai trò',
                  dataIndex: 'description',
                  key: 'description',
                  render: (desc: string) => <span className="font-medium text-gray-800">{desc}</span>
                },
                {
                  title: 'Thao tác',
                  key: 'action',
                  width: 90,
                  render: (_: any, r: RoleItem) => {
                    const isCore = ['ROLE_ADMIN', 'ROLE_SHIPPER', 'ROLE_MERCHANT'].includes(r.roleName);
                    if (isCore) return <span className="text-xs text-gray-400 italic">Mặc định</span>;
                    return (
                      <Popconfirm
                        title="Bạn có chắc chắn muốn xóa vai trò này không?"
                        onConfirm={() => handleDeleteRole(r.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                      >
                        <Button danger type="link" size="small">Xóa</Button>
                      </Popconfirm>
                    );
                  }
                }
              ]}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
