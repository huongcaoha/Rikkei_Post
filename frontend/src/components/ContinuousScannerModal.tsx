import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, Tag, Segmented, message } from 'antd';
import {
  Scan,
  Camera,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Truck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { shipperApi } from '../api/shipper';
import { Order } from '../types';

interface ContinuousScannerModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: 'PICKUP' | 'INBOUND' | 'DELIVERY';
  canInbound?: boolean;
  canPickup?: boolean;
  canDelivery?: boolean;
  onOrderUpdated?: () => void;
}

interface PopupFeedback {
  type: 'SUCCESS' | 'WARNING' | 'ERROR';
  title?: string;
  message: string;
}

export const ContinuousScannerModal: React.FC<ContinuousScannerModalProps> = ({
  open,
  onClose,
  defaultMode = 'PICKUP',
  canInbound = false,
  canPickup = true,
  canDelivery = true,
  onOrderUpdated,
}) => {
  const [scanMode, setScanMode] = useState<'PICKUP' | 'INBOUND' | 'DELIVERY'>(defaultMode);
  // Yêu cầu: Mặc định là quét mã bằng CAMERA
  const [inputMode, setInputMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Popup thông báo kết quả (Thành công hoặc Lỗi có nút OK)
  const [popupFeedback, setPopupFeedback] = useState<PopupFeedback | null>(null);

  const manualInputRef = useRef<any>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const isPopupOpenRef = useRef<boolean>(false);

  // Đồng bộ ref trạng thái popup để chặn quét camera khi popup đang mở
  useEffect(() => {
    isPopupOpenRef.current = !!popupFeedback;
  }, [popupFeedback]);

  // Cập nhật chế độ mặc định khi mở modal
  useEffect(() => {
    if (open) {
      setScanMode(defaultMode);
      // Luôn đặt mặc định là CAMERA khi mở
      setInputMode('CAMERA');
      setBarcodeInput('');
      setPopupFeedback(null);
      lastScannedCodeRef.current = '';
    } else {
      stopCamera();
    }
  }, [open, defaultMode]);

  // Điều khiển camera khi chuyển tab Camera / Nhập tay
  useEffect(() => {
    if (open && inputMode === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
      if (open && inputMode === 'MANUAL') {
        setTimeout(() => {
          manualInputRef.current?.focus();
        }, 200);
      }
    }
    return () => {
      stopCamera();
    };
  }, [open, inputMode]);

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

  const startCamera = async () => {
    try {
      if (html5QrCodeRef.current) {
        await stopCamera();
      }
      // Chờ một chút để container DOM sẵn sàng
      await new Promise((resolve) => setTimeout(resolve, 250));
      const container = document.getElementById('qr-reader-container');
      if (!container) return;

      const qrCode = new Html5Qrcode('qr-reader-container');
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
            cameras.find((c) =>
              c.label.toLowerCase().includes('back') ||
              c.label.toLowerCase().includes('sau') ||
              c.label.toLowerCase().includes('environment')
            ) || cameras[cameras.length - 1];
          await qrCode.start(
            backCam.id,
            config,
            (decodedText) => handleCameraDecoded(decodedText),
            () => {}
          );
        } else {
          await qrCode.start(
            { facingMode: 'environment' },
            config,
            (decodedText) => handleCameraDecoded(decodedText),
            () => {}
          );
        }
      } catch (camErr) {
        await qrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => handleCameraDecoded(decodedText),
          () => {}
        );
      }
    } catch (err: any) {
      console.warn('Lỗi khởi động camera live:', err);
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
  };

  // Xử lý khi camera phát hiện mã
  const handleCameraDecoded = (decodedText: string) => {
    // Nếu đang xử lý hoặc đang có Popup mở -> Không quét tiếp
    if (isProcessing || isPopupOpenRef.current) {
      return;
    }

    const cleanCode = decodedText.trim().toUpperCase();
    const now = Date.now();
    // Chặn quét lặp cùng 1 mã trong vòng 2 giây
    if (cleanCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2000) {
      return;
    }
    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;
    processBarcode(cleanCode);
  };

  // Xử lý mã vận đơn (Gọi API và hiển thị Popup thông báo thành công hoặc lỗi)
  const processBarcode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng nhập mã vận đơn!');
      return;
    }

    setIsProcessing(true);

    try {
      let updatedOrder: Order;
      let successMsg = '';

      if (scanMode === 'PICKUP') {
        updatedOrder = await shipperApi.scanPickup(code);
        successMsg = `Đã lấy hàng thành công đơn [${code}] từ Shop!`;
      } else if (scanMode === 'DELIVERY') {
        updatedOrder = await shipperApi.scanDelivery(code);
        successMsg = `Đã xuất kho lấy đơn [${code}] mang đi giao thành công!`;
      } else {
        updatedOrder = await shipperApi.scanInbound(code);
        successMsg = `Đã nhập kho bưu cục thành công đơn [${code}]!`;
      }

      playSound(true);

      // Hiển thị Popup thành công kèm nút OK
      let successTitle = 'Nhập Kho Thành Công';
      if (scanMode === 'PICKUP') successTitle = 'Lấy Hàng Thành Công';
      else if (scanMode === 'DELIVERY') successTitle = 'Xuất Kho Đi Giao Thành Công';

      setPopupFeedback({
        type: 'SUCCESS',
        title: successTitle,
        message: successMsg,
      });

      // Báo bên ngoài cập nhật lại danh sách đơn hàng
      onOrderUpdated?.();
    } catch (err: any) {
      playSound(false);
      const errMsg = err.response?.data?.message || err.message || 'Lỗi xử lý đơn hàng!';

      // Hiển thị Popup lỗi/cảnh báo kèm nút OK
      setPopupFeedback({
        type: 'ERROR',
        title: 'Thông Báo',
        message: errMsg,
      });
    } finally {
      setIsProcessing(false);
      setBarcodeInput('');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      processBarcode(barcodeInput);
    }
  };

  const getHeaderTitle = () => {
    if (scanMode === 'DELIVERY') return 'Quét Xuất Kho Lấy Đơn Đi Giao';
    if (scanMode === 'PICKUP') return 'Quét Mã Lấy Hàng Tại Shop';
    return 'Quét Mã Nhập Kho Bưu Cục';
  };

  const getHeaderColor = () => {
    if (scanMode === 'DELIVERY') return 'bg-blue-600';
    if (scanMode === 'PICKUP') return 'bg-amber-600';
    return 'bg-red-600';
  };

  // Các chế độ quét khả dụng
  const modeOptions = [];
  if (canPickup) {
    modeOptions.push({ label: 'Lấy hàng tại Shop', value: 'PICKUP', icon: <Truck size={14} /> });
  }
  if (canDelivery) {
    modeOptions.push({ label: 'Lấy đơn đi giao', value: 'DELIVERY', icon: <Scan size={14} /> });
  }
  if (canInbound) {
    modeOptions.push({ label: 'Nhập kho bưu cục', value: 'INBOUND', icon: <Building2 size={14} /> });
  }

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        footer={null}
        destroyOnClose
        width={560}
        className="continuous-scanner-modal"
        title={
          <div className="flex items-center justify-between pr-6 border-b pb-3">
            <div className="flex items-center space-x-2 text-base font-bold text-gray-900">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${getHeaderColor()}`}>
                <Scan size={18} />
              </div>
              <span>{getHeaderTitle()}</span>
            </div>

            <Button
              type="text"
              size="small"
              icon={isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              onClick={() => setIsMuted(!isMuted)}
              className="text-gray-400 hover:text-gray-700"
              title={isMuted ? 'Bật âm thanh bíp' : 'Tắt âm thanh'}
            />
          </div>
        }
      >
        <div className="pt-2 space-y-4">
          {/* Lựa chọn vai trò / chế độ quét */}
          {modeOptions.length > 1 && (
            <div className="bg-gray-50 p-2 rounded-xl flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 ml-1">Chế độ quét:</span>
              <Segmented
                value={scanMode}
                onChange={(val) => setScanMode(val as any)}
                options={modeOptions}
                className="font-medium text-xs bg-white shadow-xs"
              />
            </div>
          )}

          {/* ĐÚNG 2 TAB THEO YÊU CẦU: 1. Quét mã bằng camera (mặc định) & 2. Nhập mã bằng tay */}
          <div className="flex items-center bg-gray-100 p-1.5 rounded-xl">
            <Button
              type={inputMode === 'CAMERA' ? 'primary' : 'text'}
              icon={<Camera size={16} />}
              onClick={() => setInputMode('CAMERA')}
              className={`flex-1 rounded-lg text-xs font-bold h-9 transition-all ${
                inputMode === 'CAMERA' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xs' : 'text-gray-600'
              }`}
            >
              Quét mã bằng camera
            </Button>
            <Button
              type={inputMode === 'MANUAL' ? 'primary' : 'text'}
              icon={<Barcode size={16} />}
              onClick={() => setInputMode('MANUAL')}
              className={`flex-1 rounded-lg text-xs font-bold h-9 transition-all ${
                inputMode === 'MANUAL' ? 'bg-gray-900 hover:bg-black text-white shadow-xs' : 'text-gray-600'
              }`}
            >
              Nhập mã bằng tay
            </Button>
          </div>

          {/* TAB 1: Quét mã bằng camera (Mặc định) */}
          {inputMode === 'CAMERA' && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-red-500 shadow-md">
                <div id="qr-reader-container" className="w-full h-full" />
                {/* Khung ngắm quét mã vạch */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-36 border-2 border-dashed border-red-400 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-red-500 shadow-lg animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Nhập mã bằng tay */}
          {inputMode === 'MANUAL' && (
            <form onSubmit={handleManualSubmit} className="space-y-3 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">Mã vận đơn bưu gửi (Barcode / QR):</label>
                <Input
                  ref={manualInputRef}
                  size="large"
                  placeholder="Nhập mã vận đơn (VD: RKP261123...)"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onPressEnter={handleManualSubmit}
                  prefix={<Barcode size={18} className="text-gray-400 mr-1" />}
                  className="rounded-xl font-mono text-base font-bold text-gray-900 border-2 border-gray-300 focus:border-red-600 h-12"
                  autoFocus
                />
              </div>

              <Button
                type="primary"
                size="large"
                block
                loading={isProcessing}
                onClick={handleManualSubmit}
                className="bg-red-600 hover:bg-red-700 h-11 rounded-xl font-bold shadow-xs text-sm"
              >
                {scanMode === 'PICKUP' ? 'Xác nhận lấy hàng' : 'Xác nhận nhập kho'}
              </Button>
            </form>
          )}
        </div>
      </Modal>

      {/* POPUP THÔNG BÁO KẾT QUẢ QUÉT MÃ (Thành công hoặc Lỗi có nút OK theo đúng yêu cầu) */}
      <Modal
        open={!!popupFeedback}
        onCancel={() => {
          setPopupFeedback(null);
          lastScannedCodeRef.current = '';
        }}
        footer={null}
        centered
        closable={false}
        width={360}
        className="scanner-result-popup"
      >
        <div className="text-center py-4 px-1 space-y-4">
          {/* Biểu tượng trạng thái */}
          <div className="flex justify-center">
            {popupFeedback?.type === 'SUCCESS' ? (
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 size={38} />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                <AlertTriangle size={38} />
              </div>
            )}
          </div>

          {/* Tiêu đề & Nội dung thông báo */}
          <div className="space-y-1.5">
            <h3
              className={`text-lg font-bold ${
                popupFeedback?.type === 'SUCCESS' ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {popupFeedback?.title || (popupFeedback?.type === 'SUCCESS' ? 'Thành công' : 'Thông báo')}
            </h3>
            <p className="text-sm text-gray-700 font-medium leading-relaxed px-2">
              {popupFeedback?.message}
            </p>
          </div>

          {/* NÚT OKE ĐỂ TẮT POPUP THEO ĐÚNG YÊU CẦU */}
          <Button
            type="primary"
            size="large"
            autoFocus
            onClick={() => {
              setPopupFeedback(null);
              // Reset để cho phép quét tiếp mã mới
              lastScannedCodeRef.current = '';
              if (inputMode === 'MANUAL') {
                setTimeout(() => manualInputRef.current?.focus(), 150);
              }
            }}
            className={`w-full h-11 rounded-xl font-bold text-base shadow-md transition-all active:scale-95 ${
              popupFeedback?.type === 'SUCCESS'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
          >
            OK
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default ContinuousScannerModal;
