import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Input,
  Button,
  Tag,
  Row,
  Col,
  Space,
  Table,
  Alert,
  Statistic,
  message,
  Typography
} from 'antd';
import {
  BarcodeOutlined,
  CompassOutlined,
  EnvironmentOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  ClearOutlined,
  SoundOutlined,
  AppstoreOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { wmsApi } from '../api/wms';
import { SmartSortingResponse } from '../types';

const { Title, Text } = Typography;

// Helper phát âm thanh beep khi quét thành công
const playSuccessBeep = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // ignore
  }
};

export const AreaSortingScannerPage: React.FC = () => {
  const [scanCode, setScanCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<SmartSortingResponse | null>(null);
  const [scanHistory, setScanHistory] = useState<SmartSortingResponse[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const inputRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  // Khởi tạo Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([21.0285, 105.8542], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const markerGroup = L.layerGroup().addTo(map);
      markerGroupRef.current = markerGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Cập nhật marker trên Map khi có kết quả phân loại mới
  useEffect(() => {
    if (!mapInstanceRef.current || !markerGroupRef.current || !currentResult) return;

    markerGroupRef.current.clearLayers();

    const destLat = currentResult.destinationPostOfficeLat || 21.0285;
    const destLng = currentResult.destinationPostOfficeLng || 105.8542;
    const recLat = currentResult.receiverLat || destLat;
    const recLng = currentResult.receiverLng || destLng;

    // Custom icon Bưu cục điểm cuối
    const postOfficeIcon = L.divIcon({
      className: 'custom-hub-marker',
      html: `<div style="background-color: #2563eb; color: white; padding: 6px 10px; border-radius: 8px; font-weight: bold; font-size: 11px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); border: 2px solid white; white-space: nowrap;">🏢 ${currentResult.destinationPostOfficeName || 'Bưu cục phát'}</div>`,
      iconSize: [120, 30],
      iconAnchor: [60, 15]
    });

    const marker = L.marker([destLat, destLng], { icon: postOfficeIcon });
    marker.bindPopup(`
      <div style="font-size: 12px; font-family: sans-serif;">
        <strong style="color: #2563eb;">${currentResult.destinationPostOfficeName}</strong><br/>
        Mã: <code>${currentResult.destinationPostOfficeCode}</code><br/>
        Địa chỉ: ${currentResult.destinationPostOfficeAddress || 'N/A'}<br/>
        <b>Lồng gom hàng:</b> <span style="color: #d97706; font-weight: bold;">${currentResult.suggestedBinCode}</span>
      </div>
    `).openPopup();

    markerGroupRef.current.addLayer(marker);

    // Marker địa chỉ người nhận nếu khác vị trí bưu cục
    if (Math.abs(destLat - recLat) > 0.001 || Math.abs(destLng - recLng) > 0.001) {
      const receiverIcon = L.divIcon({
        className: 'custom-rec-marker',
        html: `<div style="background-color: #dc2626; color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid white;">📍 Khách nhận</div>`,
        iconSize: [80, 25],
        iconAnchor: [40, 12]
      });
      const recMarker = L.marker([recLat, recLng], { icon: receiverIcon });
      recMarker.bindPopup(`<b>Người nhận:</b> ${currentResult.receiverName}<br/>${currentResult.receiverAddress}`);
      markerGroupRef.current.addLayer(recMarker);

      // Vẽ đường nối từ bưu cục đến nhà khách
      const polyline = L.polyline([[destLat, destLng], [recLat, recLng]], {
        color: '#dc2626',
        weight: 3,
        dashArray: '6, 8'
      });
      markerGroupRef.current.addLayer(polyline);

      mapInstanceRef.current.fitBounds([[destLat, destLng], [recLat, recLng]], { padding: [50, 50] });
    } else {
      mapInstanceRef.current.setView([destLat, destLng], 14);
    }
  }, [currentResult]);

  const handleScan = async (codeToClassify?: string) => {
    const code = (codeToClassify || scanCode).trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng quét hoặc nhập mã vận đơn!');
      return;
    }

    setLoading(true);
    try {
      const res = await wmsApi.classifyOrderForSorting(code);
      setCurrentResult(res);
      setScanHistory(prev => [res, ...prev.filter(i => i.trackingCode !== res.trackingCode)].slice(0, 20));
      if (soundEnabled) {
        playSuccessBeep();
      }
      setScanCode('');
      message.success(`Phân loại thành công -> ${res.destinationPostOfficeName}`);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không tìm thấy thông tin đơn hàng này');
    } finally {
      setLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleClearHistory = () => {
    setScanHistory([]);
    setCurrentResult(null);
  };

  const historyColumns = [
    {
      title: 'Mã Vận Đơn',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      render: (c: string) => <span className="font-mono font-bold text-blue-700">{c}</span>
    },
    {
      title: 'Tỉnh / Thành Nhận',
      dataIndex: 'receiverProvinceName',
      key: 'receiverProvinceName',
      render: (p: string) => <Tag color="blue" className="font-semibold">{p || 'Hà Nội'}</Tag>
    },
    {
      title: 'Bưu Cục Điểm Cuối Phát Hàng',
      dataIndex: 'destinationPostOfficeName',
      key: 'destinationPostOfficeName',
      render: (po: string) => (
        <span className="font-bold text-red-600 flex items-center gap-1">
          <EnvironmentOutlined /> {po}
        </span>
      )
    },
    {
      title: 'Lồng / Bao Tải Đích',
      dataIndex: 'suggestedBinCode',
      key: 'suggestedBinCode',
      render: (bin: string) => <Tag color="gold" className="font-bold font-mono">{bin}</Tag>
    },
    {
      title: 'Khối lượng',
      dataIndex: 'actualWeightGram',
      key: 'actualWeightGram',
      render: (w: number) => <span className="text-gray-600 text-xs">{w}g</span>
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <AppstoreOutlined style={{ fontSize: 28 }} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-gray-800 flex items-center gap-2">
              Quét Mã Phân Loại Đơn Khu Vực (WMS Smart Sorting)
            </Title>
            <Text type="secondary" className="text-sm">
              Quét mã vạch đơn hàng để hiển thị Tỉnh/Thành và Kho Bưu cục điểm cuối phát hàng trực quan trên bản đồ
            </Text>
          </div>
        </div>

        <Space>
          <Button
            icon={<SoundOutlined />}
            type={soundEnabled ? 'primary' : 'default'}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            Âm thanh quét: {soundEnabled ? 'BẬT' : 'TẮT'}
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleClearHistory}>
            Xóa lịch sử
          </Button>
        </Space>
      </div>

      {/* Ô quét mã lớn */}
      <Card className="shadow-sm border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
              Quét Barcode / QR Code hoặc Nhập Mã Vận Đơn (VD: RKP2611...)
            </label>
            <Input
              ref={inputRef}
              size="large"
              prefix={<BarcodeOutlined className="text-blue-600 text-2xl mr-1" />}
              placeholder="Quét mã vạch kiện hàng hoặc nhập mã vận đơn..."
              value={scanCode}
              onChange={e => setScanCode(e.target.value)}
              onPressEnter={() => handleScan()}
              className="font-mono font-bold text-xl uppercase h-14"
              autoFocus
            />
          </div>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltOutlined />}
            onClick={() => handleScan()}
            loading={loading}
            className="bg-blue-600 hover:bg-blue-700 h-14 px-8 text-lg font-bold w-full md:w-auto"
          >
            Phân Loại Ngay
          </Button>
        </div>
      </Card>

      {/* Kết quả phân loại hiển thị lớn (Visual Sorting Card) */}
      {currentResult && (
        <Card className="shadow-md border-2 border-green-400 bg-white">
          <Row gutter={[24, 24]}>
            {/* Cột trái: Thông tin bưu cục đích cực lớn */}
            <Col xs={24} lg={12} className="space-y-4 border-b lg:border-b-0 lg:border-r border-gray-200 pb-4 lg:pb-0">
              <div className="flex items-center justify-between">
                <Tag color="cyan" className="text-sm font-bold px-3 py-1">
                  ĐƠN HÀNG: {currentResult.trackingCode}
                </Tag>
                <Tag color="magenta" className="text-xs font-bold">
                  Tuyến: {currentResult.routingCode || 'RKP-01'}
                </Tag>
              </div>

              {/* Box chỉ định phân loại vào đâu */}
              <div className="p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl text-center">
                <div className="text-xs uppercase font-extrabold text-yellow-800 tracking-wider">
                  👉 CHỈ ĐỊNH PHÂN LOẠI VÀO:
                </div>
                <div className="text-2xl font-black text-yellow-900 font-mono mt-1 tracking-wider">
                  {currentResult.suggestedBinCode}
                </div>
                <div className="text-xs text-yellow-700 font-medium mt-1">
                  {currentResult.suggestedAction}
                </div>
              </div>

              {/* Thông tin Bưu cục điểm cuối */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 space-y-2">
                <div className="text-xs text-blue-600 font-bold uppercase tracking-wider">
                  BƯU CỤC ĐIỂM CUỐI GIAO ĐƠN (LAST-MILE SPOKE):
                </div>
                <div className="text-xl font-extrabold text-blue-900 flex items-center gap-2">
                  <EnvironmentOutlined className="text-red-500" />
                  {currentResult.destinationPostOfficeName}
                </div>
                <div className="text-xs text-gray-700 font-medium">
                  Địa chỉ bưu cục: {currentResult.destinationPostOfficeAddress}
                </div>
                <div className="text-xs text-gray-500">
                  Mã bưu cục: <Tag color="blue">{currentResult.destinationPostOfficeCode}</Tag> | Khu vực: <Tag color="green">{currentResult.sortingZone}</Tag>
                </div>
              </div>

              {/* Thông tin người nhận */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg">
                <div>
                  <span className="text-gray-500 block">Khách hàng nhận:</span>
                  <span className="font-bold text-gray-800 text-sm">{currentResult.receiverName}</span>
                  <div className="text-gray-600">{currentResult.receiverPhone}</div>
                </div>
                <div>
                  <span className="text-gray-500 block">Tỉnh / Thành phố:</span>
                  <span className="font-extrabold text-blue-700 text-sm">{currentResult.receiverProvinceName || 'Hà Nội'}</span>
                  <div className="text-gray-600">{currentResult.receiverWardName || ''}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 block">Địa chỉ nhận chi tiết:</span>
                  <span className="font-semibold text-gray-800">{currentResult.receiverAddress}</span>
                </div>
              </div>
            </Col>

            {/* Cột phải: Bản đồ trực quan vị trí bưu cục điểm cuối */}
            <Col xs={24} lg={12} className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-gray-700 text-sm flex items-center gap-1">
                  <CompassOutlined className="text-blue-600" /> Bản đồ vị trí Bưu cục & Tuyến phát
                </span>
                <span className="text-xs text-gray-500">
                  Tọa độ: {currentResult.destinationPostOfficeLat?.toFixed(4)}, {currentResult.destinationPostOfficeLng?.toFixed(4)}
                </span>
              </div>
              <div
                ref={mapContainerRef}
                className="w-full h-80 rounded-xl border border-gray-200 overflow-hidden shadow-inner flex-1"
                style={{ minHeight: '300px' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Lịch sử các đơn đã phân loại trong phiên */}
      <Card title="Lịch Sử Các Đơn Hàng Vừa Phân Loại Trong Phiên" bordered={false} className="shadow-sm">
        <Table
          columns={historyColumns}
          dataSource={scanHistory}
          rowKey="trackingCode"
          pagination={{ pageSize: 6 }}
          size="small"
          locale={{ emptyText: 'Chưa quét đơn hàng nào. Hãy quét mã đơn để bắt đầu phân loại!' }}
        />
      </Card>
    </div>
  );
};
export default AreaSortingScannerPage;
