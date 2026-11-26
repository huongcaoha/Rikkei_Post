import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Input,
  Space,
  Row,
  Col,
  Statistic,
  message,
  Tabs,
  Alert,
  Modal,
  Typography,
  Badge
} from 'antd';
import {
  CarOutlined,
  BarcodeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ArrowRightOutlined,
  EnvironmentOutlined,
  ClockCircleOutlined,
  InboxOutlined,
  CameraOutlined,
  SoundOutlined,
  MutedOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { wmsApi } from '../api/wms';
import { MasterBag } from '../types';
import { useAuth } from '../context/AuthContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';

const { Title, Text } = Typography;

export const TruckDriverPortalPage: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<MasterBag[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');

  // Quét nhận bao tải
  const [scanCode, setScanCode] = useState('');
  const [scanning, setScanning] = useState(false);

  // Chi tiết bao tải
  const [selectedBag, setSelectedBag] = useState<MasterBag | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // State Camera quét mã trực tiếp bằng điện thoại
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    code: string;
    message: string;
    success: boolean;
    time: string;
  } | null>(null);
  const [sessionScannedList, setSessionScannedList] = useState<Array<{ code: string; time: string }>>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);

  // Âm thanh Beep báo hiệu (Web Audio API)
  const playSound = (isSuccess: boolean) => {
    if (isMuted) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (isSuccess) {
        osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(329.6, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      // Bỏ qua lỗi âm thanh nếu trình duyệt hạn chế
    }
  };

  const handleOpenCameraModal = () => {
    setIsCameraModalOpen(true);
    setLastScannedFeedback(null);
    setTimeout(() => {
      startCamera(facingMode);
    }, 350);
  };

  const handleCloseCameraModal = async () => {
    await stopCamera();
    setIsCameraModalOpen(false);
  };

  const startCamera = async (mode: 'environment' | 'user') => {
    try {
      if (html5QrCodeRef.current) {
        await stopCamera();
      }
      await new Promise((r) => setTimeout(r, 200));
      const element = document.getElementById('truck-camera-reader');
      if (!element) return;

      const qrCode = new Html5Qrcode('truck-camera-reader');
      html5QrCodeRef.current = qrCode;

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 200 },
        aspectRatio: 1.333,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
        ],
      };

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cameras && cameras.length > 0) {
          const backCam =
            cameras.find(
              (c) =>
                c.label.toLowerCase().includes('back') ||
                c.label.toLowerCase().includes('sau') ||
                c.label.toLowerCase().includes('environment')
            ) || cameras[cameras.length - 1];

          await qrCode.start(
            mode === 'environment'
              ? backCam
                ? backCam.id
                : { facingMode: 'environment' }
              : { facingMode: 'user' },
            config,
            (decodedText) => handleCameraDecoded(decodedText),
            () => {}
          );
        } else {
          await qrCode.start(
            { facingMode: mode },
            config,
            (decodedText) => handleCameraDecoded(decodedText),
            () => {}
          );
        }
        setCameraActive(true);
      } catch (camErr) {
        await qrCode.start(
          { facingMode: mode },
          config,
          (decodedText) => handleCameraDecoded(decodedText),
          () => {}
        );
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Lỗi bật camera:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (e) {
        // Ignore
      }
      html5QrCodeRef.current = null;
    }
    setCameraActive(false);
  };

  const handleSwitchCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const handleCameraDecoded = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    // Chặn quét lặp cùng 1 mã trong vòng 2.5 giây
    const now = Date.now();
    if (code === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastScannedCodeRef.current = code;
    lastScannedTimeRef.current = now;

    try {
      const res = await wmsApi.driverScanTransit(code);
      playSound(true);
      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setLastScannedFeedback({
        code: res.bagCode || code,
        message: `Đã quét nhận bao tải [${res.bagCode || code}] lên xe thành công!`,
        success: true,
        time: timeStr,
      });
      setSessionScannedList((prev) => [{ code: res.bagCode || code, time: timeStr }, ...prev]);
      fetchDriverTasks();
    } catch (err: any) {
      playSound(false);
      const errMsg = err.response?.data?.message || err.message || 'Lỗi quét bao tải';
      setLastScannedFeedback({
        code,
        message: errMsg,
        success: false,
        time: new Date().toLocaleTimeString('vi-VN'),
      });
    } finally {
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 700);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const fetchDriverTasks = async () => {
    try {
      setLoading(true);
      const data = await wmsApi.getDriverTasks(user?.id);
      setTasks(data || []);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải danh sách nhiệm vụ tài xế');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverTasks();
  }, [user]);

  // Lắng nghe realtime khi được gán bao tải mới
  useOrderWebSocket({
    onEvent: (event) => {
      if (
        event.type === 'BAG_ASSIGNED_TO_DRIVER' ||
        event.type === 'MASTER_BAG_IN_TRANSIT' ||
        event.type === 'MASTER_BAG_ARRIVED_AT_HUB'
      ) {
        fetchDriverTasks();
      }
    },
    showNotification: true,
  });

  const handleScanTransit = async (codeToScan?: string) => {
    const code = (codeToScan || scanCode).trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng nhập hoặc quét mã bao tải!');
      return;
    }

    setScanning(true);
    try {
      const res = await wmsApi.driverScanTransit(code);
      message.success(`Đã quét nhận bao tải [${res.bagCode}] lên xe thành công! Toàn bộ đơn hàng đã chuyển sang trạng thái đang trung chuyển qua Kafka.`);
      setScanCode('');
      fetchDriverTasks();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Lỗi quét nhận bao tải';
      message.error(errMsg);
    } finally {
      setScanning(false);
    }
  };

  const handleOpenDetail = async (bag: MasterBag) => {
    try {
      const detail = await wmsApi.getBagById(bag.id);
      setSelectedBag(detail);
      setDetailModalOpen(true);
    } catch (err: any) {
      setSelectedBag(bag);
      setDetailModalOpen(true);
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (activeTab === 'WAITING') return ['SEALED', 'ASSIGNED_TO_DRIVER'].includes(t.status);
    if (activeTab === 'TRANSIT') return t.status === 'IN_TRANSIT';
    if (activeTab === 'COMPLETED') return ['ARRIVED_AT_HUB', 'UNSEALED', 'RECEIVED'].includes(t.status);
    return true;
  });

  const waitingCount = tasks.filter(t => ['SEALED', 'ASSIGNED_TO_DRIVER'].includes(t.status)).length;
  const transitCount = tasks.filter(t => t.status === 'IN_TRANSIT').length;
  const completedCount = tasks.filter(t => ['ARRIVED_AT_HUB', 'UNSEALED', 'RECEIVED'].includes(t.status)).length;

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'SEALED':
      case 'ASSIGNED_TO_DRIVER':
        return <Tag color="gold" icon={<ClockCircleOutlined />}>Chờ tài xế lấy</Tag>;
      case 'IN_TRANSIT':
        return <Tag color="blue" icon={<SyncOutlined spin />}>Đang trên xe trung chuyển</Tag>;
      case 'ARRIVED_AT_HUB':
        return <Tag color="cyan" icon={<CheckCircleOutlined />}>Đã đến kho Hub</Tag>;
      case 'UNSEALED':
      case 'RECEIVED':
        return <Tag color="green" icon={<CheckCircleOutlined />}>Đã bàn giao hoàn tất</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Mã Bao Tải & Kẹp Chì',
      key: 'bagInfo',
      render: (_: any, r: MasterBag) => (
        <div>
          <span className="font-mono font-bold text-blue-700 text-base">{r.bagCode}</span>
          {r.sealNumber && (
            <div className="mt-1">
              <Tag color="volcano" className="font-mono text-xs">Seal: {r.sealNumber}</Tag>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Lộ Trình Vận Chuyển',
      key: 'route',
      render: (_: any, r: MasterBag) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-gray-800 flex items-center gap-1">
              <EnvironmentOutlined className="text-gray-400" /> {r.originWarehouseName}
            </span>
            <ArrowRightOutlined className="text-gray-400" />
            <span className="font-bold text-red-600 flex items-center gap-1">
              <EnvironmentOutlined className="text-red-500" /> {r.destWarehouseName}
            </span>
          </div>
          {r.assignedTruckPlate && (
            <div className="text-xs text-gray-500">
              Xe tải chuyên chở: <Tag color="gold" className="font-bold">{r.assignedTruckPlate}</Tag>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Số Kiện & Tải trọng',
      key: 'cargo',
      render: (_: any, r: MasterBag) => (
        <div>
          <div className="font-bold text-gray-900">{r.totalItems} kiện hàng</div>
          <div className="text-xs text-gray-500">{Number(r.totalWeightKg).toFixed(2)} kg</div>
        </div>
      )
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => renderStatusTag(st)
    },
    {
      title: 'Thao Tác Tác Nghiệp',
      key: 'actions',
      render: (_: any, r: MasterBag) => (
        <Space size="small">
          {['SEALED', 'ASSIGNED_TO_DRIVER'].includes(r.status) && (
            <Button
              type="primary"
              size="middle"
              icon={<CarOutlined />}
              onClick={() => handleScanTransit(r.bagCode)}
              loading={scanning}
              className="bg-blue-600 hover:bg-blue-700 font-semibold"
            >
              Quét nhận & Lên xe
            </Button>
          )}

          <Button size="middle" onClick={() => handleOpenDetail(r)}>
            Xem kiện bên trong
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-200 text-sm font-semibold mb-1">
            <CarOutlined /> CỔNG TÁC NGHIỆP VẬN TẢI ĐƯỜNG TRỤC
          </div>
          <h1 className="text-2xl font-bold text-white mb-0">
            Tài Xế Xe Tải: {user?.fullName} ({user?.phoneNumber})
          </h1>
          <p className="text-blue-100 text-xs mt-1">
            Quét mã bao tải kẹp chì để vận chuyển trung chuyển liên bưu cục và kho Hub trung tâm
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="large"
            icon={<SyncOutlined />}
            onClick={fetchDriverTasks}
            loading={loading}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            Làm mới
          </Button>
        </div>
      </div>

      {/* Quét nhanh mã bao tải & Camera trực tiếp */}
      <Card className="shadow-sm border-2 border-blue-300 bg-gradient-to-br from-blue-50/90 to-indigo-50/60">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center p-1.5 rounded-lg bg-blue-600 text-white">
                <CameraOutlined />
              </span>
              <h3 className="text-base font-bold text-blue-950 mb-0">
                Tác Nghiệp Quét Mã Bao Tải Hàng & Kẹp Chì Lên Xe
              </h3>
            </div>
            <p className="text-xs text-blue-800 mb-0">
              Quét liên tục bằng Camera điện thoại hoặc nhập mã thủ công. Hệ thống tự động gán tên tài xế & xe tải, đồng thời cập nhật realtime qua Kafka sang trạng thái Đang trung chuyển (IN_TRANSIT).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <Button
              type="primary"
              size="large"
              icon={<CameraOutlined />}
              onClick={handleOpenCameraModal}
              className="bg-red-600 hover:bg-red-700 h-12 px-6 text-base font-bold shadow-md rounded-xl flex items-center justify-center gap-2"
            >
              📷 MỞ CAMERA QUÉT MÃ BAO TẢI
            </Button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-blue-200/60 flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              size="large"
              prefix={<BarcodeOutlined className="text-blue-600 text-xl" />}
              placeholder="Hoặc nhập mã bao tải / mã seal (Vd: BAG261124xxxx hoặc SL12345)..."
              value={scanCode}
              onChange={e => setScanCode(e.target.value)}
              onPressEnter={() => handleScanTransit()}
              className="font-mono font-bold text-base uppercase h-11"
            />
          </div>
          <Button
            type="default"
            size="large"
            icon={<CarOutlined />}
            onClick={() => handleScanTransit()}
            loading={scanning}
            className="border-blue-500 text-blue-700 hover:bg-blue-50 font-bold h-11 px-5 w-full md:w-auto"
          >
            Quét nhận thủ công
          </Button>
        </div>
      </Card>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Bao tải chờ lấy hàng"
              value={waitingCount}
              valueStyle={{ color: '#d48806' }}
              suffix="bao"
              prefix={<InboxOutlined className="mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Đang trên xe trung chuyển"
              value={transitCount}
              valueStyle={{ color: '#1890ff' }}
              suffix="bao"
              prefix={<SyncOutlined spin className="mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} className="shadow-sm">
            <Statistic
              title="Đã bàn giao đến Hub"
              value={completedCount}
              valueStyle={{ color: '#52c41a' }}
              suffix="bao"
              prefix={<CheckCircleOutlined className="mr-2" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng danh sách nhiệm vụ */}
      <Card bordered={false} className="shadow-sm">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'ALL', label: `Tất cả (${tasks.length})` },
            { key: 'WAITING', label: `Chờ lấy hàng (${waitingCount})` },
            { key: 'TRANSIT', label: `Đang đi đường (${transitCount})` },
            { key: 'COMPLETED', label: `Đã giao Hub (${completedCount})` },
          ]}
        />

        <Table
          columns={columns}
          dataSource={filteredTasks}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          bordered
        />
      </Card>

      {/* Modal Chi tiết kiện hàng trong bao */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-gray-800">
            <InboxOutlined className="text-blue-600" />
            Chi Tiết Các Kiện Hàng Trong Bao [{selectedBag?.bagCode}]
          </div>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalOpen(false)}>
            Đóng
          </Button>
        ]}
        width={750}
      >
        {selectedBag && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-gray-500 block">Tuyến gửi:</span>
                <span className="font-bold text-gray-800 text-sm">
                  {selectedBag.originWarehouseName} ➔ {selectedBag.destWarehouseName}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Mã kẹp chì (Seal):</span>
                <span className="font-mono font-bold text-red-600 text-sm">
                  {selectedBag.sealNumber || 'Chưa kẹp chì'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Tổng số kiện hàng:</span>
                <span className="font-bold text-gray-800 text-sm">{selectedBag.totalItems} kiện</span>
              </div>
              <div>
                <span className="text-gray-500 block">Tổng khối lượng:</span>
                <span className="font-bold text-gray-800 text-sm">{Number(selectedBag.totalWeightKg).toFixed(2)} kg</span>
              </div>
            </div>

            <Table
              dataSource={selectedBag.items || []}
              rowKey="trackingCode"
              size="small"
              pagination={{ pageSize: 5 }}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 50,
                  align: 'center' as const,
                  render: (_: any, __: any, idx: number) => idx + 1
                },
                {
                  title: 'Mã Vận Đơn',
                  dataIndex: 'trackingCode',
                  key: 'trackingCode',
                  render: (c: string) => <span className="font-mono font-bold text-blue-700 text-xs">{c}</span>
                },
                {
                  title: 'Tên Hàng Hóa',
                  dataIndex: 'itemName',
                  key: 'itemName',
                  render: (n: string) => <span className="text-xs text-gray-800">{n || 'Kiện hàng'}</span>
                },
                {
                  title: 'Khối Lượng',
                  dataIndex: 'weightGram',
                  key: 'weightGram',
                  render: (w: number) => <span className="text-xs font-semibold">{w}g</span>
                },
                {
                  title: 'Địa Chỉ Nhận',
                  dataIndex: 'receiverAddress',
                  key: 'receiverAddress',
                  render: (addr: string) => <span className="text-xs text-gray-600">{addr || '—'}</span>
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ================= MODAL QUÉT MÃ BAO TẢI BẰNG CAMERA ĐIỆN THOẠI ================= */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2 text-base font-bold text-blue-900">
              <CameraOutlined className="text-blue-600 text-lg" />
              <span>Camera Quét Mã Bao Tải & Kẹp Chì</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="small"
                icon={isMuted ? <MutedOutlined /> : <SoundOutlined />}
                onClick={() => setIsMuted(!isMuted)}
                className="text-xs font-semibold"
              >
                {isMuted ? 'Bật âm' : 'Tắt âm'}
              </Button>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleSwitchCamera}
                className="text-xs font-semibold"
              >
                Đổi Cam
              </Button>
            </div>
          </div>
        }
        open={isCameraModalOpen}
        onCancel={handleCloseCameraModal}
        footer={[
          <Button key="close" type="primary" onClick={handleCloseCameraModal} className="bg-blue-600 font-bold px-6">
            Hoàn tất & Đóng Camera
          </Button>
        ]}
        width={580}
        destroyOnClose
      >
        <div className="space-y-4 pt-2">
          {/* Thông báo kết quả quét gần nhất */}
          {lastScannedFeedback && (
            <Alert
              message={
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {lastScannedFeedback.success ? '✅ ' : '⚠️ '}
                    {lastScannedFeedback.message}
                  </span>
                  <span className="text-xs text-gray-500">{lastScannedFeedback.time}</span>
                </div>
              }
              type={lastScannedFeedback.success ? 'success' : 'error'}
              showIcon
              className="animate-pulse shadow-sm"
            />
          )}

          {/* Vùng Camera ngắm quét */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-blue-400 bg-black shadow-lg">
            <div id="truck-camera-reader" className="w-full" style={{ minHeight: '280px' }} />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80 p-4 text-center">
                <SyncOutlined spin className="text-3xl text-blue-400 mb-2" />
                <p className="text-sm font-semibold mb-0">Đang khởi động camera điện thoại...</p>
                <p className="text-xs text-gray-400 mt-1">Vui lòng cấp quyền truy cập máy ảnh nếu trình duyệt yêu cầu.</p>
              </div>
            )}
            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Chế độ quét liên tục</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center italic mb-0">
            * Hướng camera vào mã vạch (Barcode 128) hoặc QR code trên bao tải/seal kẹp chì. Hệ thống sẽ tự động nhận diện và cập nhật ngay khi quét thành công.
          </p>

          {/* Thống kê phiên quét hiện tại */}
          <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-2">
              <span>Đã quét trong phiên làm việc này:</span>
              <Badge count={sessionScannedList.length} showZero color="#1677ff" />
            </div>

            {sessionScannedList.length > 0 ? (
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {sessionScannedList.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-blue-100">
                    <span className="font-mono font-bold text-blue-800">{item.code}</span>
                    <span className="text-gray-400 text-2xs">{item.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-xs text-gray-400 py-1">
                Chưa quét bao tải nào trong phiên này
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default TruckDriverPortalPage;
