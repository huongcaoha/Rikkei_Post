import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Alert } from 'antd';
import { User, Lock, Mail, Phone, Truck, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export const RegisterPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [step, setStep] = useState<'REGISTER' | 'VERIFY_OTP'>('REGISTER');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const navigate = useNavigate();
  const { login } = useAuth();
  const [form] = Form.useForm();

  // Bắt đầu đếm ngược thời gian gửi lại mã OTP
  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleRegisterFinish = async (values: any) => {
    setLoading(true);
    try {
      await authApi.register({
        username: values.username,
        password: values.password,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber,
        email: values.email,
        roles: ['ROLE_MERCHANT'],
      });

      setRegisteredEmail(values.email);
      setStep('VERIFY_OTP');
      startCountdown();
      message.success('Đăng ký bước 1 thành công! Vui lòng kiểm tra email để lấy mã OTP 6 chữ số.');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      message.error('Vui lòng nhập đúng và đủ 6 chữ số mã OTP');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await authApi.verifyOtp(registeredEmail, otpCode);
      message.success(`Xác thực tài khoản thành công! Chào mừng ${res.fullName}`);

      login(res.accessToken, {
        id: res.userId,
        username: res.username,
        fullName: res.fullName,
        phoneNumber: res.phoneNumber,
        email: res.email,
        roles: res.roles,
      });

      navigate('/dashboard');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn. Vui lòng thử lại!');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setResending(true);
    try {
      await authApi.resendOtp(registeredEmail);
      message.success('Mã OTP mới đã được gửi lại vào email của bạn!');
      startCountdown();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-gray-50 to-red-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-600 text-white shadow-lg mb-3">
            <Truck size={30} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-wider">RIKKEI_POST</h1>
          <p className="text-gray-500 text-sm mt-1">Đăng ký tài khoản Khách hàng / Chủ Shop</p>
        </div>

        <Card className="shadow-xl rounded-2xl border-0">
          {step === 'REGISTER' ? (
            <>
              <h2 className="text-lg font-bold text-gray-800 mb-4">Thông tin đăng ký tài khoản mới</h2>
              <Form form={form} layout="vertical" onFinish={handleRegisterFinish}>
                <Form.Item
                  name="fullName"
                  label="Họ và tên / Tên Shop"
                  rules={[{ required: true, message: 'Vui lòng nhập họ tên hoặc tên shop' }]}
                >
                  <Input placeholder="Nguyễn Văn A (Shop Thời Trang)" size="large" className="rounded-lg" />
                </Form.Item>

                <Form.Item
                  name="username"
                  label="Tên đăng nhập (Username)"
                  rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
                >
                  <Input prefix={<User size={16} className="text-gray-400 mr-1" />} placeholder="shop_thoitrang2026" size="large" className="rounded-lg" />
                </Form.Item>

                <Form.Item
                  name="phoneNumber"
                  label="Số điện thoại liên hệ"
                  rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
                >
                  <Input prefix={<Phone size={16} className="text-gray-400 mr-1" />} placeholder="0987654321" size="large" className="rounded-lg" />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Email (Nhận mã OTP xác thực tài khoản)"
                  rules={[
                    { required: true, message: 'Vui lòng nhập địa chỉ email chính xác' },
                    { type: 'email', message: 'Email không hợp lệ' },
                  ]}
                >
                  <Input prefix={<Mail size={16} className="text-gray-400 mr-1" />} placeholder="email_cua_ban@gmail.com" size="large" className="rounded-lg" />
                </Form.Item>

                <Form.Item
                  name="password"
                  label="Mật khẩu bảo vệ"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu' },
                    { min: 6, message: 'Mật khẩu phải từ 6 ký tự trở lên' },
                  ]}
                >
                  <Input.Password prefix={<Lock size={16} className="text-gray-400 mr-1" />} placeholder="••••••••" size="large" className="rounded-lg" />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  className="w-full bg-red-600 hover:bg-red-700 h-11 text-base font-semibold rounded-lg shadow-md mt-2"
                >
                  Đăng ký & Nhận mã OTP
                </Button>
              </Form>

              <div className="text-center mt-5 text-xs text-gray-500">
                Đã có tài khoản?{' '}
                <Link to="/login" className="text-red-600 font-semibold hover:underline">
                  Đăng nhập ngay
                </Link>
              </div>
            </>
          ) : (
            /* BƯỚC 2: XÁC THỰC MÃ OTP EMAIL */
            <div className="space-y-4 py-2">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full inline-flex items-center justify-center mb-2">
                  <KeyRound size={24} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">Xác thực mã OTP Email</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Mã xác thực gồm 6 chữ số đã được gửi tới:
                  <br />
                  <b className="text-gray-800 text-sm font-semibold">{registeredEmail}</b>
                </p>
              </div>

              <Alert
                message="Lưu ý thời hạn kích hoạt"
                description="Mã OTP có hiệu lực trong 60 phút. Sau 60 phút nếu tài khoản chưa kích hoạt, hệ thống sẽ tự động dọn dẹp để bảo mật."
                type="warning"
                showIcon
                className="text-xs"
              />

              <div className="py-2">
                <label className="block text-xs font-semibold text-gray-700 mb-2 text-center">
                  Nhập mã OTP 6 chữ số:
                </label>
                <Input
                  size="large"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  className="text-center text-3xl tracking-widest font-mono font-bold h-14 rounded-xl border-2 border-red-200 focus:border-red-600"
                />
              </div>

              <Button
                type="primary"
                size="large"
                loading={otpLoading}
                onClick={handleVerifyOtp}
                className="w-full bg-red-600 hover:bg-red-700 h-11 text-base font-semibold rounded-lg shadow-md"
              >
                Xác thực & Kích hoạt tài khoản
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep('REGISTER')}
                  className="text-gray-500 hover:text-gray-800 flex items-center space-x-1"
                >
                  <ArrowLeft size={14} />
                  <span>Sửa thông tin đăng ký</span>
                </button>

                <button
                  type="button"
                  disabled={countdown > 0 || resending}
                  onClick={handleResendOtp}
                  className={`font-semibold flex items-center space-x-1 ${
                    countdown > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-red-600 hover:underline'
                  }`}
                >
                  <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                  <span>{countdown > 0 ? `Gửi lại sau (${countdown}s)` : 'Gửi lại mã OTP'}</span>
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
