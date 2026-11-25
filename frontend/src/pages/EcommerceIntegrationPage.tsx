import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tabs,
  Typography,
  Space,
  Tooltip,
  Badge,
  Alert,
} from 'antd';
import {
  ShoppingBag,
  Plus,
  Copy,
  Key,
  RefreshCw,
  Power,
  Trash2,
  Code,
  Globe,
  CheckCircle2,
  Send,
  ExternalLink,
  ShieldCheck,
  Zap,
  Lock,
} from 'lucide-react';
import { ecommerceApi, EcommerceChannelDTO, CreateChannelPayload } from '../api/ecommerce';
import { useAuth } from '../context/AuthContext';

const { Text, Paragraph } = Typography;

export const EcommerceIntegrationPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.some((r: any) => (typeof r === 'string' ? r : r.roleName) === 'ROLE_ADMIN');

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <Alert
          type="error"
          showIcon
          icon={<Lock className="text-red-600" />}
          message="Từ chối truy cập (Chỉ dành cho Quản trị viên)"
          description="Chức năng Quản lý Hệ thống Open API & Liên kết các sàn Thương Mại Điện Tử (Shopee, Lazada, TikTok...) chỉ dành riêng cho tài khoản Quản trị viên (Admin) của Rikkei Post."
          action={
            <Button type="primary" danger onClick={() => window.location.href = '/dashboard'}>
              Về Trang Chủ
            </Button>
          }
        />
      </div>
    );
  }
  const [channels, setChannels] = useState<EcommerceChannelDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [selectedChannel, setSelectedChannel] = useState<EcommerceChannelDTO | null>(null);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState<boolean>(false);

  const [form] = Form.useForm();
  const [testForm] = Form.useForm();

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const data = await ecommerceApi.getChannels();
      setChannels(Array.isArray(data) ? data : []);
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || 'Không thể tải danh sách kênh liên kết!');
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (values: CreateChannelPayload) => {
    try {
      await ecommerceApi.createChannel(values);
      message.success('🎉 Kết nối sàn thương mại điện tử thành công!');
      setCreateModalOpen(false);
      form.resetFields();
      loadChannels();
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || 'Lỗi khi tạo kết nối sàn!');
    }
  };

  const handleRegenerateKey = async (id: number) => {
    try {
      await ecommerceApi.regenerateApiKey(id);
      message.success('Đã làm mới API Key bí mật thành công!');
      loadChannels();
    } catch (e: any) {
      message.error('Không thể làm mới API Key: ' + e.message);
    }
  };

  const handleToggleStatus = async (id: number) => {
    try {
      const res = await ecommerceApi.toggleChannelStatus(id);
      message.success(`Đã cập nhật trạng thái kênh sang ${res.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng'}`);
      loadChannels();
    } catch (e: any) {
      message.error('Không thể cập nhật trạng thái: ' + e.message);
    }
  };

  const handleDeleteChannel = async (id: number) => {
    try {
      await ecommerceApi.deleteChannel(id);
      message.success('Đã xóa kênh kết nối sàn!');
      loadChannels();
    } catch (e: any) {
      message.error('Không thể xóa kênh: ' + e.message);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`Đã sao chép ${label} vào bộ nhớ tạm!`);
  };

  const handleCheckPing = async () => {
    try {
      const res = await ecommerceApi.testPing();
      setPingStatus('Kết nối thành công (200 OK)');
      message.success('Cổng Open API Rikkei Post hoạt động bình thường!');
    } catch (e: any) {
      setPingStatus('Lỗi kết nối');
      message.error('Không thể ping Open API');
    }
  };

  const handleRunTestOrder = async (values: any) => {
    if (!selectedChannel) {
      message.warning('Vui lòng chọn một kênh liên kết để kiểm tra!');
      return;
    }
    setTestLoading(true);
    setTestResult(null);
    try {
      const payload = {
        ecommerceOrderId: values.ecommerceOrderId || 'TEST_ECOM_' + Date.now().toString().slice(-6),
        platform: selectedChannel.platform,
        senderName: values.senderName || 'Gian Hàng Test Mall',
        senderPhone: values.senderPhone || '0988776655',
        senderAddress: values.senderAddress || 'Số 10 Trịnh Văn Bô, Nam Từ Liêm, Hà Nội',
        senderProvinceId: values.senderProvinceId || 1, // Hà Nội
        senderWardName: values.senderWardName || 'Phường Xuân Phương',
        receiverName: values.receiverName || 'Nguyễn Văn Mua Hàng',
        receiverPhone: values.receiverPhone || '0912345678',
        receiverAddress: values.receiverAddress || 'Số 123 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
        receiverProvinceId: values.receiverProvinceId || 79, // TP.HCM
        receiverWardName: values.receiverWardName || 'Phường Bến Nghé',
        itemName: values.itemName || 'Đơn hàng Thời trang Quần Áo Shopee',
        itemValue: Number(values.itemValue) || 250000,
        actualWeightGram: Number(values.actualWeightGram) || 500,
        codAmount: Number(values.codAmount) || 280000,
        notes: values.notes || 'Khách đặt qua sàn TMĐT chọn Rikkei Post giao hỏa tốc',
      };

      const res = await ecommerceApi.testCreateOrder(selectedChannel.apiKey, payload);
      setTestResult(res);
      message.success('🚀 Gọi Open API tạo đơn thành công! Vận đơn: ' + res.trackingCode);
      loadChannels();
    } catch (e: any) {
      message.error(e.response?.data?.message || e.message || 'Lỗi khi gọi Open API!');
    } finally {
      setTestLoading(false);
    }
  };

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'SHOPEE':
        return <Tag color="#EE4D2D" className="font-bold px-2 py-0.5 rounded-full">SHOPEE</Tag>;
      case 'LAZADA':
        return <Tag color="#0F146D" className="font-bold px-2 py-0.5 rounded-full text-white bg-indigo-900">LAZADA</Tag>;
      case 'TIKTOK':
        return <Tag color="#000000" className="font-bold px-2 py-0.5 rounded-full">TIKTOK SHOP</Tag>;
      case 'TIKI':
        return <Tag color="#1A94FF" className="font-bold px-2 py-0.5 rounded-full">TIKI</Tag>;
      default:
        return <Tag color="blue" className="font-bold px-2 py-0.5 rounded-full">{platform}</Tag>;
    }
  };

  const totalSynced = channels.reduce((acc, c) => acc + (c.totalOrdersSynced || 0), 0);
  const activeCount = channels.filter((c) => c.status === 'ACTIVE').length;

  const columns = [
    {
      title: 'Sàn TMĐT',
      dataIndex: 'platform',
      key: 'platform',
      render: (p: string) => getPlatformBadge(p),
    },
    {
      title: 'Tên gian hàng / Shop',
      key: 'channelName',
      render: (_: any, r: EcommerceChannelDTO) => (
        <div>
          <div className="font-bold text-gray-800 text-sm">{r.channelName}</div>
          <div className="text-xs text-gray-400 font-mono">Shop ID: {r.shopId || 'N/A'}</div>
        </div>
      ),
    },
    {
      title: 'API Key (Xác thực Open API)',
      dataIndex: 'apiKey',
      key: 'apiKey',
      render: (key: string, r: EcommerceChannelDTO) => (
        <div className="flex items-center gap-1.5">
          <code className="text-xs font-mono bg-gray-100 text-gray-800 px-2 py-1 rounded border max-w-[170px] truncate select-all">
            {key}
          </code>
          <Tooltip title="Sao chép API Key">
            <Button
              type="text"
              size="small"
              icon={<Copy size={13} className="text-gray-500 hover:text-red-600" />}
              onClick={() => handleCopy(key, 'API Key')}
            />
          </Tooltip>
          <Tooltip title="Làm mới (Đổi API Key)">
            <Popconfirm
              title="Sinh lại API Key mới?"
              description="Sàn TMĐT sẽ cần cập nhật API Key mới này để tiếp tục tạo đơn!"
              onConfirm={() => handleRegenerateKey(r.id)}
              okText="Đổi Key"
              cancelText="Hủy"
            >
              <Button
                type="text"
                size="small"
                icon={<RefreshCw size={13} className="text-blue-500 hover:text-blue-700" />}
              />
            </Popconfirm>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Đơn đã đẩy',
      dataIndex: 'totalOrdersSynced',
      key: 'totalOrdersSynced',
      render: (count: number) => (
        <span className="font-extrabold text-red-600 text-sm">
          {count || 0} <span className="text-xs text-gray-400 font-normal">đơn</span>
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) =>
        st === 'ACTIVE' ? (
          <Badge status="success" text={<span className="text-xs font-semibold text-emerald-600">Đang nhận đơn</span>} />
        ) : (
          <Badge status="default" text={<span className="text-xs font-semibold text-gray-400">Tạm ngưng</span>} />
        ),
    },
    {
      title: 'Đồng bộ gần nhất',
      dataIndex: 'lastSyncedAt',
      key: 'lastSyncedAt',
      render: (t: string) => (t ? new Date(t).toLocaleString('vi-VN') : <span className="text-gray-400">-</span>),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, r: EcommerceChannelDTO) => (
        <Space size="small">
          <Tooltip title={r.status === 'ACTIVE' ? 'Tạm ngưng nhận đơn' : 'Bật nhận đơn'}>
            <Button
              size="small"
              type="text"
              icon={<Power size={14} className={r.status === 'ACTIVE' ? 'text-amber-500' : 'text-emerald-500'} />}
              onClick={() => handleToggleStatus(r.id)}
            />
          </Tooltip>
          <Tooltip title="Chạy thử nghiệm tạo đơn Open API">
            <Button
              size="small"
              type="text"
              icon={<Send size={14} className="text-blue-600" />}
              onClick={() => {
                setSelectedChannel(r);
                setTestModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Xóa liên kết">
            <Popconfirm
              title="Xóa liên kết sàn này?"
              onConfirm={() => handleDeleteChannel(r.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button size="small" type="text" danger icon={<Trash2 size={14} />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-red-600 text-lg font-black tracking-tight">
            <ShoppingBag size={22} />
            <span>Liên Kết Sàn Thương Mại Điện Tử & Open API Đối Tác</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Mở rộng cổng tiếp nhận đơn hàng tự động từ Shopee, Lazada, TikTok Shop, Tiki khi khách hàng chọn Rikkei Post làm đơn vị vận chuyển.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<RefreshCw size={14} />}
            onClick={loadChannels}
            loading={loading}
            className="rounded-xl font-medium"
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
            className="bg-red-600 hover:bg-red-700 font-bold rounded-xl flex items-center shadow-xs"
          >
            + Kết nối sàn mới
          </Button>
        </div>
      </div>

      {/* Thống kê nhanh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card size="small" className="rounded-2xl border-gray-100 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Tổng kênh liên kết</div>
          <div className="text-2xl font-black text-gray-800 mt-1">{channels.length}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">● {activeCount} kênh đang nhận đơn</div>
        </Card>
        <Card size="small" className="rounded-2xl border-gray-100 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Đơn hàng đã tiếp nhận từ sàn</div>
          <div className="text-2xl font-black text-red-600 mt-1">{totalSynced.toLocaleString('vi-VN')}</div>
          <div className="text-[11px] text-gray-400 mt-0.5">Tự động tạo mã vận đơn RKP</div>
        </Card>
        <Card size="small" className="rounded-2xl border-gray-100 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Cổng Open API Endpoint</div>
          <div className="text-xs font-mono font-bold text-blue-700 mt-1 truncate">
            /api/v1/ecommerce/open
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">✓ Hỗ trợ CORS & Webhook</div>
        </Card>
        <Card size="small" className="rounded-2xl border-gray-100 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">Kiểm tra kết nối Live Ping</div>
          <div className="flex items-center gap-2 mt-1">
            <Button size="small" onClick={handleCheckPing} icon={<Zap size={13} className="text-amber-500" />}>
              Test Ping
            </Button>
            <span className="text-xs font-semibold text-gray-600">{pingStatus || 'Chưa kiểm tra'}</span>
          </div>
        </Card>
      </div>

      {/* Tabs Quản lý & Tài liệu Open API */}
      <Card className="rounded-2xl border-gray-100 shadow-xs" bodyStyle={{ padding: 16 }}>
        <Tabs
          defaultActiveKey="channels"
          items={[
            {
              key: 'channels',
              label: (
                <span className="flex items-center gap-1.5 font-bold">
                  <ShoppingBag size={16} /> Danh sách kênh sàn TMĐT ({channels.length})
                </span>
              ),
              children: (
                <div className="space-y-4">
                  <Alert
                    type="info"
                    showIcon
                    message="Nguyên lý hoạt động với Sàn TMĐT (Shopee, Lazada, TikTok Shop...)"
                    description="Khi người mua trên sàn chọn đơn vị vận chuyển là Rikkei Post, hệ thống của sàn sẽ tự động gọi Open API phía dưới kèm mã API Key của bạn để tạo vận đơn vào database Rikkei Post và in mã vạch AWB."
                  />
                  <Table
                    dataSource={Array.isArray(channels) ? channels : []}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    scroll={{ x: 800 }}
                  />
                </div>
              ),
            },
            {
              key: 'developer-docs',
              label: (
                <span className="flex items-center gap-1.5 font-bold">
                  <Code size={16} /> Tài liệu Open API & Hướng dẫn Tích hợp Sàn
                </span>
              ),
              children: (
                <div className="space-y-5 p-2 max-w-4xl">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" /> 1. Cơ chế xác thực (Authentication)
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Mỗi request từ sàn TMĐT gọi sang máy chủ Rikkei Post cần đính kèm header HTTP chứa <b>API Key</b> được sinh tự động:
                    </p>
                    <div className="bg-gray-900 text-green-400 p-3 rounded-lg text-xs font-mono mt-2 select-all">
                      X-API-KEY: rkp_shopee_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <Globe size={16} className="text-blue-600" /> 2. API Tạo đơn vận chuyển tự động (Create Shipment Order)
                    </h3>
                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <div><b>Method:</b> <Tag color="green">POST</Tag></div>
                      <div><b>Endpoint URL:</b> <code className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-800 font-mono">https://huongcaoha.site/api/v1/ecommerce/open/orders/create</code></div>
                      <div><b>CORS Policy:</b> Đã kích hoạt cho mọi domain đối tác (Shopee, TikTok, Lazada, v.v.).</div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-bold text-gray-700 mb-1">Mẫu cURL request gửi từ hệ thống Sàn TMĐT:</div>
                      <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed">
{`curl -X POST https://huongcaoha.site/api/v1/ecommerce/open/orders/create \\
  -H "Content-Type: application/json" \\
  -H "X-API-KEY: rkp_shopee_your_api_key_here" \\
  -d '{
    "ecommerceOrderId": "SHOPEE_20261125_0099",
    "senderName": "Gian Hàng Shopee Mall",
    "senderPhone": "0988776655",
    "senderAddress": "Số 10 Trịnh Văn Bô, Nam Từ Liêm, Hà Nội",
    "senderProvinceId": 1,
    "receiverName": "Nguyễn Văn Mua",
    "receiverPhone": "0912345678",
    "receiverAddress": "123 Lê Lợi, Bến Nghé, Quận 1, TP.HCM",
    "receiverProvinceId": 79,
    "receiverWardName": "Phường Bến Nghé",
    "itemName": "Đơn hàng Quần Áo & Phụ kiện",
    "actualWeightGram": 500,
    "codAmount": 350000,
    "notes": "Hàng dễ vỡ, xin nhẹ tay"
  }'`}
                      </pre>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs font-bold text-gray-700 mb-1">Cấu trúc phản hồi thành công (JSON Response):</div>
                      <pre className="bg-gray-900 text-green-400 p-3 rounded-lg text-[11px] font-mono overflow-x-auto">
{`{
  "success": true,
  "message": "Đã tạo vận đơn Rikkei Post thành công",
  "data": {
    "success": true,
    "trackingCode": "RKP261125000088",
    "ecommerceOrderId": "SHOPEE_20261125_0099",
    "orderStatus": "CREATED",
    "shippingFee": 28000,
    "codAmount": 350000,
    "sortingHub": "Hà Nội Hub",
    "labelUrl": "https://huongcaoha.site/orders/print/RKP261125000088",
    "createdAt": "2026-11-25T19:50:00"
  }
}`}
                      </pre>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                      <Send size={16} className="text-purple-600" /> 3. Các API mở rộng khác dành cho Sàn TMĐT
                    </h3>
                    <ul className="text-xs text-gray-600 mt-2 space-y-2 list-disc pl-5">
                      <li>
                        <b>POST /api/v1/ecommerce/open/shipping-rate</b>: Tính cước vận chuyển tức thời để sàn hiển thị phí ship cho người mua hàng trước khi thanh toán.
                      </li>
                      <li>
                        <b>GET /api/v1/ecommerce/open/tracking/{'{trackingCode}'}</b>: Tra cứu hành trình bưu gửi để sàn cập nhật trạng thái "Đang lấy hàng", "Đang giao", "Giao thành công" lên app Shopee/Lazada/TikTok.
                      </li>
                      <li>
                        <b>POST /api/v1/ecommerce/open/orders/{'{trackingCode}'}/cancel</b>: Hủy vận chuyển khi người mua nhấn "Hủy đơn" trên sàn TMĐT.
                      </li>
                    </ul>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Kết Nối Sàn Mới */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-red-600 font-bold text-base">
            <ShoppingBag size={18} />
            Thêm Kết Nối Sàn Thương Mại Điện Tử Mới
          </div>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateChannel} className="mt-3">
          <Form.Item
            name="platform"
            label="Chọn sàn thương mại điện tử"
            rules={[{ required: true, message: 'Vui lòng chọn sàn TMĐT' }]}
            initialValue="SHOPEE"
          >
            <Select
              options={[
                { value: 'SHOPEE', label: 'Shopee Mall / Shopee Shop' },
                { value: 'TIKTOK', label: 'TikTok Shop Seller Center' },
                { value: 'LAZADA', label: 'Lazada Open Platform' },
                { value: 'TIKI', label: 'Tiki Seller' },
                { value: 'CUSTOM', label: 'Website TMĐT riêng (WooCommerce / Sapo / Haravan)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="channelName"
            label="Tên gian hàng / Kênh kết nối"
            rules={[{ required: true, message: 'Vui lòng nhập tên gian hàng' }]}
          >
            <Input placeholder="Ví dụ: Shopee Thời Trang Nam Official" />
          </Form.Item>

          <Form.Item name="shopId" label="Mã Shop / Seller ID trên sàn (nếu có)">
            <Input placeholder="Ví dụ: 8829104812" />
          </Form.Item>

          <Form.Item name="webhookUrl" label="Webhook URL của sàn nhận phản hồi (tùy chọn)">
            <Input placeholder="https://seller.shopee.vn/api/v2/webhook" />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={() => setCreateModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-red-600 hover:bg-red-700 font-semibold">
              Xác nhận kết nối & Sinh API Key
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Sandbox Test Gọi Open API Tạo Đơn Mẫu */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-600 font-bold text-base">
            <Send size={18} />
            Thử Nghiệm Tạo Đơn Mẫu Qua Open API (Sandbox)
          </div>
        }
        open={testModalOpen}
        onCancel={() => {
          setTestModalOpen(false);
          setTestResult(null);
        }}
        footer={null}
        width={680}
      >
        {selectedChannel && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1">
              <div>Đang test với kênh: <b>{selectedChannel.channelName}</b> ({selectedChannel.platform})</div>
              <div>API Key sử dụng: <code className="bg-blue-100 px-1 py-0.5 rounded text-blue-900">{selectedChannel.apiKey}</code></div>
            </div>

            <Form form={testForm} layout="vertical" onFinish={handleRunTestOrder}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Form.Item name="ecommerceOrderId" label="Mã đơn sàn giả định" initialValue={"SP_" + Date.now().toString().slice(-6)}>
                  <Input />
                </Form.Item>
                <Form.Item name="itemName" label="Tên hàng hóa" initialValue="Quần Áo Shopee Test">
                  <Input />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Form.Item name="actualWeightGram" label="Cân nặng (gram)" initialValue={500}>
                  <Input type="number" />
                </Form.Item>
                <Form.Item name="codAmount" label="Tiền thu hộ COD (VNĐ)" initialValue={320000}>
                  <Input type="number" />
                </Form.Item>
                <Form.Item name="itemValue" label="Giá trị hàng (VNĐ)" initialValue={320000}>
                  <Input type="number" />
                </Form.Item>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Form.Item name="receiverName" label="Tên người nhận" initialValue="Khách Mua Hàng Shopee">
                  <Input />
                </Form.Item>
                <Form.Item name="receiverPhone" label="SĐT người nhận" initialValue="0987654321">
                  <Input />
                </Form.Item>
              </div>

              <Form.Item name="receiverAddress" label="Địa chỉ giao hàng" initialValue="Số 99 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh">
                <Input />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={testLoading}
                block
                className="bg-blue-600 hover:bg-blue-700 h-10 font-bold rounded-xl mt-2"
              >
                Gửi Request Tạo Đơn Thử Nghiệm
              </Button>
            </Form>

            {testResult && (
              <div className="p-3 bg-gray-900 text-green-400 rounded-xl text-xs font-mono mt-3">
                <div className="text-white font-bold mb-1">✓ Phản hồi từ Rikkei Post:</div>
                <div>Mã vận đơn sinh tự động: <b>{testResult.trackingCode}</b></div>
                <div>Trạng thái vận đơn: <b>{testResult.orderStatus}</b></div>
                <div>Cước vận chuyển: <b>{Number(testResult.shippingFee).toLocaleString('vi-VN')} đ</b></div>
                <div>Tiền COD: <b>{Number(testResult.codAmount).toLocaleString('vi-VN')} đ</b></div>
                <div className="mt-2 text-blue-300">
                  <a href={testResult.labelUrl} target="_blank" rel="noreferrer" className="underline flex items-center gap-1">
                    Xem nhãn in AWB <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
