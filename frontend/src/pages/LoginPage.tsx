import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Alert, Divider, Modal } from 'antd';
import { User, Lock, Truck, Mail, KeyRound } from 'lucide-react';
import { GoogleOutlined, FacebookFilled, GithubOutlined } from '@ant-design/icons';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form] = Form.useForm();

  // Bắt callback chuyển hướng từ OAuth2 bên thứ 3 (Google, Facebook, GitHub)
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const searchParams = new URLSearchParams(location.search);
      const code = searchParams.get('code');

      // 1. GitHub Callback (Trả về qua query param: ?code=...)
      if (code) {
        window.history.replaceState({}, document.title, window.location.pathname);
        await processOAuthLogin(code, 'github');
        return;
      }

      // 2. Facebook / Google Callback (Trả về qua hash: #access_token=... hoặc query: ?access_token=...)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token=')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const token = hashParams.get('access_token');
        const state = hashParams.get('state'); // 'facebook' hoặc 'google'
        window.history.replaceState({}, document.title, window.location.pathname);
        if (token) {
          const provider = state === 'facebook' ? 'facebook' : 'google';
          await processOAuthLogin(token, provider);
        }
      }
    };

    handleOAuthCallback();
  }, [location]);

  const processOAuthLogin = async (tokenOrCode: string, type: string) => {
    setOauthLoading(true);
    setErrorAlert(null);
    message.loading({ content: `Đang xác thực tài khoản qua ${type.toUpperCase()}...`, key: 'oauth2' });

    try {
      const res = await authApi.loginOAuth2(tokenOrCode, type);
      message.success({ content: `Đăng nhập qua ${type.toUpperCase()} thành công!`, key: 'oauth2' });

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
      const errorMsg = err.response?.data?.message || err.message || `Đăng nhập qua ${type} thất bại`;
      message.error({ content: errorMsg, key: 'oauth2' });
      setErrorAlert(errorMsg);

      // Nếu tài khoản chưa kích hoạt OTP, mở modal kích hoạt
      if (errorMsg.includes('chưa được kích hoạt') || errorMsg.includes('OTP')) {
        const extractedEmail = errorMsg.match(/\[(.*?)\]/)?.[1] || '';
        if (extractedEmail) {
          setUnverifiedEmail(extractedEmail);
          setShowOtpModal(true);
        }
      }
    } finally {
      setOauthLoading(false);
    }
  };

  const handleFinish = async (values: any) => {
    setLoading(true);
    setErrorAlert(null);
    try {
      const res = await authApi.login(values.identifier, values.password);
      login(res.accessToken, {
        id: res.userId,
        username: res.username,
        fullName: res.fullName,
        phoneNumber: res.phoneNumber,
        email: res.email,
        roles: res.roles,
      });
      message.success(`Đăng nhập thành công! Chào mừng ${res.fullName}`);
      navigate('/dashboard');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
      setErrorAlert(errorMsg);

      if (errorMsg.includes('chưa được kích hoạt') || errorMsg.includes('OTP')) {
        setUnverifiedEmail(values.identifier);
        setShowOtpModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Kích hoạt xác thực mạng xã hội
  const handleSocialLogin = (provider: 'google' | 'facebook' | 'github') => {
    setErrorAlert(null);
    const redirectUri = encodeURIComponent(window.location.origin + '/login');

    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '146681352133-vlqosog6vd92leukas8mn7sitooqerfd.apps.googleusercontent.com';
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=email%20profile&state=google`;
    } else if (provider === 'github') {
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23li7ujz4ZyEXugVa5';
      window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`;
    } else if (provider === 'facebook') {
      const appId = import.meta.env.VITE_FACEBOOK_APP_ID || '1263761462121053';
      window.location.href = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=token&scope=email,public_profile&state=facebook`;
    }
  };

  // Xác thực OTP kích hoạt tài khoản
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      message.error('Vui lòng nhập đầy đủ 6 chữ số mã OTP');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await authApi.verifyOtp(unverifiedEmail, otpCode);
      message.success('Kích hoạt tài khoản thành công! Đang đăng nhập...');
      setShowOtpModal(false);
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
      message.error(err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      await authApi.resendOtp(unverifiedEmail);
      message.success('Đã gửi lại mã OTP mới qua email!');
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể gửi lại OTP');
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
          <p className="text-gray-500 text-sm mt-1">Cổng thông tin Khách hàng Chuyển phát nhanh</p>
        </div>

        <Card className="shadow-xl rounded-2xl border-0 overflow-hidden">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Đăng nhập tài khoản</h2>

          {errorAlert && (
            <Alert
              message="Thông báo đăng nhập"
              description={
                <div>
                  <p className="mb-2">{errorAlert}</p>
                  {errorAlert.includes('chưa được đăng ký') && (
                    <Link to="/register" className="font-bold text-red-600 underline">
                      👉 Nhấn vào đây để đăng ký tài khoản mới ngay!
                    </Link>
                  )}
                </div>
              }
              type="error"
              showIcon
              closable
              className="mb-4 text-xs"
              onClose={() => setErrorAlert(null)}
            />
          )}

          <Form form={form} layout="vertical" onFinish={handleFinish}>
            <Form.Item
              name="identifier"
              label="Username / Email / Số điện thoại"
              rules={[{ required: true, message: 'Vui lòng nhập thông tin đăng nhập' }]}
            >
              <Input
                prefix={<User size={16} className="text-gray-400 mr-1" />}
                placeholder="Nhập tên đăng nhập, email hoặc SĐT"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Mật khẩu"
              rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            >
              <Input.Password
                prefix={<Lock size={16} className="text-gray-400 mr-1" />}
                placeholder="••••••••"
                size="large"
                className="rounded-lg"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              className="w-full bg-red-600 hover:bg-red-700 h-11 text-base font-semibold rounded-lg shadow-md"
            >
              Đăng nhập ngay
            </Button>
          </Form>

          {/* Third-Party Social Logins (Google, Facebook, GitHub) */}
          <Divider className="my-5 text-gray-400 text-xs">Hoặc đăng nhập nhanh bằng bên thứ 3</Divider>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              disabled={oauthLoading}
              onClick={() => handleSocialLogin('google')}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-red-50 hover:border-red-300 text-gray-700 text-xs font-semibold transition-all shadow-xs"
              title="Đăng nhập bằng Google"
            >
              <GoogleOutlined className="text-red-500 text-base" />
              <span>Google</span>
            </button>

            <button
              type="button"
              disabled={oauthLoading}
              onClick={() => handleSocialLogin('facebook')}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-300 text-gray-700 text-xs font-semibold transition-all shadow-xs"
              title="Đăng nhập bằng Facebook"
            >
              <FacebookFilled className="text-blue-600 text-base" />
              <span>Facebook</span>
            </button>

            <button
              type="button"
              disabled={oauthLoading}
              onClick={() => handleSocialLogin('github')}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-100 hover:border-gray-400 text-gray-800 text-xs font-semibold transition-all shadow-xs"
              title="Đăng nhập bằng GitHub"
            >
              <GithubOutlined className="text-gray-900 text-base" />
              <span>GitHub</span>
            </button>
          </div>

          <div className="text-center mt-6 pt-4 border-t border-gray-100 text-xs text-gray-500">
            Chưa có tài khoản Shop?{' '}
            <Link to="/register" className="text-red-600 font-semibold hover:underline">
              Đăng ký tài khoản mới
            </Link>
          </div>
        </Card>
      </div>

      {/* Modal Kích hoạt tài khoản qua OTP */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-red-600">
            <KeyRound size={20} />
            <span className="font-bold">Kích hoạt tài khoản qua Email OTP</span>
          </div>
        }
        open={showOtpModal}
        onCancel={() => setShowOtpModal(false)}
        footer={null}
        destroyOnClose
      >
        <div className="py-2 space-y-4">
          <p className="text-gray-600 text-sm">
            Tài khoản <b className="text-gray-900">{unverifiedEmail}</b> chưa được kích hoạt. Vui lòng nhập mã OTP 6 chữ số đã được gửi tới hòm thư của bạn:
          </p>

          <Input
            size="large"
            maxLength={6}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="text-center text-2xl tracking-widest font-mono font-bold"
          />

          <div className="flex space-x-3 pt-2">
            <Button
              type="primary"
              loading={otpLoading}
              onClick={handleVerifyOtp}
              className="flex-1 bg-red-600 hover:bg-red-700 h-10 font-semibold"
            >
              Xác thực & Đăng nhập
            </Button>
            <Button onClick={handleResendOtp} className="h-10">
              Gửi lại mã
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
