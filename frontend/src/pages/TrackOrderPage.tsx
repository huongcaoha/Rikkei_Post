import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Timeline, Tag, Spin, message, Alert, Row, Col, Tooltip } from 'antd';
import {
  Search,
  Package,
  MapPin,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Compass,
  Building2,
  Home,
  Crosshair,
  ArrowRight,
  RotateCcw,
  Store,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { orderApi } from '../api/order';
import { Order, OrderTrackingLog } from '../types';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';

// Fix icon Leaflet mặc định
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Hành lang giao thông QL1A & Cao tốc Bắc - Nam (Nội suy đường bộ uốn lượn hình chữ S chuẩn Google Maps)
const HIGHWAY_CORRIDOR: [number, number][] = [
  [21.1833, 105.7500], // Hub Bắc Hà Nội (Mê Linh)
  [21.0285, 105.8542], // Hà Nội Center
  [20.9720, 105.7574], // Hà Đông (Bưu Cục The Pride)
  [20.5312, 105.9189], // Phủ Lý - Hà Nam
  [20.2506, 105.9744], // Ninh Bình
  [19.8067, 105.7852], // Thanh Hóa
  [18.6737, 105.6813], // Vinh - Nghệ An
  [18.3428, 105.9057], // Hà Tĩnh
  [17.8920, 106.3150], // Ba Đồn
  [17.4690, 106.6224], // Đồng Hới - Quảng Bình
  [16.8243, 107.1064], // Đông Hà - Quảng Trị
  [16.4637, 107.5909], // Huế
  [16.1523, 108.1258], // Hải Vân / Lăng Cô
  [16.0544, 108.2022], // Đà Nẵng
  [15.5684, 108.4815], // Tam Kỳ - Quảng Nam
  [15.1205, 108.8044], // Quảng Ngãi
  [14.4082, 109.0430], // Hoài Nhơn - Bình Định
  [13.7820, 109.2197], // Quy Nhơn
  [13.0882, 109.3148], // Tuy Hòa - Phú Yên
  [12.6953, 109.2312], // Vạn Giã
  [12.2388, 109.1967], // Nha Trang - Khánh Hòa
  [11.9404, 109.1554], // Cam Ranh
  [11.5653, 108.9950], // Phan Rang - Ninh Thuận
  [11.1685, 108.5721], // Bắc Bình
  [10.9273, 108.1022], // Phan Thiết - Bình Thuận
  [10.7485, 107.4523], // Xuân Lộc - Đồng Nai
  [10.9574, 106.8427], // Biên Hòa
  [10.8900, 106.7500], // Sóng Thần - Mega Hub Miền Nam
  [10.7725, 106.6980], // Bưu Cục Chợ Bến Thành (Quận 1)
  [10.7728, 106.7001], // Điểm nhận 58 Lê Lợi, TP.HCM
];

export interface RouteWaypoint {
  id: string;
  index: number;
  name: string;
  code?: string;
  address?: string;
  lat: number;
  lng: number;
  type: string; // SHOP, SPOKE_POST_OFFICE, HUB, REGIONAL_HUB, RECEIVER, RETURN_SENDER
  status?: string;
  statusLabel?: string;
  timestamp?: string;
  description?: string;
  actorName?: string;
  isCompleted?: boolean;
}

export const TrackOrderPage: React.FC = () => {
  const { trackingCode: paramCode } = useParams<{ trackingCode?: string }>();
  const [searchInput, setSearchInput] = useState<string>(paramCode || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderTrackingLog[]>([]);
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showAllWaypoints, setShowAllWaypoints] = useState<boolean>(false);
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (paramCode) {
      setSearchInput(paramCode);
      handleSearch(paramCode);
    }
  }, [paramCode]);

  // Lắng nghe cập nhật hành trình đơn hàng realtime qua WebSocket
  useOrderWebSocket({
    trackingCode: order?.trackingCode,
    showNotification: true,
    onEvent: () => {
      if (order?.trackingCode) {
        handleSearch(order.trackingCode);
      }
    },
  });

  const handleSearch = async (codeToSearch?: string) => {
    const code = (codeToSearch || searchInput).trim();
    if (!code) {
      message.warning('Vui lòng nhập mã vận đơn để tra cứu');
      return;
    }

    setLoading(true);
    try {
      const data = await orderApi.trackOrderPublic(code);
      setOrder(data.order);
      setTimeline(data.timeline || []);
      setWaypoints((data.routeWaypoints as RouteWaypoint[]) || []);
    } catch (err: any) {
      message.error('Không tìm thấy thông tin vận đơn hoặc mã không tồn tại');
      setOrder(null);
      setTimeline([]);
      setWaypoints([]);
    } finally {
      setLoading(false);
    }
  };

  // Căn chỉnh khung hình về trung tâm toàn bộ lộ trình
  const handleRecenterMap = () => {
    if (mapInstanceRef.current && polylineRef.current) {
      mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), {
        padding: [45, 45],
        maxZoom: 13,
      });
    }
  };

  // Khởi tạo và cập nhật bản đồ Google Maps / Leaflet khi có thông tin mốc trạm
  useEffect(() => {
    if (!order || !mapContainerRef.current) return;

    // Hủy instance cũ nếu đã tồn tại
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // 1. Tạo danh sách các mốc trạm định vị (Waypoints)
      let currentWaypoints: RouteWaypoint[] = waypoints && waypoints.length > 0 ? [...waypoints] : [];

      if (currentWaypoints.length === 0) {
        // Fallback tự sinh nếu backend chưa trả danh sách mốc
        const sLat = order.senderLat || 20.9720;
        const sLng = order.senderLng || 105.7574;
        const rLat = order.receiverLat || 10.7728;
        const rLng = order.receiverLng || 106.7001;

        currentWaypoints = [
          {
            id: 'WP_SENDER',
            index: 1,
            name: `Điểm gửi: ${order.senderName || 'Shop'}`,
            address: order.senderAddress,
            lat: sLat,
            lng: sLng,
            type: 'SHOP',
            status: 'PICKED_UP',
            statusLabel: 'Shop gửi hàng',
            isCompleted: true,
          },
          {
            id: 'WP_HUB_1',
            index: 2,
            name: 'Trung tâm Khai thác Hub Bắc Hà Nội',
            address: 'KCN Quang Minh, Mê Linh, Hà Nội',
            lat: 21.1833,
            lng: 105.7500,
            type: 'HUB',
            status: 'IN_TRANSIT',
            statusLabel: 'Hub trung chuyển Bắc',
            isCompleted: true,
          },
          {
            id: 'WP_HUB_2',
            index: 3,
            name: 'Tổng kho Trung chuyển Liên miền Miền Nam (Mega Hub)',
            address: 'Dĩ An, Bình Dương / TP.HCM',
            lat: 10.8900,
            lng: 106.7500,
            type: 'REGIONAL_HUB',
            status: 'AT_SORTING_HUB',
            statusLabel: 'Mega Hub Miền Nam',
            isCompleted: true,
          },
          {
            id: 'WP_RECEIVER',
            index: 4,
            name: `Điểm giao: ${order.receiverName || 'Khách hàng'}`,
            address: order.receiverAddress,
            lat: rLat,
            lng: rLng,
            type: 'RECEIVER',
            status: order.currentStatus,
            statusLabel: 'Điểm giao chặng cuối',
            isCompleted: order.currentStatus === 'DELIVERED',
          },
        ];
      }

      // Khởi tạo bản đồ Leaflet
      const defaultCenter: [number, number] = [
        currentWaypoints[0]?.lat || 16.0544,
        currentWaypoints[0]?.lng || 108.2022,
      ];

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 6,
        zoomControl: false, // Bật zoom gọn
        attributionControl: false,
      });

      // Layer Google Maps chuẩn nét cao
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 19,
      }).addTo(map);

      // Thêm nút zoom ở góc trên bên phải
      L.control.zoom({ position: 'topright' }).addTo(map);

      // 2. Nội suy đường bộ uốn lượn men theo dải đất chữ S (Không cắt qua Lào / Campuchia)
      const fullPolylineCoords: [number, number][] = [];

      for (let i = 0; i < currentWaypoints.length - 1; i++) {
        const p1 = currentWaypoints[i];
        const p2 = currentWaypoints[i + 1];

        fullPolylineCoords.push([p1.lat, p1.lng]);

        const minLat = Math.min(p1.lat, p2.lat);
        const maxLat = Math.max(p1.lat, p2.lat);

        // Nếu khoảng cách vĩ độ lớn (chuyển liên miền), nối qua các trạm hành lang QL1A
        if (maxLat - minLat > 1.8) {
          const intermediate = HIGHWAY_CORRIDOR.filter(
            (c) => c[0] > minLat + 0.12 && c[0] < maxLat - 0.12
          );

          if (p1.lat > p2.lat) {
            intermediate.sort((a, b) => b[0] - a[0]); // Từ Bắc vào Nam
          } else {
            intermediate.sort((a, b) => a[0] - b[0]); // Từ Nam ra Bắc (Chuyển hoàn)
          }

          intermediate.forEach((c) => fullPolylineCoords.push(c));
        }
      }

      if (currentWaypoints.length > 0) {
        const last = currentWaypoints[currentWaypoints.length - 1];
        fullPolylineCoords.push([last.lat, last.lng]);
      }

      // Vẽ lớp đổ bóng đường (Shadow polyline)
      L.polyline(fullPolylineCoords, {
        color: '#ffedd5',
        weight: 8,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      // Vẽ tuyến đường màu cam đỏ uốn lượn mượt mà chuẩn Google Maps (Ảnh 2)
      const polyline = L.polyline(fullPolylineCoords, {
        color: '#FF6B4A', // Màu cam san hô nổi bật như Google Maps trong Ảnh 2
        weight: 4.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      polylineRef.current = polyline;

      // 3. CẮM MỐC ĐỊNH VỊ TẠI TỪNG KHO / TRẠM DỪNG (Waypoint Pins)
      // Tìm mốc trạm hiện tại đang xử lý kiện hàng (Mốc cuối cùng có isCompleted hoặc trạm gần nhất)
      const activeWaypointIndex = currentWaypoints.reduce((latestIdx, wp, idx) => {
        return wp.isCompleted ? idx : latestIdx;
      }, 0);

      currentWaypoints.forEach((wp, idx) => {
        const isActive = idx === activeWaypointIndex;
        let pinHtml = '';

        if (wp.type === 'SHOP') {
          // Mốc Điểm Gửi (Shop) - Màu xanh lá cây
          pinHtml = `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">
              <div style="background-color: #10B981; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(16,185,129,0.5); font-weight: 800; font-size: 13px;">G</div>
            </div>
          `;
        } else if (wp.type === 'RECEIVER') {
          // Mốc Điểm Giao Hàng (Khách) - Google Maps Red Pin
          pinHtml = `
            <div style="position: relative; width: 36px; height: 42px; display: flex; flex-direction: column; align-items: center;">
              <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 8px rgba(220,38,38,0.45));">
                <path d="M17 0C7.61116 0 0 7.61116 0 17C0 29.75 17 42 17 42C17 42 34 29.75 34 17C34 7.61116 26.3888 0 17 0Z" fill="#EA4335"/>
                <circle cx="17" cy="16" r="6.5" fill="white"/>
              </svg>
            </div>
          `;
        } else if (wp.type === 'RETURN_SENDER') {
          // Mốc Hoàn trả về Shop - Màu Cam Đỏ
          pinHtml = `
            <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
              <div style="background-color: #F97316; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(249,115,22,0.5); font-size: 13px; font-weight: bold;">↺</div>
            </div>
          `;
        } else if (wp.type === 'HUB' || wp.type === 'REGIONAL_HUB') {
          // Mốc Hub Trung Chuyển Liên Miền / Vùng - Tím Indigo
          pinHtml = `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px;">
              ${isActive ? '<div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: #6366F1; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
              <div style="background-color: #6366F1; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2.5px solid #ffffff; box-shadow: 0 4px 8px rgba(99,102,241,0.4); font-weight: 800; font-size: 11px;">H</div>
            </div>
          `;
        } else {
          // Mốc Bưu Cục Phát / Nhận (Spoke Post Office) - Xanh Dương
          pinHtml = `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;">
              ${isActive ? '<div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background-color: #2563EB; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>' : ''}
              <div style="background-color: #2563EB; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 2.5px solid #ffffff; box-shadow: 0 4px 8px rgba(37,99,235,0.4); font-weight: 800; font-size: 11px;">B</div>
            </div>
          `;
        }

        const customMarkerIcon = L.divIcon({
          className: 'rkp-map-pin',
          html: pinHtml,
          iconSize: [36, 42],
          iconAnchor: [18, wp.type === 'RECEIVER' ? 40 : 16],
          popupAnchor: [0, wp.type === 'RECEIVER' ? -40 : -16],
        });

        // Popup hiển thị chi tiết khi bấm vào mốc
        const popupContent = `
          <div style="min-width: 220px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; margin-bottom: 2px;">
              Trạm thứ ${wp.index}: ${wp.statusLabel || wp.type}
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #0F172A; line-height: 1.3; margin-bottom: 4px;">
              ${wp.name}
            </div>
            ${wp.address ? `<div style="font-size: 11px; color: #475569; margin-bottom: 6px;">📍 ${wp.address}</div>` : ''}
            ${wp.timestamp ? `
              <div style="font-size: 11px; color: #EA580C; font-weight: 600; background: #FFF7ED; padding: 3px 6px; border-radius: 6px; margin-bottom: 6px; display: inline-block;">
                ⏰ ${new Date(wp.timestamp).toLocaleString('vi-VN')}
              </div>
            ` : ''}
            ${wp.description ? `
              <div style="font-size: 11px; color: #334155; line-height: 1.4; border-top: 1px solid #E2E8F0; padding-top: 6px;">
                ${wp.description}
              </div>
            ` : ''}
          </div>
        `;

        L.marker([wp.lat, wp.lng], { icon: customMarkerIcon })
          .addTo(map)
          .bindPopup(popupContent);
      });

      // Bao quát toàn bộ lộ trình
      map.fitBounds(polyline.getBounds(), {
        padding: [45, 45],
        maxZoom: 13,
      });

      mapInstanceRef.current = map;
    } catch (e) {
      console.warn('Không thể khởi tạo bản đồ hành trình:', e);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [order, waypoints]);

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      CREATED: 'blue',
      PICKED_UP: 'cyan',
      IN_WAREHOUSE: 'purple',
      AT_SORTING_HUB: 'geekblue',
      IN_TRANSIT: 'blue',
      DELIVERING: 'orange',
      DELIVERED: 'green',
      DELIVERY_FAILED: 'red',
      RETURNING: 'volcano',
      RETURNED: 'red',
    };
    return map[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      CREATED: 'Mới tạo đơn',
      PICKED_UP: 'Đã lấy hàng từ Shop',
      IN_WAREHOUSE: 'Đang lưu kho bưu cục',
      AT_SORTING_HUB: 'Đang tại kho Hub khai thác',
      IN_TRANSIT: 'Đang trung chuyển chuyến xe',
      DELIVERING: 'Đang giao cho người nhận',
      DELIVERED: 'Giao hàng thành công',
      DELIVERY_FAILED: 'Giao thất bại (Chờ phát lại)',
      RETURNING: 'Đang chuyển hoàn về Shop',
      RETURNED: 'Đã hoàn trả về Shop thành công',
    };
    return map[status] || status;
  };

  // Xác định tiêu đề thẻ hành trình Google Maps kiểu Ảnh 2
  const getGoogleJourneyTitle = () => {
    if (!order) return '';
    if (order.currentStatus === 'RETURNED') {
      return 'Đã hoàn trả về Shop thành công';
    }
    if (order.currentStatus === 'RETURNING') {
      return 'Đang chuyển hoàn về người gửi (Shop)';
    }
    if (order.currentStatus === 'DELIVERED') {
      return 'Đã giao hàng thành công';
    }
    if (order.currentStatus === 'DELIVERING') {
      return 'Đang giao hàng đến người nhận';
    }
    return 'Đang vận chuyển liên miền';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Search Bar Card */}
      <Card className="rounded-3xl border-gray-200 shadow-sm p-4 text-center">
        <h2 className="text-xl font-black text-gray-900 tracking-tight mb-1">
          Tra Cứu Hành Trình Bưu Gửi Toàn Quốc
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          Nhập mã vận đơn bưu chính chính thức (ví dụ: <strong className="text-red-600">RKP...</strong>) để theo dõi trạng thái di chuyển theo thời gian thực.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex max-w-xl mx-auto space-x-2"
        >
          <Input
            size="large"
            placeholder="Nhập mã vận đơn (VD: RKP2611...)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            prefix={<Search size={18} className="text-gray-400 mr-1" />}
            className="rounded-2xl text-sm font-semibold tracking-wide border-gray-300 focus:border-red-500"
          />
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            loading={loading}
            className="bg-red-600 hover:bg-red-700 font-bold px-6 rounded-2xl shadow-md h-auto"
          >
            Tra Cứu
          </Button>
        </form>
      </Card>

      {/* Main Tracking Details */}
      {order && (
        <div className="space-y-6">
          {/* Order Summary Card */}
          <Card className="rounded-3xl border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase">Mã vận đơn bưu chính</span>
                <div className="text-2xl font-black font-mono text-red-600">{order.trackingCode}</div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Trạng thái:</span>
                <Tag color={getStatusColor(order.currentStatus)} className="text-sm font-bold px-3 py-1 rounded-lg">
                  {getStatusLabel(order.currentStatus)} ({order.currentStatus})
                </Tag>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs">
              <div>
                <div className="font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                  Gửi từ (Shop):
                </div>
                <div className="font-bold text-sm text-gray-900">{order.senderName}</div>
                <div className="text-gray-500 mt-0.5">{order.senderAddress}</div>
              </div>

              <div>
                <div className="font-bold text-red-700 uppercase mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  Giao đến (Khách nhận):
                </div>
                <div className="font-bold text-sm text-gray-900">{order.receiverName}</div>
                <div className="text-gray-500 mt-0.5">{order.receiverAddress}</div>
              </div>

              <div className="bg-gray-50 p-3 rounded-2xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Bưu cục phụ trách:</span>
                  <span className="font-semibold text-gray-800">{order.postOfficeName || 'Bưu Cục Chợ Bến Thành'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nội dung hàng:</span>
                  <span className="font-semibold text-gray-800">{order.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Khối lượng:</span>
                  <span className="font-semibold text-gray-800">{order.billableWeightGram}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tiền COD:</span>
                  <span className="font-bold text-red-600">{Number(order.codAmount).toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            </div>

            {/* Bằng Chứng Giao Hàng POD hoặc Bằng Chứng Hoàn Hàng */}
            {(order.podPhotoUrl || order.podSignatureUrl) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className={`border rounded-2xl p-4 ${
                  order.currentStatus === 'RETURNED'
                    ? 'bg-purple-50/70 border-purple-200'
                    : 'bg-emerald-50/70 border-emerald-200'
                }`}>
                  <div className={`flex items-center space-x-2 font-bold text-sm mb-3 ${
                    order.currentStatus === 'RETURNED' ? 'text-purple-800' : 'text-emerald-800'
                  }`}>
                    {order.currentStatus === 'RETURNED' ? (
                      <RotateCcw size={18} className="text-purple-600" />
                    ) : (
                      <CheckCircle2 size={18} className="text-emerald-600" />
                    )}
                    <span>
                      {order.currentStatus === 'RETURNED'
                        ? 'Bằng Chứng Hoàn Trả Hàng Cho Shop Đã Xác Thực (Proof of Return)'
                        : 'Bằng Chứng Giao Hàng POD Đã Xác Thực (Proof of Delivery)'}
                    </span>
                    <Tag color={order.currentStatus === 'RETURNED' ? 'purple' : 'green'} className="font-bold text-[10px] ml-auto">
                      ✓ ĐÃ XÁC THỰC
                    </Tag>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {order.podSignatureUrl && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <div className="text-gray-600 font-medium mb-1">Chữ ký điện tử người nhận ({order.podReceiverName || order.receiverName}):</div>
                        <img
                          src={order.podSignatureUrl}
                          alt="Chữ ký nhận"
                          className="max-h-24 mx-auto object-contain"
                        />
                      </div>
                    )}
                    {order.podPhotoUrl && (
                      <div className="bg-white p-3 rounded-xl border border-gray-200">
                        <div className="text-gray-600 font-medium mb-1">
                          {order.currentStatus === 'RETURNED'
                            ? `Ảnh hiện trường bàn giao hàng hoàn cho Shop (${order.podReceiverName || order.senderName}):`
                            : 'Ảnh hiện trường đóng dấu Watermark GPS:'}
                        </div>
                        <img
                          src={order.podPhotoUrl}
                          alt="Ảnh bằng chứng"
                          className="max-h-36 mx-auto object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* SƠ ĐỒ BẢN ĐỒ GOOGLE MAPS HÀNH TRÌNH LUÂN CHUYỂN (CHUẨN HÌNH ẢNH 2 CỦA NGƯỜI DÙNG) */}
          <Card
            title={
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2 text-gray-900 font-bold text-base">
                  <Compass size={18} className="text-red-600" />
                  <span>Sơ Đồ Tuyến Đường Luân Chuyển Hub-and-Spoke (Bản Đồ Google Maps)</span>
                </div>
                <div className="text-xs font-normal text-gray-500 hidden sm:block">
                  Cắm mốc chi tiết từng kho & nối lộ trình uốn lượn hình chữ S
                </div>
              </div>
            }
            className="rounded-3xl border-gray-200 shadow-sm overflow-hidden"
            bodyStyle={{ padding: 0 }}
          >
            {/* Chú thích các mốc trạm */}
            <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 bg-gray-50 px-5 py-3 border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block border-2 border-white shadow-sm"></span> Điểm gửi (Shop)
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block border-2 border-white shadow-sm"></span> Hub Trung chuyển
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block border-2 border-white shadow-sm"></span> Bưu cục phát
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block border-2 border-white shadow-sm"></span> Điểm nhận (Khách)
                </span>
                {(order.currentStatus === 'RETURNING' || order.currentStatus === 'RETURNED') && (
                  <span className="flex items-center gap-1.5 font-medium text-amber-700">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block border-2 border-white shadow-sm"></span> Chuyển hoàn về Shop
                  </span>
                )}
              </div>
              <div className="text-gray-400 text-[11px] italic mt-1 sm:mt-0">
                Lộ trình nối uốn lượn theo hành lang cao tốc QL1A
              </div>
            </div>

            {/* Khung bản đồ Google Maps & Nút định vị Crosshairs (Ảnh 2) */}
            <div className="relative">
              <div
                ref={mapContainerRef}
                style={{ width: '100%', height: '420px', background: '#f8fafc' }}
                className="z-0"
              />

              {/* Watermark Google chuẩn góc dưới bên trái */}
              <div className="absolute bottom-3 left-4 z-10 pointer-events-none select-none opacity-85">
                <span className="text-xs font-black tracking-tight text-gray-600 drop-shadow-sm font-sans bg-white/80 px-2 py-0.5 rounded shadow-sm">
                  Google
                </span>
              </div>

              {/* Nút Target / Recenter chuẩn Google Maps góc dưới bên phải (Ảnh 2) */}
              <button
                type="button"
                onClick={handleRecenterMap}
                title="Căn giữa toàn bộ lộ trình"
                className="absolute bottom-4 right-4 z-10 w-10 h-10 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 hover:text-red-600 hover:bg-gray-50 transition-all cursor-pointer"
              >
                <Crosshair size={20} />
              </button>
            </div>

            {/* THẺ TIẾN TRÌNH HÀNH TRÌNH CHUẨN GOOGLE MAPS (GIỐNG HỆT ẢNH 2) */}
            <div className="p-5 bg-white border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                  <span>{getGoogleJourneyTitle()}</span>
                  {order.currentStatus === 'RETURNING' && (
                    <Tag color="volcano" className="font-bold text-xs rounded-full">
                      Kích hoạt Chuyển hoàn
                    </Tag>
                  )}
                </h3>
                <span className="text-xs text-gray-400">
                  Cập nhật: {new Date(order.updatedAt || order.createdAt).toLocaleTimeString('vi-VN')}
                </span>
              </div>

              {/* Thanh Tiến Trình Stepper (3-4 bước chuẩn Ảnh 2) */}
              <div className="relative flex items-center justify-between max-w-2xl mx-auto px-4 py-2">
                {/* Đường nối ngang */}
                <div className="absolute top-1/2 left-8 right-8 h-1 bg-gray-200 -translate-y-1/2 z-0">
                  <div
                    className={`h-full transition-all duration-500 ${
                      order.currentStatus === 'RETURNING' || order.currentStatus === 'RETURNED'
                        ? 'bg-amber-500 w-full'
                        : order.currentStatus === 'DELIVERED'
                        ? 'bg-emerald-500 w-full'
                        : order.currentStatus === 'DELIVERING'
                        ? 'bg-emerald-500 w-2/3'
                        : 'bg-emerald-500 w-1/3'
                    }`}
                  />
                </div>

                {/* Bước 1: Đã vận chuyển */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-white">
                    ✓
                  </div>
                  <span className="text-xs font-semibold text-gray-700 mt-2">Đã vận chuyển</span>
                </div>

                {/* Bước 2: Luân chuyển Hub */}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-white">
                    ✓
                  </div>
                  <span className="text-xs font-semibold text-gray-700 mt-2">Qua các Hub</span>
                </div>

                {/* Bước 3: Đang giao hàng */}
                <div className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 border-white ${
                      order.currentStatus === 'RETURNING' || order.currentStatus === 'RETURNED'
                        ? 'bg-amber-500 text-white'
                        : order.currentStatus === 'DELIVERED'
                        ? 'bg-emerald-500 text-white'
                        : order.currentStatus === 'DELIVERING'
                        ? 'bg-emerald-500 text-white animate-pulse'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {order.currentStatus === 'DELIVERED' || order.currentStatus === 'RETURNING' || order.currentStatus === 'RETURNED' ? '✓' : '3'}
                  </div>
                  <span className="text-xs font-semibold text-gray-700 mt-2">Đang giao hàng</span>
                </div>

                {/* Bước 4: Hoàn thành hoặc Chuyển hoàn */}
                <div className="relative z-10 flex flex-col items-center">
                  {order.currentStatus === 'RETURNING' || order.currentStatus === 'RETURNED' ? (
                    <>
                      <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-white animate-pulse">
                        ↺
                      </div>
                      <span className="text-xs font-bold text-amber-700 mt-2">
                        {order.currentStatus === 'RETURNED' ? 'Đã trả Shop' : 'Đang chuyển hoàn'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 border-white ${
                          order.currentStatus === 'DELIVERED'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-300 text-gray-600'
                        }`}
                      >
                        {order.currentStatus === 'DELIVERED' ? '✓' : '4'}
                      </div>
                      <span className="text-xs font-semibold text-gray-700 mt-2">Đã giao hàng</span>
                    </>
                  )}
                </div>
              </div>

              {/* Danh sách các trạm dừng đã ghé qua (Accordion có thể mở rộng) */}
              {waypoints.length > 0 && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <div
                    onClick={() => setShowAllWaypoints(!showAllWaypoints)}
                    className="flex items-center justify-between text-xs font-bold text-gray-700 cursor-pointer hover:text-red-600 select-none"
                  >
                    <span className="flex items-center gap-1.5">
                      <Building2 size={16} className="text-red-500" />
                      Chi tiết {waypoints.length} trạm dừng luân chuyển trong hành trình:
                    </span>
                    <span className="flex items-center gap-1 text-gray-400">
                      {showAllWaypoints ? 'Thu gọn' : 'Xem tất cả'}
                      {showAllWaypoints ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </div>

                  <div className={`mt-3 space-y-2 ${showAllWaypoints ? 'block' : 'hidden'}`}>
                    {waypoints.map((wp, idx) => (
                      <div
                        key={wp.id || idx}
                        className="flex items-start gap-3 p-2.5 rounded-xl bg-gray-50 text-xs border border-gray-100"
                      >
                        <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 font-bold flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-gray-900">{wp.name}</span>
                            {wp.timestamp && (
                              <span className="text-[11px] text-gray-500 font-mono">
                                {new Date(wp.timestamp).toLocaleTimeString('vi-VN')} {new Date(wp.timestamp).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>
                          {wp.address && <div className="text-gray-500 text-[11px] mt-0.5">📍 {wp.address}</div>}
                          {wp.description && <div className="text-gray-700 mt-1 text-[11px] leading-relaxed">{wp.description}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Timeline Tracking History Card */}
          <Card
            title={
              <div className="flex items-center space-x-2 text-gray-900 font-bold text-base py-1">
                <Clock size={18} className="text-red-600" />
                <span>Nhật Ký Hành Trình Chi Tiết</span>
              </div>
            }
            className="rounded-3xl border-gray-200 shadow-sm"
          >
            {timeline.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                Đơn hàng mới tạo, chưa có dữ liệu luân chuyển tiếp theo.
              </div>
            ) : (
              <Timeline
                mode="left"
                className="mt-4"
                items={timeline.map((item, index) => ({
                  color: index === 0 ? (item.status === 'RETURNING' || item.status === 'RETURNED' ? 'volcano' : 'red') : 'gray',
                  label: (
                    <span className="text-xs text-gray-500 font-mono font-medium">
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </span>
                  ),
                  children: (
                    <div className="pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag color={getStatusColor(item.status)} className="font-bold text-xs px-2.5 py-0.5 rounded-md">
                          {getStatusLabel(item.status)} ({item.status})
                        </Tag>
                        <Tag color="default" className="text-[11px] font-medium text-gray-600 bg-gray-100 border-gray-200">
                          {item.locationName}
                        </Tag>
                      </div>
                      <div className={`text-xs mt-2 p-3 rounded-xl border leading-relaxed font-normal ${
                        item.status === 'RETURNING' || item.status === 'RETURNED'
                          ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                          : 'bg-red-50/40 border-red-100/60 text-gray-800'
                      }`}>
                        {item.description}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1.5">
                        <span className="font-medium text-gray-500">Người thực hiện:</span>
                        <span className="font-semibold text-gray-700">{item.actorName}</span>
                        <span>• Thiết bị/Kênh: {item.deviceInfo || 'Hệ thống'}</span>
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
