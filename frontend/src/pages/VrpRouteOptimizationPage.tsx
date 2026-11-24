import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Tag,
  Statistic,
  Table,
  Space,
  Typography,
  message,
  Timeline,
  Divider,
  Alert,
} from 'antd';
import {
  Navigation,
  Sparkles,
  MapPin,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  Truck,
  RotateCw,
  Send,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { aiApi } from '../api/ai';
import { staffApi } from '../api/staff';
import { StaffUser, VrpOptimizeResult, VrpStop } from '../types';

const { Title, Text } = Typography;

export const VrpRouteOptimizationPage: React.FC = () => {
  const [shippers, setShippers] = useState<StaffUser[]>([]);
  const [selectedShipperId, setSelectedShipperId] = useState<number | undefined>(undefined);
  const [loadingShippers, setLoadingShippers] = useState(false);

  const [optimizing, setOptimizing] = useState(false);
  const [vrpResult, setVrpResult] = useState<VrpOptimizeResult | null>(null);
  const [applying, setApplying] = useState(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  // Load shippers
  useEffect(() => {
    const loadShippers = async () => {
      try {
        setLoadingShippers(true);
        const data = await staffApi.getStaffList('ROLE_SHIPPER');
        setShippers(data);
        if (data.length > 0) {
          setSelectedShipperId(data[0].id);
        }
      } catch (err: any) {
        console.error('Lỗi tải danh sách shipper:', err);
      } finally {
        setLoadingShippers(false);
      }
    };
    loadShippers();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current).setView([21.0285, 105.8542], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Run VRP Algorithm
  const handleRunOptimization = async (applySequence: boolean = false) => {
    if (!selectedShipperId) {
      message.warning('Vui lòng chọn bưu tá phụ trách tuyến phát!');
      return;
    }

    try {
      if (applySequence) setApplying(true);
      else setOptimizing(true);

      const res = await aiApi.optimizeRoute({
        shipperId: selectedShipperId,
        startLat: 21.0285,
        startLng: 105.8542,
        applyToShipper: applySequence,
      });

      const result = res.data.data;
      setVrpResult(result);

      if (applySequence) {
        message.success('Đã áp dụng thứ tự giao hàng tối ưu thành công vào App của Bưu tá!');
      } else {
        message.success(`Tối ưu thành công: Tiết kiệm ${result.savingsPercent}% quãng đường di chuyển!`);
      }

      // Render on Map
      renderMapRoute(result.stops);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể chạy thuật toán tối ưu VRP');
    } finally {
      setOptimizing(false);
      setApplying(false);
    }
  };

  // Render Markers and Polyline on Leaflet Map
  const renderMapRoute = (stops: VrpStop[]) => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    if (polylineRef.current) {
      polylineRef.current.remove();
    }

    if (stops.length === 0) return;

    const latLngs: [number, number][] = [];

    // Starting Hub Marker
    const startPoint: [number, number] = [21.0285, 105.8542];
    latLngs.push(startPoint);

    const startIcon = L.divIcon({
      className: 'custom-hub-icon',
      html: `<div style="background-color: #dc2626; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 14px;">🏢</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(startPoint, { icon: startIcon })
      .bindPopup('<b>Bưu cục Khởi hành Rikkei_Post</b><br/>Điểm xuất phát giao hàng')
      .addTo(markersLayerRef.current);

    // Numbered Stop Markers
    stops.forEach((stop) => {
      const point: [number, number] = [stop.lat, stop.lng];
      latLngs.push(point);

      const stopIcon = L.divIcon({
        className: 'custom-stop-icon',
        html: `<div style="background-color: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 13px;">${stop.stopNumber}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker(point, { icon: stopIcon })
        .bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px;">
            <b style="color: #2563eb;">Điểm dừng #${stop.stopNumber}</b><br/>
            <b>Mã vận đơn:</b> ${stop.trackingCode}<br/>
            <b>Người nhận:</b> ${stop.receiverName} (${stop.receiverPhone})<br/>
            <b>Địa chỉ:</b> ${stop.receiverAddress}<br/>
            <b>Tiền COD:</b> ${Number(stop.codAmount).toLocaleString('vi-VN')} đ<br/>
            <b>Khoảng cách:</b> +${stop.distanceFromPrevKm} km
          </div>
        `)
        .addTo(markersLayerRef.current!);
    });

    // Draw Polyline connecting stops
    polylineRef.current = L.polyline(latLngs, {
      color: '#dc2626',
      weight: 4,
      opacity: 0.85,
      dashArray: '6, 8',
    }).addTo(mapInstanceRef.current);

    // Fit map bounds
    const bounds = L.latLngBounds(latLngs);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={2} className="!mb-1 flex items-center gap-2">
            <Navigation className="text-red-600" size={28} />
            Thuật toán VRP Phân cụm & Tối ưu Tuyến đường Phát hàng
          </Title>
          <Text type="secondary">
            Ứng dụng thuật toán Nearest Neighbor Heuristic + 2-Opt Local Search giải bài toán Người giao hàng (TSP/VRP), giúp giảm 20-30% quãng đường di chuyển và thời gian phát hàng.
          </Text>
        </div>

        <Space wrap>
          <Select
            placeholder="Chọn Bưu tá cần tối ưu"
            className="w-64"
            value={selectedShipperId}
            onChange={(val) => setSelectedShipperId(val)}
            loading={loadingShippers}
          >
            {shippers.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                🚴 {s.fullName} ({s.phoneNumber})
              </Select.Option>
            ))}
          </Select>

          <Button
            type="primary"
            className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            icon={<Sparkles size={16} />}
            loading={optimizing}
            onClick={() => handleRunOptimization(false)}
          >
            Chạy Tối ưu AI VRP
          </Button>

          {vrpResult && vrpResult.stops.length > 0 && (
            <Button
              type="primary"
              className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              icon={<Send size={16} />}
              loading={applying}
              onClick={() => handleRunOptimization(true)}
            >
              Áp dụng thứ tự cho Bưu tá
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Comparison Result */}
      {vrpResult && (
        <Card className="shadow-sm border-t-4 border-t-green-600 rounded-xl bg-gradient-to-r from-green-50/50 via-white to-blue-50/50">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={<span className="text-gray-500 font-medium">Tổng số điểm giao (Stops)</span>}
                value={vrpResult.totalStops}
                suffix="đơn hàng"
                valueStyle={{ color: '#1f2937', fontWeight: 'bold' }}
              />
              <div className="text-xs text-gray-400 mt-1">Đã phân cụm bưu phẩm</div>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={<span className="text-gray-500 font-medium">Quãng đường ban đầu</span>}
                value={vrpResult.originalDistanceKm}
                suffix="km"
                valueStyle={{ color: '#ef4444', textDecoration: 'line-through' }}
              />
              <div className="text-xs text-red-500 mt-1">Thứ tự phát ngẫu nhiên</div>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={<span className="text-green-700 font-medium flex items-center gap-1"><TrendingDown size={16} /> Quãng đường sau tối ưu</span>}
                value={vrpResult.totalDistanceKm}
                suffix="km"
                valueStyle={{ color: '#16a34a', fontWeight: 'bold' }}
              />
              <div className="text-xs text-green-600 font-semibold mt-1">
                Tiết kiệm: -{vrpResult.distanceSavedKm} km ({vrpResult.savingsPercent}%)
              </div>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Statistic
                title={<span className="text-blue-700 font-medium flex items-center gap-1"><Clock size={16} /> Ước tính thời gian phát</span>}
                value={Math.round(vrpResult.totalEstimatedMinutes / 60 * 10) / 10}
                suffix="giờ"
                valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
              />
              <div className="text-xs text-blue-600 mt-1">~{vrpResult.totalEstimatedMinutes} phút (Gồm 6p/điểm dừng)</div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Content: Map + Itinerary */}
      <Row gutter={[16, 16]}>
        {/* Left: Map */}
        <Col xs={24} lg={14}>
          <Card
            className="shadow-sm rounded-xl h-full flex flex-col"
            title={
              <span className="flex items-center gap-2 text-base font-semibold">
                <MapPin size={18} className="text-red-600" /> Bản đồ Tuyến đường Giao hàng VRP
              </span>
            }
          >
            <div
              ref={mapContainerRef}
              className="w-full rounded-lg border border-gray-200"
              style={{ minHeight: '520px', height: '100%' }}
            />
          </Card>
        </Col>

        {/* Right: Step-by-step Itinerary */}
        <Col xs={24} lg={10}>
          <Card
            className="shadow-sm rounded-xl h-full"
            title={
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-base font-semibold">
                  <Clock size={18} className="text-blue-600" /> Thứ tự Giao hàng Tối ưu ({vrpResult?.stops.length || 0})
                </span>
                {vrpResult && (
                  <Tag color="green" className="text-xs">
                    {vrpResult.algorithmUsed}
                  </Tag>
                )}
              </div>
            }
          >
            {vrpResult && vrpResult.stops.length > 0 ? (
              <div className="overflow-y-auto max-h-[520px] pr-2 space-y-3">
                {vrpResult.stops.map((stop) => (
                  <div
                    key={stop.stopNumber}
                    className="p-3 rounded-lg border border-gray-200 hover:border-blue-400 bg-white shadow-xs transition-all flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {stop.stopNumber}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-blue-700 text-xs">{stop.trackingCode}</span>
                        <Tag color="gold" className="text-2xs m-0">
                          +{stop.distanceFromPrevKm} km
                        </Tag>
                      </div>

                      <div className="font-semibold text-gray-800 text-xs mt-0.5 truncate">
                        {stop.receiverName} - {stop.receiverPhone}
                      </div>

                      <div className="text-2xs text-gray-500 mt-0.5 line-clamp-2">
                        📍 {stop.receiverAddress}
                      </div>

                      <div className="flex items-center justify-between text-2xs text-gray-500 mt-1 pt-1 border-t border-gray-100">
                        <span>COD: <b className="text-red-600">{Number(stop.codAmount).toLocaleString('vi-VN')} đ</b></span>
                        <span>Đến sau: ~{stop.estimatedTravelMinutes} phút</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-gray-400">
                <Navigation size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm">Chưa có kết quả tối ưu tuyến.</p>
                <p className="text-xs">Vui lòng chọn bưu tá và nhấn <b>Chạy Tối ưu AI VRP</b>.</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default VrpRouteOptimizationPage;
