import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input, Typography, Space, message, Alert, Spin, Tag } from 'antd';
import {
  RotateCcw,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Store,
  MapPin,
  Clock,
  User,
  FileText,
  Upload,
} from 'lucide-react';
import dayjs from 'dayjs';
import { Order, CompleteReturnRequest } from '../types';
import { shipperApi } from '../api/shipper';

const { Text } = Typography;

interface ReturnProofModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnProofModal: React.FC<ReturnProofModalProps> = ({
  visible,
  order,
  onClose,
  onSuccess,
}) => {
  const [receiverName, setReceiverName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ lat?: number; lng?: number }>({});
  const [fetchingGps, setFetchingGps] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (order && visible) {
      setReceiverName(order.senderName || 'Chủ Shop / Người gửi');
      setNotes('');
      setPhotoUrl('');

      // Tự động lấy tọa độ GPS hiện trường khi mở modal
      if (navigator.geolocation) {
        setFetchingGps(true);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGpsCoords({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            setFetchingGps(false);
          },
          (err) => {
            console.warn('Không lấy được GPS tự động:', err.message);
            setGpsCoords({
              lat: order.senderLat || 20.972013,
              lng: order.senderLng || 105.757442,
            });
            setFetchingGps(false);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }
    }
  }, [order, visible]);

  if (!order) return null;

  // Xử lý chụp ảnh & đóng dấu Watermark GPS lên ảnh hiện trường bàn giao hàng hoàn
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const rawBase64 = uploadEvent.target?.result as string;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setPhotoUrl(rawBase64);
          return;
        }

        // Vẽ ảnh gốc
        ctx.drawImage(img, 0, 0);

        // Đóng dấu Watermark banner ở đáy ảnh
        const barHeight = Math.max(75, Math.floor(img.height * 0.17));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

        const fontSize = Math.max(16, Math.floor(barHeight / 4.2));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';

        const timeStr = dayjs().format('HH:mm:ss DD/MM/YYYY');
        const lat = gpsCoords.lat ? gpsCoords.lat.toFixed(6) : (order.senderLat?.toFixed(6) || '20.972013');
        const lng = gpsCoords.lng ? gpsCoords.lng.toFixed(6) : (order.senderLng?.toFixed(6) || '105.757442');

        ctx.fillText(
          `🔄 HOÀN TRẢ HÀNG CHO SHOP | Vận đơn: ${order.trackingCode}`,
          24,
          img.height - barHeight + fontSize + 10
        );
        ctx.fillText(
          `🏪 Đại diện Shop nhận: ${receiverName || order.senderName} (${order.senderPhone || ''})`,
          24,
          img.height - barHeight + fontSize * 2 + 18
        );
        ctx.fillText(
          `⏰ Thời gian: ${timeStr} | 📍 GPS: ${lat}, ${lng}`,
          24,
          img.height - barHeight + fontSize * 3 + 26
        );

        const watermarkedBase64 = canvas.toDataURL('image/jpeg', 0.88);
        setPhotoUrl(watermarkedBase64);
        message.success('Đã chụp ảnh hiện trường và đóng dấu Watermark thành công!');
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    // Kiểm tra bắt buộc phải có ảnh chụp bằng chứng
    if (!photoUrl) {
      message.error('Bắt buộc phải chụp ảnh kiện hàng bàn giao cho Shop làm bằng chứng hoàn hàng!');
      return;
    }

    setSubmitting(true);
    try {
      const payload: CompleteReturnRequest = {
        trackingCode: order.trackingCode,
        proofPhotoUrl: photoUrl,
        receiverName: receiverName.trim() || order.senderName,
        notes: notes.trim() || undefined,
        latitude: gpsCoords.lat,
        longitude: gpsCoords.lng,
      };

      await shipperApi.completeReturn(payload);
      message.success(`Đã hoàn trả thành công đơn hàng [${order.trackingCode}] cho Shop! Bằng chứng đã được lưu an toàn.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Lỗi khi hoàn trả hàng cho Shop';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center space-x-2 text-amber-700 py-1">
          <RotateCcw size={22} className="text-amber-600" />
          <span className="text-base font-black">Xác Nhận Hoàn Hàng Cho Shop / Người Gửi</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={560}
      className="rounded-3xl overflow-hidden"
    >
      <div className="space-y-4 pt-2">
        {/* Thông tin đơn hàng & Shop nhận hoàn */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 text-xs">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-gray-700">Mã vận đơn bưu chính:</span>
            <span className="font-mono font-black text-red-600 text-sm">{order.trackingCode}</span>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
            <div className="flex items-start gap-1.5">
              <Store size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-500">Shop / Người gửi nhận hoàn: </span>
                <span className="font-bold text-gray-900">{order.senderName}</span>
                {order.senderPhone && <span className="text-gray-600 font-mono ml-1">({order.senderPhone})</span>}
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <MapPin size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-500">Địa chỉ Shop: </span>
                <span className="font-semibold text-gray-800">{order.senderAddress}</span>
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <FileText size={15} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-gray-500">Nội dung kiện hàng: </span>
                <span className="font-semibold text-gray-800">{order.itemName} ({order.billableWeightGram}g)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Input Người đại diện Shop nhận lại hàng */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
            <User size={14} className="text-gray-500" />
            Tên người đại diện Shop nhận lại hàng:
          </label>
          <Input
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            placeholder="Nhập tên người đại diện Shop nhận kiện hàng"
            className="rounded-xl text-xs font-semibold"
          />
        </div>

        {/* CHỤP ẢNH BẰNG CHỨNG HIỆN TRƯỜNG (BẮT BUỘC THEO YÊU CẦU CỦA USER) */}
        <div>
          <label className="block text-xs font-bold text-gray-800 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1 text-red-600">
              <Camera size={14} />
              Ảnh chụp bằng chứng bàn giao hàng cho Shop (* Bắt buộc):
            </span>
            {photoUrl ? (
              <Tag color="green" className="text-[10px] font-bold">✓ ĐÃ CÓ ẢNH CHỨNG MINH</Tag>
            ) : (
              <Tag color="red" className="text-[10px] font-bold">CHƯA CHỤP ẢNH</Tag>
            )}
          </label>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
            className="hidden"
          />

          {!photoUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/40 hover:bg-amber-50/80 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shadow-sm">
                <Camera size={24} />
              </div>
              <div className="text-xs font-bold text-amber-900">
                Bấm vào đây để Bật Camera chụp ảnh hiện trường
              </div>
              <div className="text-[11px] text-gray-500">
                Hệ thống sẽ tự động đóng dấu Watermark mã vận đơn, ngày giờ và tọa độ GPS
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm max-h-56 bg-black flex items-center justify-center">
                <img
                  src={photoUrl}
                  alt="Ảnh bằng chứng hoàn hàng"
                  className="max-h-56 w-auto object-contain mx-auto"
                />
              </div>
              <Button
                size="small"
                icon={<Camera size={14} />}
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-xs font-semibold rounded-xl text-amber-700 border-amber-300 hover:border-amber-500"
              >
                Chụp lại ảnh khác
              </Button>
            </div>
          )}
        </div>

        {/* Ghi chú hoàn trả */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Ghi chú khi hoàn trả (Tùy chọn):
          </label>
          <Input.TextArea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú thêm về tình trạng kiện hàng hoàn (ví dụ: Shop đã kiểm tra còn nguyên tem phong bì...)"
            className="rounded-xl text-xs"
          />
        </div>

        {/* Nút hành động */}
        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
          <Button onClick={onClose} disabled={submitting} className="rounded-xl text-xs font-semibold">
            Đóng
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!photoUrl}
            className={`rounded-xl text-xs font-bold px-5 shadow-md h-9 ${
              photoUrl
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-gray-300 text-gray-500 border-none cursor-not-allowed'
            }`}
          >
            {photoUrl ? '✓ Xác Nhận Đã Hoàn Hàng Cho Shop' : 'Cần chụp ảnh để xác nhận'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
