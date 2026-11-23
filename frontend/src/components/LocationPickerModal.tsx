import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, message, Tag, Segmented } from 'antd';
import { MapPin, Check, Crosshair, Layers, ExternalLink, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix icon Leaflet mặc định
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Hàm hỗ trợ nhận diện địa chỉ từ tọa độ (Reverse Geocode)
export const reverseGeocodeAddress = async (lat: number, lng: number): Promise<string> => {
  // 1. Thử Photon Geocoder (rất chi tiết cho Việt Nam)
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`, {
      headers: { 'Accept-Language': 'vi' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.features?.[0]?.properties) {
        const p = data.features[0].properties;
        const parts: string[] = [];

        if (p.housenumber && p.street) parts.push(`Số ${p.housenumber} ${p.street}`);
        else if (p.name && p.street) parts.push(`${p.name}, ${p.street}`);
        else if (p.street) parts.push(p.street);
        else if (p.name) parts.push(p.name);

        if (p.locality && !parts.includes(p.locality)) parts.push(p.locality);
        if (p.district && !parts.includes(p.district)) parts.push(p.district);
        if (p.city && !parts.includes(p.city)) parts.push(p.city);

        if (parts.length > 0) return parts.join(', ');
      }
    }
  } catch (e) {
    // Thử dịch vụ dự phòng bên dưới
  }

  // 2. Thử BigDataCloud Client API (miễn phí, không bao giờ bị chặn)
  try {
    const res2 = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`
    );
    if (res2.ok) {
      const data2 = await res2.json();
      const parts: string[] = [];
      if (data2.locality) parts.push(data2.locality);
      if (data2.city && data2.city !== data2.locality) parts.push(data2.city);
      if (data2.principalSubdivision && !parts.includes(data2.principalSubdivision)) {
        parts.push(data2.principalSubdivision);
      }
      if (parts.length > 0) return parts.join(', ');
    }
  } catch (e) {
    // fallback
  }

  return `Tọa độ: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

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
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  // Mặc định Hà Nội (21.0285, 105.8542) nếu chưa có tọa độ
  const [selectedLat, setSelectedLat] = useState<number>(initialLat || 21.0285);
  const [selectedLng, setSelectedLng] = useState<number>(initialLng || 105.8542);
  const [addressPreview, setAddressPreview] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [mapType, setMapType] = useState<'google' | 'satellite' | 'carto'>('google');

  // Đổi nguồn bản đồ Tile Layer
  const updateMapLayer = (type: 'google' | 'satellite' | 'carto', map: L.Map) => {
    if (activeTileLayerRef.current) {
      map.removeLayer(activeTileLayerRef.current);
    }

    let layer: L.TileLayer;
    if (type === 'satellite') {
      // Vệ tinh Google Maps Hybrid (kèm tên đường tiếng Việt)
      layer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: '&copy; Google Maps Vệ Tinh',
      });
    } else if (type === 'carto') {
      // Bản đồ CartoDB Voyager
      layer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        attribution: '&copy; CartoDB',
      });
    } else {
      // Mặc định: Google Maps đường sá chuẩn hiển thị tên đường tiếng Việt cực kỳ rõ nét
      layer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: '&copy; Google Maps',
      });
    }

    layer.addTo(map);
    activeTileLayerRef.current = layer;
  };

  const handleUpdateAddress = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    const addr = await reverseGeocodeAddress(lat, lng);
    setAddressPreview(addr);
    setIsGeocoding(false);
  };

  // Khởi tạo bản đồ Leaflet
  useEffect(() => {
    if (!open) return;

    const lat = initialLat || selectedLat || 21.0285;
    const lng = initialLng || selectedLng || 105.8542;
    setSelectedLat(lat);
    setSelectedLng(lng);

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
        }).setView([lat, lng], 16);

        L.control.zoom({ position: 'topright' }).addTo(map);

        updateMapLayer(mapType, map);

        const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        markerRef.current = marker;

        // Kéo thả ghim
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          setSelectedLat(pos.lat);
          setSelectedLng(pos.lng);
          handleUpdateAddress(pos.lat, pos.lng);
        });

        // Click trên bản đồ để di chuyển ghim
        map.on('click', (e: L.LeafletMouseEvent) => {
          marker.setLatLng(e.latlng);
          setSelectedLat(e.latlng.lat);
          setSelectedLng(e.latlng.lng);
          handleUpdateAddress(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.setView([lat, lng], 16);
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        }
      }

      // Xử lý render kích thước nhiều lần tránh lỗi màn hình xám do animation Modal
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
        setTimeout(() => mapInstanceRef.current?.invalidateSize(), 500);
      }

      handleUpdateAddress(lat, lng);
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [open, initialLat, initialLng]);

  // Thay đổi loại bản đồ
  const handleMapTypeChange = (val: 'google' | 'satellite' | 'carto') => {
    setMapType(val);
    if (mapInstanceRef.current) {
      updateMapLayer(val, mapInstanceRef.current);
    }
  };

  // Hủy bản đồ khi đóng modal
  useEffect(() => {
    if (!open && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      activeTileLayerRef.current = null;
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
          mapInstanceRef.current.invalidateSize();
        }
        handleUpdateAddress(lat, lng);
        message.success('Đã định vị vị trí GPS hiện tại thành công!');
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        message.warning('Không thể lấy vị trí GPS (vui lòng bật cấp quyền vị trí trên trình duyệt).');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Tìm kiếm địa điểm theo tên với Photon
  const handleSearchLocation = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=1`,
        { headers: { 'Accept-Language': 'vi' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.features && data.features.length > 0) {
          const coords = data.features[0].geometry.coordinates;
          const lng = coords[0];
          const lat = coords[1];
          setSelectedLat(lat);
          setSelectedLng(lng);

          const p = data.features[0].properties;
          const name = p.name || p.street || searchQuery;
          setAddressPreview(name);

          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 17);
            markerRef.current.setLatLng([lat, lng]);
            mapInstanceRef.current.invalidateSize();
          }
          message.success(`Đã tìm thấy: ${name}`);
        } else {
          message.warning('Không tìm thấy địa điểm, vui lòng thử tên đường/quận huyện khác.');
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
    message.success('Đã cập nhật vị trí và điền địa chỉ chi tiết thành công!');
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
      width={760}
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
      <div className="space-y-3 py-1">
        {/* Thanh tìm kiếm & Nút GPS & Chuyển loại bản đồ */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <Input.Search
            placeholder="Tìm địa chỉ (VD: 15 Duy Tân, Cầu Giấy...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={handleSearchLocation}
            loading={isSearching}
            className="flex-1"
          />

          <div className="flex items-center space-x-2">
            <Button
              icon={<Crosshair size={15} />}
              onClick={handleGetCurrentLocation}
              loading={isLocating}
              className="flex items-center justify-center font-semibold text-red-600 border-red-300 hover:bg-red-50 text-xs h-8"
            >
              GPS hiện tại
            </Button>

            <Segmented
              value={mapType}
              onChange={(val) => handleMapTypeChange(val as any)}
              options={[
                { label: 'Google Maps', value: 'google' },
                { label: 'Vệ tinh', value: 'satellite' },
                { label: 'Carto', value: 'carto' },
              ]}
              size="small"
              className="bg-gray-100 font-medium"
            />
          </div>
        </div>

        {/* Khung bản đồ Google Maps / Leaflet tương tác */}
        <div className="relative rounded-2xl overflow-hidden border-2 border-red-400 shadow-md h-[400px] w-full bg-gray-100">
          <div
            ref={mapContainerRef}
            className="w-full h-full"
            style={{ minHeight: '400px', width: '100%', height: '100%' }}
          />

          <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-lg shadow-sm text-xs text-gray-700 font-semibold border border-gray-200 pointer-events-none flex items-center space-x-1.5">
            <MapPin size={14} className="text-red-600" />
            <span>Click hoặc kéo thả ghim đỏ để chọn vị trí chính xác</span>
          </div>

          <div className="absolute bottom-2 left-2 z-[400]">
            <a
              href={`https://www.google.com/maps?q=${selectedLat},${selectedLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-bold text-blue-600 hover:text-blue-800 shadow-xs border border-gray-200 flex items-center space-x-1"
            >
              <span>Mở Google Maps</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* Thông tin tọa độ và địa chỉ chi tiết tự động nhận diện */}
        <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 text-xs space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 font-bold text-gray-800">
              <span>Địa chỉ chi tiết nhận diện được:</span>
              {isGeocoding && <Loader2 size={13} className="animate-spin text-red-600" />}
            </div>
            <div className="space-x-1.5 font-mono font-bold text-red-600">
              <Tag color="red">Lat: {selectedLat.toFixed(6)}</Tag>
              <Tag color="blue">Lng: {selectedLng.toFixed(6)}</Tag>
            </div>
          </div>

          <div className="text-gray-800 font-semibold bg-white p-2.5 rounded-lg border border-red-200 text-sm">
            {addressPreview ? (
              <span>{addressPreview}</span>
            ) : (
              <span className="text-gray-400 italic">Đang phân tích địa chỉ từ tọa độ GPS...</span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 italic">
            * Khi bấm "Xác nhận vị trí này", địa chỉ trên sẽ tự động được điền vào ô địa chỉ chi tiết của đơn hàng.
          </p>
        </div>
      </div>
    </Modal>
  );
};
