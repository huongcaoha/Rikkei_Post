import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button, Input, Radio, Typography, Space, message, Alert, Spin } from 'antd';
import {
  CheckCircle2,
  Camera,
  PenTool,
  RotateCcw,
  ShieldAlert,
  Send,
  CreditCard,
  Banknote,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import dayjs from 'dayjs';
import { Order, CompleteDeliveryRequest } from '../types';
import { shipperApi } from '../api/shipper';

const { Text } = Typography;

interface PodModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
  onOpenVietQr?: () => void;
}

export const PodModal: React.FC<PodModalProps> = ({
  visible,
  order,
  onClose,
  onSuccess,
  onOpenVietQr,
}) => {
  const [receiverName, setReceiverName] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'VIETQR'>('CASH');
  const [otpCode, setOtpCode] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ lat?: number; lng?: number }>({});
  const [fetchingGps, setFetchingGps] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);

  // Canvas chữ ký điện tử
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasSignature, setHasSignature] = useState<boolean>(false);

  useEffect(() => {
    if (order && visible) {
      setReceiverName(order.receiverName || '');
      setNotes('');
      setOtpCode('');
      setPhotoUrl('');
      setHasSignature(false);

      // Tự động lấy tọa độ GPS hiện tại của thiết bị shipper
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
              lat: order.receiverLat || 21.028511,
              lng: order.receiverLng || 105.854444,
            });
            setFetchingGps(false);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      }

      // Xóa canvas khi mở modal
      setTimeout(() => {
        clearSignature();
      }, 100);
    }
  }, [order, visible]);

  // Bộ đếm gửi lại OTP
  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  if (!order) return null;

  // Kiểm tra đơn giá trị cao (> 2 triệu VNĐ)
  const isHighValue = (order.itemValue && order.itemValue >= 2000000) || (order.codAmount && order.codAmount >= 2000000);

  // Vẽ chữ ký
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1e3a8a'; // Blue ink
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // Đóng dấu Watermark GPS lên ảnh hiện trường
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
        const barHeight = Math.max(70, Math.floor(img.height * 0.16));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.70)';
        ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

        const fontSize = Math.max(16, Math.floor(barHeight / 4.2));
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = '#ffffff';

        const timeStr = dayjs().format('HH:mm:ss DD/MM/YYYY');
        const lat = gpsCoords.lat ? gpsCoords.lat.toFixed(6) : (order.receiverLat?.toFixed(6) || '21.028511');
        const lng = gpsCoords.lng ? gpsCoords.lng.toFixed(6) : (order.receiverLng?.toFixed(6) || '105.854444');

        ctx.fillText(`📦 Vận đơn: ${order.trackingCode} | Khách nhận: ${receiverName || order.receiverName}`, 24, img.height - barHeight + fontSize + 10);
        ctx.fillText(`⏰ Thời gian: ${timeStr} | 📍 GPS: ${lat}, ${lng}`, 24, img.height - barHeight + fontSize * 2 + 18);
        ctx.fillStyle = '#f87171'; // red accent
        ctx.fillText(`🛡️ Rikkei_Post Logistics Proof of Delivery (POD Verified)`, 24, img.height - barHeight + fontSize * 3 + 26);

        setPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
        message.success('Đã chụp và đóng dấu Watermark GPS thành công!');
      };
      img.src = rawBase64;
    };
    reader.readAsDataURL(file);
  };

  // Gửi OTP cho đơn giá trị cao
  const handleSendOtp = async () => {
    try {
      const res = await shipperApi.sendOtp(order.trackingCode);
      message.success(`Đã kích hoạt OTP! Mã test nhanh: ${res.otpCode}`);
      setOtpSent(true);
      setOtpCountdown(60);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể sinh mã OTP!');
    }
  };

  // Hoàn tất giao hàng
  const handleComplete = async () => {
    if (isHighValue && !otpCode.trim()) {
      message.error('Đơn hàng giá trị cao bắt buộc phải nhập mã xác thực OTP 6 số!');
      return;
    }

    let signatureBase64: string | undefined = undefined;
    if (canvasRef.current && hasSignature) {
      signatureBase64 = canvasRef.current.toDataURL('image/png');
    }

    setSubmitting(true);
    try {
      const payload: CompleteDeliveryRequest = {
        trackingCode: order.trackingCode,
        receiverName: receiverName.trim() || order.receiverName,
        podSignatureUrl: signatureBase64,
        podPhotoUrl: photoUrl || undefined,
        podLatitude: gpsCoords.lat,
        podLongitude: gpsCoords.lng,
        otpCode: otpCode.trim() || undefined,
        paymentMethod,
        notes: notes.trim() || undefined,
      };

      await shipperApi.completeDelivery(payload);
      message.success('Giao hàng thành công! Đã lưu bằng chứng POD an toàn.');
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi hoàn tất giao hàng!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      title={
        <div className="flex items-center space-x-2 text-green-700">
          <CheckCircle2 size={22} />
          <span className="font-bold text-lg">Bằng Chứng Giao Hàng POD (Proof of Delivery)</span>
        </div>
      }
    >
      <div className="space-y-3.5 py-1">
        {/* Header thông tin bưu gửi */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3">
          <div className="flex justify-between items-center text-xs text-gray-700 mb-1">
            <span>Mã bưu gửi: <b className="font-mono text-blue-700">{order.trackingCode}</b></span>
            <span>Hàng: <b className="text-gray-900">{order.itemName}</b></span>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-700">
            <span>Khách: <b>{order.receiverName}</b> ({order.receiverPhone})</span>
            <span>Thu hộ COD: <b className="text-red-600 font-bold">{order.codAmount?.toLocaleString('vi-VN')} đ</b></span>
          </div>
        </div>

        {/* Khung OTP cho Đơn Giá Trị Cao */}
        {isHighValue && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 space-y-2">
            <div className="flex items-center space-x-1.5 text-amber-800 font-bold text-xs">
              <ShieldAlert size={16} className="text-amber-600" />
              <span>ĐƠN HÀNG GIÁ TRỊ CAO (YÊU CẦU MÃ XÁC THỰC OTP)</span>
            </div>
            <p className="text-xs text-amber-900">
              Đơn hàng có giá trị &gt; 2.000.000 đ. Vui lòng hỏi mã OTP 6 số từ người nhận để xác thực.
            </p>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Nhập 6 số OTP..."
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="font-mono text-center tracking-widest font-bold text-base w-40"
              />
              <Button
                type="dashed"
                onClick={handleSendOtp}
                disabled={otpCountdown > 0}
                icon={<Send size={14} />}
                className="text-xs"
              >
                {otpCountdown > 0 ? `Gửi lại (${otpCountdown}s)` : 'Gửi mã OTP'}
              </Button>
            </div>
          </div>
        )}

        {/* Người ký nhận & Hình thức thanh toán */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Người thực tế nhận hàng (*):
            </label>
            <Input
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Họ tên người nhận..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Hình thức thanh toán:
            </label>
            <Radio.Group
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full flex space-x-2"
            >
              <Radio.Button value="CASH" className="text-xs font-medium">
                💵 Tiền mặt
              </Radio.Button>
              <Radio.Button
                value="VIETQR"
                className="text-xs font-medium"
                onClick={() => {
                  if (onOpenVietQr) onOpenVietQr();
                }}
              >
                📲 VietQR
              </Radio.Button>
            </Radio.Group>
          </div>
        </div>

        {/* Khung Ký tên Cảm ứng Điện tử (Canvas Signature Pad) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
              <PenTool size={14} className="text-blue-600" />
              <span>Chữ ký cảm ứng của Người nhận:</span>
            </label>
            <Button
              type="link"
              size="small"
              icon={<RotateCcw size={12} />}
              onClick={clearSignature}
              className="text-xs text-gray-500 hover:text-red-500 p-0"
            >
              Xóa ký lại
            </Button>
          </div>
          <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 p-1 touch-none">
            <canvas
              ref={canvasRef}
              width={480}
              height={140}
              className="w-full h-32 bg-white rounded-lg cursor-crosshair shadow-inner"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <div className="text-[11px] text-gray-400 text-center mt-1">
              Khách hàng ký trực tiếp bằng tay hoặc bút cảm ứng vào khung trên
            </div>
          </div>
        </div>

        {/* Chụp ảnh hiện trường có dấu Watermark GPS */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-xs font-bold text-gray-700 flex items-center space-x-1">
              <Camera size={14} className="text-green-600" />
              <span>Ảnh chụp hiện trường (Đóng dấu Watermark GPS):</span>
            </label>
            {gpsCoords.lat && (
              <span className="text-[11px] text-green-700 font-mono">
                📍 {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng?.toFixed(4)}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              id="podPhotoInput"
              className="hidden"
              onChange={handlePhotoCapture}
            />
            <label
              htmlFor="podPhotoInput"
              className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-green-500 p-2.5 rounded-xl flex items-center space-x-2 text-xs text-gray-600 bg-gray-50 hover:bg-green-50 w-full justify-center font-medium"
            >
              <Camera size={18} className="text-green-600" />
              <span>{photoUrl ? 'Chụp lại ảnh hiện trường' : 'Chụp ảnh kiện hàng & cổng nhà'}</span>
            </label>
          </div>
          {photoUrl && (
            <div className="mt-2 relative rounded-xl overflow-hidden border border-gray-200">
              <img src={photoUrl} alt="POD Watermark" className="w-full max-h-48 object-cover rounded-lg" />
              <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                ✓ Đã đóng dấu GPS & Thời gian
              </div>
            </div>
          )}
        </div>

        {/* Ghi chú thêm */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Ghi chú giao hàng:
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ví dụ: Đã gửi cho bảo vệ chung cư, khách kiểm tra nguyên seal..."
          />
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end space-x-2 pt-2 border-t">
          <Button onClick={onClose} size="large">
            Đóng
          </Button>
          <Button
            type="primary"
            size="large"
            loading={submitting}
            onClick={handleComplete}
            icon={<CheckCircle2 size={18} />}
            className="bg-green-600 hover:bg-green-700 font-bold px-6"
          >
            Xác Nhận Đã Giao POD
          </Button>
        </div>
      </div>
    </Modal>
  );
};
