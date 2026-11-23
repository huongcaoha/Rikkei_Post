import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, message, Spin, Tag } from 'antd';
import { MapPin, Navigation, Search, Check, Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icon Leaflet mặc định trong Webpack / Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LocationPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelectLocation: (lat: number, lng: number, addressText?: string) => void;
  initialLat?: number;
  initialLng?: number;
  title?: string;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  open,
  onClose,
  onSelectLocation,
  initialLat,
  initialLng,
  title = 'Chọn Vị Trí Cụ Thể Trên Bản Đồ',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Mặc định Hà Nội (21.0285, 105.8542) nếu chưa có tọa độ
  const [selectedLat, setSelectedLat] = useState<number>(initialLat || 21.0285);
  const [selectedLng, setSelectedLng] = useState<number>(initialLng || 105.8542);
  const [addressPreview, setAddressPreview] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Đảo ngược geocode từ tọa độ ra tên đường (OpenStreetMap Nominatim)
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'vi' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          setAddressPreview(data.display_name);
        }
      }
    } catch (e) {
      // Bỏ qua nếu mạng bận
    }
  };

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const lat = initialLat || selectedLat || 21.0285;
      const lng = initialLng || selectedLng || 105.8542;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView([lat, lng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current = marker;

        // Bắt sự kiện kéo ghim
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setSelectedLat(pos.lat);
          setSelectedLng(pos.lng);
          reverseGeocode(pos.lat, pos.lng);
        });

        // Bắt sự kiện click vào bất kỳ đâu trên bản đồ
        map.on('click', (e: L.LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          setSelectedLat(e.latlng.lat);
          setSelectedLng(e.latlng.lng);
          reverseGeocode(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.setView([lat, lng], 15);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        }
      }

      reverseGeocode(lat, lng);
    }, 200);

    return () => {
      clearTimeout(timer);
    };
  }, [open, initialLat, initialLng]);

  // Hủy bản đồ khi đóng modal
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [open]);

  // Lấy vị trí GPS hiện tại của thiết bị
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.error('Trình duyệt của bạn không hỗ trợ định vị GPS!');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSelectedLat(lat);
        setSelectedLng(lng);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 17);
          markerRef.current.setLatLng([lat, lng]);
        }
        reverseGeocode(lat, lng);
        message.success('Đã lấy vị trí GPS hiện tại thành công!');
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        message.warning('Không thể lấy vị trí GPS (vui lòng cấp quyền truy cập vị trí trên trình duyệt).');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tìm kiếm địa điểm theo tên
  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'vi' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setSelectedLat(lat);
          setSelectedLng(lng);
          setAddressPreview(data[0].display_name);

          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 16);
            markerRef.current.setLatLng([lat, lng]);
          }
          message.success('Đã tìm thấy vị trí!');
        } else {
          message.warning('Không tìm thấy địa điểm phù hợp, vui lòng thử lại từ khóa khác.');
        }
      }
    } catch (e) {
      message.error('Lỗi khi tìm kiếm địa chỉ!');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    onSelectLocation(selectedLat, selectedLng, addressPreview);
    message.success('Đã áp dụng tọa độ vị trí thành công!');
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2 text-gray-900 font-bold text-base">
          <MapPin size={20} className="text-red-600" />
          <span>{title}</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Đóng
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<Check size={16} />}
          onClick={handleConfirm}
          className="bg-red-600 hover:bg-red-700 font-bold"
        >
          Xác nhận vị trí này
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-3 py-2">
        {/* Thanh tìm kiếm & Nút GPS */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input.Search
            placeholder="Tìm kiếm địa chỉ, tên đường, phố..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearchLocation}
            loading={isSearching}
            className="flex-1"
          />
          <Button
            icon={<Crosshair size={16} />}
            onClick={handleGetCurrentLocation}
            loading={isLocating}
            className="flex items-center justify-center font-semibold text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            Lấy vị trí GPS hiện tại
          </Button>
        </div>

        {/* Khung bản đồ tương tác */}
        <div className="relative rounded-xl overflow-hidden border border-gray-300 shadow-inner h-[380px]">
          <div ref={mapContainerRef} className="w-full h-full z-0" />
          <div className="absolute top-2 right-2 z-[400] bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-lg shadow-sm text-[11px] text-gray-600 border border-gray-200">
            Click hoặc kéo ghim để định vị chính xác
          </div>
        </div>

        {/* Thông tin tọa độ và địa chỉ ước lượng */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-gray-700">Tọa độ đã chọn:</span>
            <div className="space-x-2 font-mono font-bold text-red-600">
              <Tag color="red">Vĩ độ (Lat): {selectedLat.toFixed(6)}</Tag>
              <Tag color="blue">Kinh độ (Lng): {selectedLng.toFixed(6)}</Tag>
            </div>
          </div>
          {addressPreview && (
            <div className="text-gray-600">
              <span className="font-semibold text-gray-700">Địa chỉ gợi ý: </span>
              <span>{addressPreview}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
