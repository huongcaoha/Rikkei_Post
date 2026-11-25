import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Space,
  Select,
  Switch,
  Typography,
  Drawer,
  Badge,
  Tooltip,
  Divider,
  message,
  Radio,
} from 'antd';
import {
  Building2,
  Navigation,
  Truck,
  Layers,
  MapPin,
  RefreshCw,
  Compass,
  ArrowRight,
  Maximize2,
  ExternalLink,
  ShieldCheck,
  Send,
  Boxes,
  Activity,
  ZoomIn,
  ZoomOut,
  Map as MapIcon,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { networkApi } from '../api/network';
import { useAuth } from '../context/AuthContext';
import {
  NetworkTopologyResponse,
  NetworkTopologyNode,
  NetworkTopologyLink,
  NetworkActiveTruck,
} from '../types';

const { Title, Text, Paragraph } = Typography;

// Bounding box chuẩn dải đất hình chữ S của Việt Nam (Mũi Cà Mau -> Lũng Cú Hà Giang)
const VIETNAM_BOUNDS: L.LatLngBoundsLiteral = [
  [8.18, 102.14], // Cực Nam (Cà Mau / Kiên Giang)
  [23.39, 109.46], // Cực Bắc (Hà Giang / Lũng Cú)
];

export const NetworkTopologyMapPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [topologyData, setTopologyData] = useState<NetworkTopologyResponse | null>(null);

  // Filters & Controls
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [showLinks, setShowLinks] = useState<boolean>(true);
  const [showTrucks, setShowTrucks] = useState<boolean>(true);
  const [mapTileStyle, setMapTileStyle] = useState<'osm' | 'google_road' | 'google_hybrid'>('osm');
  const [currentZoom, setCurrentZoom] = useState<number>(6);

  // Selected Node Drawer
  const [selectedNode, setSelectedNode] = useState<NetworkTopologyNode | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Leaflet refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const nodeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const linkLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const truckLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Load Topology Data
  const fetchTopology = async () => {
    try {
      setLoading(true);
      const res = await networkApi.getNetworkTopology();
      if (res.success) {
        setTopologyData(res.data);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải dữ liệu bản đồ mạng lưới kho');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopology();
  }, []);

  // Khởi tạo Leaflet Map và TileLayer chuẩn
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [16.047079, 108.20623], // Tâm Việt Nam (Đà Nẵng)
        zoom: 6,
        minZoom: 5,
        maxZoom: 18,
        zoomControl: true,
      });

      // Lắng nghe sự kiện zoom để tự động điều chỉnh hiển thị nhãn (LOD - Level of Detail)
      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      // Tạo layer groups
      linkLayerGroupRef.current = L.layerGroup().addTo(map);
      nodeLayerGroupRef.current = L.layerGroup().addTo(map);
      truckLayerGroupRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Fit bounds toàn cảnh dải đất hình chữ S Việt Nam ngay khi map sẵn sàng
      setTimeout(() => {
        map.fitBounds(VIETNAM_BOUNDS, { padding: [30, 30] });
      }, 100);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
      }
    };
  }, []);

  // Cập nhật Bản đồ nền (TileLayer) khi người dùng thay đổi loại bản đồ
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Xóa layer tile cũ nếu có
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let newTileLayer: L.TileLayer;

    if (mapTileStyle === 'google_road') {
      // Google Maps đường phố tiếng Việt, tải nhanh, không watermark
      newTileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        attribution: '&copy; Google Maps',
        maxZoom: 19,
      });
    } else if (mapTileStyle === 'google_hybrid') {
      // Google Maps ảnh vệ tinh kết hợp đường sá
      newTileLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: '0123',
        attribution: '&copy; Google Maps Satellite',
        maxZoom: 19,
      });
    } else {
      // Mặc định: OpenStreetMap chuẩn quốc tế, hoàn toàn miễn phí, không watermark API key
      newTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      });
    }

    newTileLayer.addTo(map);
    tileLayerRef.current = newTileLayer;
  }, [mapTileStyle]);

  // Vẽ các Nodes, Links, Trucks lên Map mỗi khi dữ liệu hoặc bộ lọc thay đổi
  useEffect(() => {
    if (!mapInstanceRef.current || !topologyData) return;

    const map = mapInstanceRef.current;
    nodeLayerGroupRef.current?.clearLayers();
    linkLayerGroupRef.current?.clearLayers();
    truckLayerGroupRef.current?.clearLayers();

    // Lọc Nodes theo type và vùng miền
    let filteredNodes = topologyData.nodes;
    if (typeFilter !== 'ALL') {
      filteredNodes = filteredNodes.filter((n) => n.type === typeFilter);
    }

    if (regionFilter === 'NORTH') {
      filteredNodes = filteredNodes.filter((n) => n.latitude >= 19.5); // Miền Bắc
    } else if (regionFilter === 'CENTRAL') {
      filteredNodes = filteredNodes.filter((n) => n.latitude >= 13.0 && n.latitude < 19.5); // Miền Trung
    } else if (regionFilter === 'SOUTH') {
      filteredNodes = filteredNodes.filter((n) => n.latitude < 13.0); // Miền Nam
    }

    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));

    // 1. Vẽ các đường nối mạng lưới (Topology Links)
    if (showLinks) {
      topologyData.links.forEach((link) => {
        // Chỉ vẽ link nếu ít nhất 1 đầu mút nằm trong danh sách hiển thị
        if (!visibleNodeIds.has(link.fromWarehouseId) && !visibleNodeIds.has(link.toWarehouseId)) {
          return;
        }

        // Tuyến Spoke chỉ hiện khi zoom >= 8 để giữ tầm nhìn toàn cảnh thoáng đãng
        if (link.linkType === 'LAST_MILE_SPOKE' && currentZoom < 8) {
          return;
        }

        let strokeColor = '#3b82f6'; // Mặc định xanh dương cho spoke
        let weight = 2;
        let dashArray: string | undefined = '4, 6';
        let opacity = 0.65;

        if (link.linkType === 'REGIONAL_BACKBONE') {
          strokeColor = '#7c3aed'; // Tím đậm phát sáng cho tuyến trục liên miền Bắc - Trung - Nam
          weight = 4;
          dashArray = undefined;
          opacity = 0.9;
        } else if (link.linkType === 'FEEDER_HUB') {
          strokeColor = '#ea580c'; // Cam rực rỡ cho tuyến nối Hub tỉnh
          weight = 3;
          dashArray = '6, 6';
          opacity = 0.8;
        }

        const polyline = L.polyline(
          [
            [link.fromLat, link.fromLng],
            [link.toLat, link.toLng],
          ],
          {
            color: strokeColor,
            weight: weight,
            dashArray: dashArray,
            opacity: opacity,
          }
        );

        polyline.bindTooltip(
          `
          <div style="font-family: sans-serif; font-size: 11px; padding: 2px;">
            <b style="color: ${strokeColor}; font-size: 12px;">${link.linkDescription}</b><br/>
            Khoảng cách liên kết: <b>${link.distanceKm} km</b><br/>
            ${
              link.activeTransitsCount > 0
                ? `<span style="color: #ea580c; font-weight: bold;">🚛 ${link.activeTransitsCount} chuyến xe đang vận chuyển</span>`
                : '<span style="color: #10b981;">Tuyến đường thông suốt</span>'
            }
          </div>
        `,
          { sticky: true }
        );

        linkLayerGroupRef.current?.addLayer(polyline);
      });
    }

    // 2. Vẽ các Nodes Kho bưu cục (Chống chồng chéo chữ theo Level of Detail - LOD)
    filteredNodes.forEach((node) => {
      let iconHtml = '';
      let markerClass = '';
      const isDetailedZoom = currentZoom >= 10;

      if (node.type === 'REGIONAL_HUB') {
        // Kho vùng miền (Mega Hub): Biểu tượng tím lớn có hiệu ứng radar neon
        iconHtml = `
          <div style="
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            color: white;
            width: 42px;
            height: 42px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 0 16px rgba(124, 58, 237, 0.75), 0 4px 6px rgba(0,0,0,0.3);
            border: 3px solid #ffffff;
            cursor: pointer;
            transition: transform 0.2s;
          ">
            🌐
          </div>
          <div style="
            background-color: rgba(30, 27, 75, 0.9);
            color: #ffffff;
            padding: 2px 8px;
            border-radius: 6px;
            font-weight: 800;
            font-size: 10px;
            white-space: nowrap;
            margin-top: 4px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.4);
            text-align: center;
          ">
            ${node.name}
          </div>
        `;
        markerClass = 'marker-regional-hub';
      } else if (node.type === 'HUB') {
        // Hub tỉnh: Biểu tượng cam nổi bật
        iconHtml = `
          <div style="
            background: linear-gradient(135deg, #ea580c, #f97316);
            color: white;
            width: 34px;
            height: 34px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 4px 8px rgba(234, 88, 12, 0.55);
            border: 2.5px solid #ffffff;
            cursor: pointer;
          ">
            🏢
          </div>
          <div style="
            background-color: rgba(124, 45, 18, 0.9);
            color: #ffffff;
            padding: 2px 6px;
            border-radius: 6px;
            font-weight: 700;
            font-size: 10px;
            white-space: nowrap;
            margin-top: 3px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-align: center;
          ">
            ${node.name}
          </div>
        `;
        markerClass = 'marker-provincial-hub';
      } else {
        // Spoke bưu cục: Gọn gàng và tinh tế
        // Ở chế độ toàn cảnh (currentZoom < 10): Chỉ hiển thị icon tròn, KHÔNG đè nhãn chữ tránh nghẽn bản đồ
        // Ở chế độ xem chi tiết (currentZoom >= 10): Tự động hiển thị tên bưu cục
        iconHtml = `
          <div style="
            background: linear-gradient(135deg, #2563eb, #3b82f6);
            color: white;
            width: 26px;
            height: 26px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.45);
            border: 2px solid #ffffff;
            cursor: pointer;
          ">
            🛵
          </div>
          ${
            isDetailedZoom
              ? `
            <div style="
              background-color: rgba(30, 58, 138, 0.88);
              color: #ffffff;
              padding: 1px 6px;
              border-radius: 4px;
              font-weight: 600;
              font-size: 9px;
              white-space: nowrap;
              margin-top: 2px;
              text-align: center;
              box-shadow: 0 1px 3px rgba(0,0,0,0.25);
            ">
              ${node.name}
            </div>
          `
              : ''
          }
        `;
        markerClass = 'marker-spoke';
      }

      const customIcon = L.divIcon({
        className: `custom-topology-node ${markerClass}`,
        html: `<div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -50%);">${iconHtml}</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([node.latitude, node.longitude], { icon: customIcon });

      // Click vào marker để mở Drawer chi tiết kho và điều phối
      marker.on('click', () => {
        setSelectedNode(node);
        setIsDrawerOpen(true);
      });

      // Hover tooltip thông tin chi tiết đầy đủ
      marker.bindTooltip(
        `
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; padding: 2px;">
          <b style="color: ${
            node.type === 'REGIONAL_HUB'
              ? '#7c3aed'
              : node.type === 'HUB'
              ? '#ea580c'
              : '#2563eb'
          }; font-size: 13px;">
            ${node.name}
          </b><br/>
          <span style="font-size: 11px; color: #6b7280;">Mã: <b>${node.code}</b> | ${node.typeDescription}</span><br/>
          📍 <span>${node.address || node.provinceName}</span><br/>
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e5e7eb;">
            📦 <b>${node.pendingBagsCount}</b> bao tải chờ gom<br/>
            🚛 <b>${node.availableTrucksCount}</b> xe tải sẵn sàng<br/>
            🚚 <b>${node.incomingDispatchesCount}</b> chuyến xe đang tới
          </div>
          <div style="margin-top: 3px; font-size: 10px; color: #9ca3af; font-style: italic;">
            (Nhấp chuột để mở điều phối xe & đóng bao tải)
          </div>
        </div>
      `,
        { offset: [0, -12], direction: 'top' }
      );

      nodeLayerGroupRef.current?.addLayer(marker);
    });

    // 3. Vẽ Marker Xe tải nếu bật
    if (showTrucks) {
      topologyData.activeTrucks.forEach((t) => {
        if (!t.latitude || !t.longitude) return;

        const isMoving = t.status === 'IN_TRANSIT';
        const truckIcon = L.divIcon({
          className: 'truck-marker',
          html: `
            <div style="
              background-color: ${isMoving ? '#f59e0b' : '#10b981'};
              color: white;
              padding: 2px 6px;
              border-radius: 6px;
              font-size: 10px;
              font-weight: bold;
              display: flex;
              align-items: center;
              gap: 3px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              border: 1.5px solid white;
              white-space: nowrap;
              transform: translate(-50%, -50%);
            ">
              🚛 ${t.licensePlate}
            </div>
          `,
          iconSize: [60, 20],
          iconAnchor: [30, 10],
        });

        const truckMarker = L.marker([t.latitude + 0.002, t.longitude + 0.002], { icon: truckIcon });
        truckMarker.bindTooltip(`
          <div style="font-family: sans-serif; font-size: 11px;">
            <b>Xe tải: ${t.licensePlate}</b><br/>
            Loại: ${t.truckType} (${t.payloadKg}kg)<br/>
            Tài xế: <b>${t.driverName}</b> (${t.driverPhone || 'N/A'})<br/>
            Trạng thái: <b style="color: ${isMoving ? '#f59e0b' : '#10b981'};">${
          isMoving ? 'Đang đi trung chuyển' : 'Đang đỗ tại bãi kho'
        }</b><br/>
            Vị trí: ${t.currentWarehouseName}
          </div>
        `);

        truckLayerGroupRef.current?.addLayer(truckMarker);
      });
    }
  }, [topologyData, typeFilter, regionFilter, showLinks, showTrucks, currentZoom]);

  // Điều hướng nhanh góc nhìn bản đồ
  const handleFitVietnam = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(VIETNAM_BOUNDS, { padding: [25, 25] });
    }
  };

  const handleFocusRegion = (region: 'NORTH' | 'CENTRAL' | 'SOUTH' | 'MEKONG') => {
    if (!mapInstanceRef.current) return;
    if (region === 'NORTH') {
      mapInstanceRef.current.flyTo([21.0285, 105.8542], 10, { duration: 1 });
    } else if (region === 'CENTRAL') {
      mapInstanceRef.current.flyTo([16.0544, 108.2022], 10, { duration: 1 });
    } else if (region === 'SOUTH') {
      mapInstanceRef.current.flyTo([10.7769, 106.7009], 10, { duration: 1 });
    } else if (region === 'MEKONG') {
      mapInstanceRef.current.flyTo([10.034, 105.783], 10, { duration: 1 });
    }
  };

  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + delta);
    }
  };

  // Điều hướng nhanh đến trang điều vận với kho được chọn
  const handleDirectDispatch = (node: NetworkTopologyNode) => {
    navigate('/wms/dispatch', { state: { originWarehouseId: node.id } });
  };

  // Điều hướng nhanh đến trang đóng bao tải
  const handleDirectBagCreation = (node: NetworkTopologyNode) => {
    navigate('/wms/bags', { state: { destWarehouseId: node.id } });
  };

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Compass size={28} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-gray-800 flex items-center gap-2">
              Bản Đồ Mạng Lưới Kho Vận & Topology Điều Phối (Logistics Network Map)
            </Title>
            <Text type="secondary" className="text-xs">
              Mô hình hóa mạng lưới phân bổ kho vùng miền, Hub tỉnh và bưu cục điểm cuối trên dải đất hình chữ S Việt Nam
            </Text>
          </div>
        </div>

        <Space wrap>
          <Button icon={<RefreshCw size={15} />} onClick={fetchTopology} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Maximize2 size={15} />}
            className="bg-indigo-600 hover:bg-indigo-700 font-semibold"
            onClick={handleFitVietnam}
          >
            🇻🇳 Toàn cảnh Việt Nam (Hình chữ S)
          </Button>
        </Space>
      </div>

      {/* KPI Stats Mạng Lưới */}
      {topologyData && (
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={4}>
            <Card className="rounded-xl border-purple-100 bg-purple-50/50 p-2 border shadow-xs">
              <div className="text-purple-700 text-xs font-semibold uppercase flex items-center gap-1">
                🌐 Kho vùng miền
              </div>
              <div className="text-2xl font-black text-purple-800 mt-1">{topologyData.totalRegionalHubs}</div>
              <div className="text-[11px] text-purple-600">Tổng kho Mega Hub liên miền</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card className="rounded-xl border-orange-100 bg-orange-50/50 p-2 border shadow-xs">
              <div className="text-orange-700 text-xs font-semibold uppercase flex items-center gap-1">
                🏢 Hub trung chuyển tỉnh
              </div>
              <div className="text-2xl font-black text-orange-800 mt-1">{topologyData.totalHubs}</div>
              <div className="text-[11px] text-orange-600">Trung tâm khai thác tỉnh</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card className="rounded-xl border-blue-100 bg-blue-50/50 p-2 border shadow-xs">
              <div className="text-blue-700 text-xs font-semibold uppercase flex items-center gap-1">
                🛵 Bưu cục điểm cuối
              </div>
              <div className="text-2xl font-black text-blue-800 mt-1">{topologyData.totalSpokes}</div>
              <div className="text-[11px] text-blue-600">Bưu cục phát chặng cuối</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card className="rounded-xl border-indigo-100 bg-indigo-50/50 p-2 border shadow-xs">
              <div className="text-indigo-700 text-xs font-semibold uppercase flex items-center gap-1">
                🔗 Tuyến liên kết mạng
              </div>
              <div className="text-2xl font-black text-indigo-800 mt-1">{topologyData.totalLinks}</div>
              <div className="text-[11px] text-indigo-600">Đường trục & trung chuyển</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card className="rounded-xl border-green-100 bg-green-50/50 p-2 border shadow-xs">
              <div className="text-green-700 text-xs font-semibold uppercase flex items-center gap-1">
                🚛 Xe tải hoạt động
              </div>
              <div className="text-2xl font-black text-green-800 mt-1">{topologyData.totalActiveTrucks}</div>
              <div className="text-[11px] text-green-600">Đoàn xe trung chuyển</div>
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card className="rounded-xl border-amber-100 bg-amber-50/50 p-2 border shadow-xs">
              <div className="text-amber-700 text-xs font-semibold uppercase flex items-center gap-1">
                📦 Bao hàng luân chuyển
              </div>
              <div className="text-2xl font-black text-amber-800 mt-1">{topologyData.totalBagsInTransit}</div>
              <div className="text-[11px] text-amber-600">Đang trên xe trung chuyển</div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Điều hướng nhanh các Vùng trọng điểm */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-semibold text-gray-700">
          <span>📍 Phóng to nhanh khu vực:</span>
          <Button size="small" onClick={handleFitVietnam} className="font-medium text-xs">
            🇻🇳 Toàn cảnh hình chữ S
          </Button>
          <Button size="small" onClick={() => handleFocusRegion('NORTH')} className="text-xs">
            🏛️ Miền Bắc (Hà Nội)
          </Button>
          <Button size="small" onClick={() => handleFocusRegion('CENTRAL')} className="text-xs">
            🌊 Miền Trung (Đà Nẵng)
          </Button>
          <Button size="small" onClick={() => handleFocusRegion('SOUTH')} className="text-xs">
            🌴 Miền Nam (TP.HCM)
          </Button>
          <Button size="small" onClick={() => handleFocusRegion('MEKONG')} className="text-xs">
            🌾 Tây Nam Bộ (Cần Thơ)
          </Button>
        </div>

        {/* Lựa chọn loại bản đồ nền (Không watermark, sạch sẽ) */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 flex items-center gap-1">
            <MapIcon size={14} /> Bản đồ nền:
          </span>
          <Radio.Group
            size="small"
            value={mapTileStyle}
            onChange={(e) => setMapTileStyle(e.target.value)}
            buttonStyle="solid"
          >
            <Radio.Button value="osm">🗺️ OpenStreetMap</Radio.Button>
            <Radio.Button value="google_road">🌐 Google Maps</Radio.Button>
            <Radio.Button value="google_hybrid">🛰️ Vệ tinh</Radio.Button>
          </Radio.Group>
        </div>
      </div>

      {/* Thanh điều khiển & Bản đồ Leaflet */}
      <Card className="rounded-2xl shadow-sm border-gray-100 p-0 overflow-hidden">
        {/* Floating Controls Bar */}
        <div className="bg-gray-50/95 backdrop-blur p-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 font-semibold text-gray-700">
              Lọc cấp kho:
              <Select
                value={typeFilter}
                onChange={(val) => setTypeFilter(val)}
                className="w-48 ml-1"
                size="small"
                options={[
                  { label: 'Tất cả cấp kho', value: 'ALL' },
                  { label: '🌐 Kho vùng miền (Regional Hub)', value: 'REGIONAL_HUB' },
                  { label: '🏢 Trung tâm Hub tỉnh (Hub)', value: 'HUB' },
                  { label: '🛵 Bưu cục điểm cuối (Spoke)', value: 'SPOKE_POST_OFFICE' },
                ]}
              />
            </div>

            <div className="flex items-center gap-1 font-semibold text-gray-700">
              Phân vùng:
              <Select
                value={regionFilter}
                onChange={(val) => setRegionFilter(val)}
                className="w-36 ml-1"
                size="small"
                options={[
                  { label: 'Toàn quốc', value: 'ALL' },
                  { label: 'Miền Bắc', value: 'NORTH' },
                  { label: 'Miền Trung', value: 'CENTRAL' },
                  { label: 'Miền Nam', value: 'SOUTH' },
                ]}
              />
            </div>

            <Divider type="vertical" className="h-6" />

            <div className="flex items-center gap-2">
              <Switch size="small" checked={showLinks} onChange={(val) => setShowLinks(val)} />
              <span className="font-semibold text-gray-700">Đường nối mạng lưới</span>
            </div>

            <div className="flex items-center gap-2">
              <Switch size="small" checked={showTrucks} onChange={(val) => setShowTrucks(val)} />
              <span className="font-semibold text-gray-700">Hiển thị xe tải</span>
            </div>

            <Divider type="vertical" className="h-6" />

            <div className="flex items-center gap-1 text-gray-500 font-mono text-[11px]">
              <span>Mức thu phóng: <b>{currentZoom}x</b></span>
              {currentZoom < 10 ? (
                <Tag color="cyan" className="ml-1 text-[10px]">Toàn cảnh</Tag>
              ) : (
                <Tag color="geekblue" className="ml-1 text-[10px]">Chi tiết đường phố</Tag>
              )}
            </div>
          </div>

          {/* Chú thích biểu tượng (Legend) */}
          <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-600 bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-2xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-purple-600 inline-block shadow-xs"></span>
              Kho vùng miền
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-500 inline-block"></span>
              Hub tỉnh
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
              Bưu cục phát
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 bg-purple-600 inline-block"></span>
              Tuyến trục liên miền
            </span>
            <span className="flex items-center gap-1">
              <span className="w-4 h-0.5 border-t border-dashed border-orange-500 inline-block"></span>
              Tuyến nối Hub tỉnh
            </span>
          </div>
        </div>

        {/* Khung bản đồ Leaflet */}
        <div
          ref={mapContainerRef}
          className="w-full relative bg-slate-100"
          style={{ height: '72vh', minHeight: '600px' }}
        />
      </Card>

      {/* ================= DRAWER CHI TIẾT KHO & ĐIỀU PHỐI XE ================= */}
      <Drawer
        title={
          selectedNode && (
            <div className="flex items-center gap-2">
              <div
                className={`p-2 rounded-lg text-white ${
                  selectedNode.type === 'REGIONAL_HUB'
                    ? 'bg-purple-600'
                    : selectedNode.type === 'HUB'
                    ? 'bg-orange-600'
                    : 'bg-blue-600'
                }`}
              >
                {selectedNode.type === 'REGIONAL_HUB' ? (
                  <Compass size={18} />
                ) : selectedNode.type === 'HUB' ? (
                  <Building2 size={18} />
                ) : (
                  <MapPin size={18} />
                )}
              </div>
              <div>
                <div className="font-bold text-gray-800 text-base">{selectedNode.name}</div>
                <div className="text-xs text-gray-400 font-mono">
                  {selectedNode.code} | {selectedNode.typeDescription}
                </div>
              </div>
            </div>
          )
        }
        placement="right"
        width={420}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
      >
        {selectedNode && (
          <div className="space-y-5 text-xs">
            {/* Tag Cấp kho & Địa chỉ */}
            <div className="space-y-2 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between">
                <Tag
                  color={
                    selectedNode.type === 'REGIONAL_HUB'
                      ? 'purple'
                      : selectedNode.type === 'HUB'
                      ? 'volcano'
                      : 'blue'
                  }
                  className="font-bold text-xs"
                >
                  {selectedNode.typeDescription}
                </Tag>
                <Tag color={selectedNode.isActive ? 'green' : 'red'}>
                  {selectedNode.isActive ? 'Đang hoạt động' : 'Tạm ngưng'}
                </Tag>
              </div>

              <div>
                <span className="text-gray-500 block">Địa chỉ kho bưu cục:</span>
                <span className="font-semibold text-gray-800">{selectedNode.address}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Tỉnh / Thành phố:</span>
                <span className="font-bold text-blue-700">{selectedNode.provinceName}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Tọa độ GPS:</span>
                <span className="font-mono text-gray-600">
                  {selectedNode.latitude.toFixed(4)}, {selectedNode.longitude.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Chỉ số vận hành kho */}
            <div className="grid grid-cols-2 gap-3">
              <Card size="small" className="rounded-xl border-purple-100 bg-purple-50/40">
                <div className="text-gray-500 text-[11px]">Bao tải chờ gom</div>
                <div className="text-xl font-bold text-purple-700 mt-1">
                  {selectedNode.pendingBagsCount} bao
                </div>
                <div className="text-[10px] text-gray-400">Sẵn sàng điều vận</div>
              </Card>

              <Card size="small" className="rounded-xl border-green-100 bg-green-50/40">
                <div className="text-gray-500 text-[11px]">Xe tải tại bãi đỗ</div>
                <div className="text-xl font-bold text-green-700 mt-1">
                  {selectedNode.availableTrucksCount} xe
                </div>
                <div className="text-[10px] text-gray-400">Sẵn sàng nhận lệnh</div>
              </Card>

              <Card size="small" className="rounded-xl border-orange-100 bg-orange-50/40">
                <div className="text-gray-500 text-[11px]">Chuyến xe đang tới</div>
                <div className="text-xl font-bold text-orange-700 mt-1">
                  {selectedNode.incomingDispatchesCount} xe
                </div>
                <div className="text-[10px] text-gray-400">Đang hướng về kho</div>
              </Card>

              <Card size="small" className="rounded-xl border-blue-100 bg-blue-50/40">
                <div className="text-gray-500 text-[11px]">Sức chứa tối đa</div>
                <div className="text-xl font-bold text-blue-700 mt-1">
                  {selectedNode.capacityPackages?.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-400">Kiện hàng lưu kho</div>
              </Card>
            </div>

            <Divider className="my-2" />

            {/* Nút hành động nhanh điều phối */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Hành động điều phối nhanh:
              </div>

              <Button
                type="primary"
                block
                icon={<Navigation size={15} />}
                className="bg-purple-600 hover:bg-purple-700 font-bold h-10 rounded-xl"
                onClick={() => handleDirectDispatch(selectedNode)}
              >
                🚚 Tạo Lệnh Điều Vận Xe Từ Kho Này
              </Button>

              <Button
                block
                icon={<Boxes size={15} />}
                className="border-purple-300 text-purple-700 font-bold h-10 rounded-xl"
                onClick={() => handleDirectBagCreation(selectedNode)}
              >
                📦 Đóng Bao Tải Gom Hàng Tới Kho Này
              </Button>

              <Button
                block
                icon={<ExternalLink size={15} />}
                className="h-10 rounded-xl text-gray-700"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${selectedNode.latitude},${selectedNode.longitude}`,
                    '_blank'
                  )
                }
              >
                Mở Vị Trí Trên Google Maps
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default NetworkTopologyMapPage;
