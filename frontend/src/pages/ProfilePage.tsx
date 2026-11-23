import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Tabs, Tag, message, Avatar, Alert, Divider } from 'antd';
import { User, Lock, Phone, Mail, UserCheck, Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { userApi, UpdateProfileRequest, ChangePasswordRequest } from '../api/user';

export const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState<boolean>(false);
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        username: user.username,
      });
    }
  }, [user, profileForm]);

  const handleUpdateProfile = async (values: any) => {
    setSavingProfile(true);
    try {
      const payload: UpdateProfileRequest = {
        fullName: values.fullName.trim(),
        phoneNumber: values.phoneNumber.trim(),
        email: values.email.trim(),
      };
      const updated = await userApi.updateProfile(payload);
      updateUser(updated);
      message.success('Cập nhật thông tin cá nhân thành công!');
    } catch (err: any) {
      const errDetail = err.response?.data?.message || err.message || 'Cập nhật thông tin thất bại!';
      message.error(errDetail);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Mật khẩu mới và xác nhận mật khẩu không trùng khớp!');
      return;
    }
    setChangingPassword(true);
    try {
      const payload: ChangePasswordRequest = {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      };
      await userApi.changePassword(payload);
      message.success('Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới.');
      passwordForm.resetFields();
    } catch (err: any) {
      const errDetail = err.response?.data?.message || err.message || 'Đổi mật khẩu thất bại!';
      message.error(errDetail);
    } finally {
      setChangingPassword(false);
    }
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case 'ROLE_ADMIN':
        return 'Quản trị viên Hệ thống';
      case 'ROLE_BRANCH_MANAGER':
        return 'Quản lý Chi nhánh Tỉnh/TP';
      case 'ROLE_POST_OFFICE_MANAGER':
        return 'Quản lý Bưu cục / Kho';
      case 'ROLE_WAREHOUSE_STAFF':
        return 'Nhân viên Khai thác Kho';
      case 'ROLE_SHIPPER':
        return 'Bưu tá Giao / Lấy hàng';
      case 'ROLE_MERCHANT':
        return 'Chủ Shop / Đối tác';
      default:
        return r.replace('ROLE_', '');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 py-2">
      {/* Thẻ Header Profile */}
      <Card className="rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <Avatar
            size={72}
            className="bg-red-600 text-white font-bold text-2xl flex items-center justify-center shadow-md flex-shrink-0"
          >
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 truncate">
              {user?.fullName || user?.username}
            </h2>
            <p className="text-sm text-gray-500 font-medium">@{user?.username}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-2">
              {user?.roles?.map((r) => (
                <Tag color="red" key={r} className="text-xs font-mono font-medium rounded-full px-2.5 py-0.5">
                  {getRoleLabel(r)}
                </Tag>
              ))}
            </div>
            {(user?.managedProvinceName || user?.postOfficeName) && (
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                {user.managedProvinceName && (
                  <span className="flex items-center gap-1 font-medium">
                    <Building2 size={14} className="text-red-500" />
                    Chi nhánh: <strong>{user.managedProvinceName}</strong>
                  </span>
                )}
                {user.postOfficeName && (
                  <span className="flex items-center gap-1 font-medium">
                    <Building2 size={14} className="text-blue-500" />
                    Bưu cục: <strong>{user.postOfficeName}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs Chỉnh sửa & Đổi mật khẩu */}
      <Card className="rounded-2xl shadow-xs border border-gray-100">
        <Tabs
          defaultActiveKey="profile"
          className="font-medium"
          items={[
            {
              key: 'profile',
              label: (
                <span className="flex items-center gap-1.5 px-1 py-0.5 text-sm sm:text-base">
                  <UserCheck size={16} />
                  Thông tin cá nhân
                </span>
              ),
              children: (
                <div className="pt-2 max-w-xl">
                  <Form
                    form={profileForm}
                    layout="vertical"
                    onFinish={handleUpdateProfile}
                    requiredMark="optional"
                  >
                    <Form.Item label="Tên đăng nhập (Username)" name="username">
                      <Input
                        disabled
                        prefix={<User size={16} className="text-gray-400" />}
                        className="h-11 rounded-xl bg-gray-50 font-medium text-gray-500"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Họ và tên"
                      name="fullName"
                      rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
                    >
                      <Input
                        placeholder="Nhập họ và tên của bạn"
                        className="h-11 rounded-xl"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Số điện thoại"
                      name="phoneNumber"
                      rules={[
                        { required: true, message: 'Vui lòng nhập số điện thoại' },
                        {
                          pattern: /^(0|\+84)[3|5|7|8|9][0-9]{8}$/,
                          message: 'Số điện thoại không đúng định dạng (10 số)!',
                        },
                      ]}
                    >
                      <Input
                        prefix={<Phone size={16} className="text-gray-400" />}
                        placeholder="0987654321"
                        className="h-11 rounded-xl"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Email"
                      name="email"
                      rules={[
                        { required: true, message: 'Vui lòng nhập email' },
                        { type: 'email', message: 'Email không đúng định dạng!' },
                      ]}
                    >
                      <Input
                        prefix={<Mail size={16} className="text-gray-400" />}
                        placeholder="name@example.com"
                        className="h-11 rounded-xl"
                      />
                    </Form.Item>

                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={savingProfile}
                      icon={<CheckCircle2 size={16} />}
                      className="bg-red-600 hover:bg-red-700 h-11 px-6 rounded-xl font-bold shadow-xs mt-2 w-full sm:w-auto"
                    >
                      Lưu thay đổi thông tin
                    </Button>
                  </Form>
                </div>
              ),
            },
            {
              key: 'password',
              label: (
                <span className="flex items-center gap-1.5 px-1 py-0.5 text-sm sm:text-base">
                  <Lock size={16} />
                  Đổi mật khẩu
                </span>
              ),
              children: (
                <div className="pt-2 max-w-xl">
                  <Alert
                    type="info"
                    showIcon
                    message="Bảo mật tài khoản"
                    description="Mật khẩu mới phải có tối thiểu 6 ký tự. Vui lòng không chia sẻ mật khẩu của bạn cho bất kỳ ai."
                    className="mb-5 rounded-xl border-blue-100 bg-blue-50/50"
                  />

                  <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={handleChangePassword}
                  >
                    <Form.Item
                      label="Mật khẩu hiện tại"
                      name="currentPassword"
                      rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
                    >
                      <Input.Password
                        placeholder="Nhập mật khẩu đang sử dụng"
                        className="h-11 rounded-xl"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Mật khẩu mới"
                      name="newPassword"
                      rules={[
                        { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                        { min: 6, message: 'Mật khẩu phải có tối thiểu 6 ký tự' },
                      ]}
                    >
                      <Input.Password
                        placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                        className="h-11 rounded-xl"
                      />
                    </Form.Item>

                    <Form.Item
                      label="Xác nhận mật khẩu mới"
                      name="confirmPassword"
                      dependencies={['newPassword']}
                      rules={[
                        { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password
                        placeholder="Nhập lại mật khẩu mới"
                        className="h-11 rounded-xl"
                      />
                    </Form.Item>

                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={changingPassword}
                      icon={<ShieldCheck size={16} />}
                      className="bg-red-600 hover:bg-red-700 h-11 px-6 rounded-xl font-bold shadow-xs mt-2 w-full sm:w-auto"
                    >
                      Cập nhật mật khẩu mới
                    </Button>
                  </Form>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};
export default ProfilePage;
