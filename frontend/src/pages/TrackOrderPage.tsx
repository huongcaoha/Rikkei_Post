import React, { useState, useEffect, useRef } from 'react';
import { Card, Input, Button, Timeline, Tag, Spin, message, Alert, Row, Col } from 'antd';
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

// Tọa độ tham chiếu mặc định cho 3 miền nếu đơn chưa có GPS chính xác
const REGION_COORDS: Record<number, [number, number]> = {
  1: [21.0285, 105.8542], // Hà Nội (Bắc)
  48: [16.0544, 108.2022], // Đà Nẵng (Trung)
  79: [10.8231, 106.6297], // TP. Hồ Chí Minh (Nam)
};

export const TrackOrderPage: React.FC = () => {
  const { trackingCode: paramCode } = useParams<{ trackingCode?: string }>();
  const [searchInput, setSearchInput] = useState<string>(paramCode || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderTrackingLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (paramCode) {
      setSearchInput(paramCode);
      handleSearch(paramCode);
    }
  }, [paramCode]);

  // Lắng nghe cập nhật hành trình đơn hàng realtime
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
      setTimeline(data.timeline);
    } catch (err: any) {
      message.error('Không tìm thấy thông tin vận đơn hoặc mã không tồn tại');
      setOrder(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  // Khởi tạo và cập nhật bản đồ Google Maps / Leaflet khi có thông tin đơn hàng
  useEffect(() => {
    if (!order || !mapContainerRef.current) return;

    // Hủy instance cũ nếu đã tồn tại
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    try {
      // 1. Xác định tọa độ người gửi (Start Point)
      const senderCoord: [number, number] = [
        order.senderLat || REGION_COORDS[order.senderProvinceId]?.[0] || 21.0285,
        order.senderLng || REGION_COORDS[order.senderProvinceId]?.[1] || 105.8542,
      ];

      // 2. Xác định tọa độ người nhận (End Point)
      const receiverCoord: [number, number] = [
        order.receiverLat || REGION_COORDS[order.receiverProvinceId]?.[0] || 10.8231,
        order.receiverLng || REGION_COORDS[order.receiverProvinceId]?.[1] || 106.6297,
      ];

      // 3. Tọa độ điểm trung chuyển bưu cục / Hub nếu khác tỉnh
      const routePoints: [number, number][] = [senderCoord];

      // Nếu gửi liên vùng hoặc nội vùng, thêm điểm trung gian Hub
      if (order.senderProvinceId !== order.receiverProvinceId) {
        // Điểm Hub trung gian ước tính
        const midLat = (senderCoord[0] + receiverCoord[0]) / 2 + (Math.random() * 0.2 - 0.1);
        const midLng = (senderCoord[1] + receiverCoord[1]) / 2 + (Math.random() * 0.2 - 0.1);
        routePoints.push([midLat, midLng]);
      }

      routePoints.push(receiverCoord);

      // Khởi tạo bản đồ
      const map = L.map(mapContainerRef.current, {
        center: senderCoord,
        zoom: 7,
        zoomControl: true,
      });

      // Layer Google Maps chuẩn
      L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        attribution: '© Google Maps / Rikkei Post Tracking',
        maxZoom: 19,
      }).addTo(map);

      // Icon Điểm gửi (Xanh lá)
      const senderIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="background-color: #16a34a; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px;">G</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      // Icon Bưu cục / Hub trung chuyển (Xanh dương / Tím)
      const hubIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="background-color: #2563eb; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); font-weight: bold; font-size: 13px;">H</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      // Icon Điểm nhận (Đỏ)
      const receiverIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="background-color: #dc2626; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); font-weight: bold; font-size: 14px;">N</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      // Thêm Marker Điểm Gửi
      L.marker(senderCoord, { icon: senderIcon })
        .addTo(map)
        .bindPopup(`<b>Điểm Gửi Hàng (Shop)</b><br/>${order.senderName}<br/>${order.senderAddress}`);

      // Nếu có điểm Hub
      if (routePoints.length === 3) {
        L.marker(routePoints[1], { icon: hubIcon })
          .addTo(map)
          .bindPopup(`<b>Trung Tâm Khai Thác & Luân Chuyển Hub</b><br/>Phân loại & Đóng bao tải Master Bag`);
      }

      // Thêm Marker Điểm Nhận
      L.marker(receiverCoord, { icon: receiverIcon })
        .addTo(map)
        .bindPopup(`<b>Điểm Giao Hàng (Người Nhận)</b><br/>${order.receiverName}<br/>${order.receiverAddress}`);

      // Vẽ đường Polyline lộ trình di chuyển (nét đứt chuyên nghiệp)
      const polyline = L.polyline(routePoints, {
        color: '#dc2626',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 8',
      }).addTo(map);

      // Tự động bao quát toàn bộ hành trình
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
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
  }, [order]);

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      CREATED: 'blue',
      PICKED_UP: 'cyan',
      IN_WAREHOUSE: 'purple',
      IN_TRANSIT: 'geekblue',
      DELIVERING: 'orange',
      DELIVERED: 'green',
      FAILED: 'red',
      RETURNED: 'volcano',
    };
    return map[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      CREATED: 'Mới tạo đơn',
      PICKED_UP: 'Đã lấy hàng từ Shop',
      IN_WAREHOUSE: 'Đang lưu kho / Bưu cục',
      IN_TRANSIT: 'Đang luân chuyển chuyến xe',
      DELIVERING: 'Đang giao cho người nhận',
      DELIVERED: 'Giao hàng thành công',
      FAILED: 'Giao thất bại',
      RETURNED: 'Đã thu hồi hoàn về kho',
    };
    return map[status] || status;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Search Bar Card */}
      <Card className="rounded-3xl border-gray-200 shadow-sm p-4 text-center">
        <h2 className="text-xl font-black text-gray-900 tracking-tight mb-1">
          Tra Cứu Hành Trình Bưu Gửi Toàn Quốc
        </h2>
        <p className="text-gray-500 text-xs mb-4">
          Nhập mã vận đơn bưu điện chính thức (ví dụ: <strong className="text-red-600">RKP...</strong>) để theo dõi trạng thái di chuyển theo thời gian thực.
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
                  Gửi từ:
                </div>
                <div className="font-bold text-sm text-gray-900">{order.senderName}</div>
                <div className="text-gray-500 mt-0.5">{order.senderAddress}</div>
              </div>

              <div>
                <div className="font-bold text-red-700 uppercase mb-1 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  Giao đến:
                </div>
                <div className="font-bold text-sm text-gray-900">{order.receiverName}</div>
                <div className="text-gray-500 mt-0.5">{order.receiverAddress}</div>
              </div>

              <div className="bg-gray-50 p-3 rounded-2xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Routing Code:</span>
                  <span className="font-mono font-bold text-blue-600">{order.routingCode || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nội dung:</span>
                  <span className="font-semibold text-gray-800">{order.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trọng lượng:</span>
                  <span className="font-semibold text-gray-800">{order.billableWeightGram}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Thu hộ COD:</span>
                  <span className="font-bold text-red-600">{Number(order.codAmount).toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            </div>

            {/* Bằng Chứng Giao Hàng POD (US-15) */}
            {(order.podPhotoUrl || order.podSignatureUrl) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm mb-3">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Bằng Chứng Giao Hàng POD Đã Xác Thực (Proof of Delivery)</span>
                    <Tag color="green" className="font-bold text-[10px] ml-auto">
                      ✓ ĐÃ XÁC THỰC
                    </Tag>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {order.podSignatureUrl && (
                      <div className="bg-white p-3 rounded-xl border border-emerald-100">
                        <div className="text-gray-600 font-medium mb-1">Chữ ký điện tử người nhận ({order.podReceiverName || order.receiverName}):</div>
                        <img
                          src={order.podSignatureUrl}
                          alt="Chữ ký nhận"
                          className="max-h-24 mx-auto object-contain"
                        />
                      </div>
                    )}
                    {order.podPhotoUrl && (
                      <div className="bg-white p-3 rounded-xl border border-emerald-100">
                        <div className="text-gray-600 font-medium mb-1">Ảnh hiện trường đóng dấu Watermark GPS:</div>
                        <img
                          src={order.podPhotoUrl}
                          alt="Ảnh POD"
                          className="max-h-36 mx-auto object-cover rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                  {order.podLatitude && (
                    <div className="mt-2 text-[11px] text-emerald-700 flex items-center justify-between">
                      <span>Tọa độ xác nhận giao hàng: <b>{order.podLatitude.toFixed(6)}, {order.podLongitude?.toFixed(6)}</b></span>
                      <span>Hình thức thanh toán: <b>{order.paymentMethod || 'Tiền mặt (CASH)'}</b></span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* SƠ ĐỒ BẢN ĐỒ GOOGLE MAPS HÀNH TRÌNH LUÂN CHUYỂN (US-12) */}
          <Card
            title={
              <div className="flex items-center space-x-2 text-gray-900 font-bold text-base py-1">
                <Compass size={18} className="text-red-600" />
                <span>Sơ Đồ Tuyến Đường Luân Chuyển Hub-and-Spoke (Bản Đồ Trực Quan)</span>
              </div>
            }
            className="rounded-3xl border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-green-600 inline-block"></span> Điểm gửi (Shop)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Hub / Bưu cục
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-600 inline-block"></span> Điểm nhận (Khách)
                  </span>
                </div>
                <div className="text-gray-400 italic">Đường nét đứt thể hiện lộ trình luân chuyển qua các trạm</div>
              </div>

              {/* Khung bản đồ */}
              <div
                ref={mapContainerRef}
                style={{ width: '100%', height: '380px' }}
                className="rounded-2xl overflow-hidden border border-gray-200 z-0 shadow-inner"
              />
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
                  color: index === 0 ? 'red' : 'gray',
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
                      <div className="text-xs text-gray-800 mt-2 p-3 bg-red-50/40 rounded-xl border border-red-100/60 leading-relaxed font-normal">
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
