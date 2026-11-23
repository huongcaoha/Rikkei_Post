import React, { useState, useEffect, useRef } from 'react';
import { Modal, Input, Button, Tag, Badge, Segmented, message, Space } from 'antd';
import {
  Scan,
  Camera,
  Barcode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Volume2,
  VolumeX,
  RotateCcw,
  Building2,
  Truck,
  ArrowRight
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { shipperApi } from '../api/shipper';
import { Order } from '../types';

interface ScannedItem {
  trackingCode: string;
  order?: Order;
  timestamp: string;
  statusText: string;
  isSuccess: boolean;
  message: string;
}

interface ContinuousScannerModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: 'PICKUP' | 'INBOUND';
  canInbound?: boolean;
  canPickup?: boolean;
  onOrderUpdated?: () => void;
}

export const ContinuousScannerModal: React.FC<ContinuousScannerModalProps> = ({
  open,
  onClose,
  defaultMode = 'PICKUP',
  canInbound = false,
  canPickup = true,
  onOrderUpdated,
}) => {
  const [scanMode, setScanMode] = useState<'PICKUP' | 'INBOUND'>(defaultMode);
  const [inputMode, setInputMode] = useState<'CAMERA' | 'MANUAL'>('MANUAL');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    trackingCode: string;
    message: string;
    order?: Order;
  } | null>(null);

  const [sessionList, setSessionList] = useState<ScannedItem[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const manualInputRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);

  const isSecureContext = typeof window !== 'undefined' && (
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'https:'
  );

  // Cập nhật mode mặc định khi mở modal
  useEffect(() => {
    if (open) {
      if (!canPickup && canInbound) {
        setScanMode('INBOUND');
      } else if (canPickup && !canInbound) {
        setScanMode('PICKUP');
      } else {
        setScanMode(defaultMode);
      }
      setBarcodeInput('');
      setLastResult(null);
      // Tự động focus ô nhập liệu
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 300);
    } else {
      stopCamera();
    }
  }, [open, defaultMode, canInbound, canPickup]);

  // Điều khiển camera khi chuyển tab Camera / Laser
  useEffect(() => {
    if (open && inputMode === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 200);
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
        // Âm bíp trong trẻo thành công (1046 Hz - nốt C6)
        osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        // Âm trầm cảnh báo lỗi hoặc trùng mã (330 Hz - nốt E4)
        osc.frequency.setValueAtTime(329.6, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch (e) {
      // Bỏ qua nếu trình duyệt chặn tự phát âm thanh
    }
  };

  const startCamera = async () => {
    if (!isSecureContext) {
      setIsCameraActive(false);
      message.warning('Trình duyệt di động hạn chế mở Camera trực tiếp trên HTTP qua IP LAN. Bạn có thể bấm "Chụp ảnh bưu kiện" hoặc truy cập qua HTTPS!', 5);
      return;
    }
    try {
      if (html5QrCodeRef.current) {
        await stopCamera();
      }
      // Chờ một chút để container DOM sẵn sàng
      await new Promise((resolve) => setTimeout(resolve, 200));
      const container = document.getElementById('qr-reader-container');
      if (!container) {
        return;
      }
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
          const backCam = cameras.find((c) =>
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
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Lỗi khởi động camera live:', err);
      setIsCameraActive(false);
      message.warning('Không thể mở camera quay video trực tiếp. Vui lòng bấm nút "Chụp ảnh bưu kiện" hoặc nhập mã bằng bàn phím.', 4);
    }
  };

  // Quét mã từ ảnh chụp bưu kiện bằng camera gốc của điện thoại (hỗ trợ cả HTTP và HTTPS)
  const handlePhotoCaptured = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const hideLoading = message.loading('Đang nhận diện mã vạch từ ảnh chụp...', 0);
    try {
      const dummyId = 'qr-reader-dummy-hidden';
      let dummyEl = document.getElementById(dummyId);
      if (!dummyEl) {
        dummyEl = document.createElement('div');
        dummyEl.id = dummyId;
        dummyEl.style.display = 'none';
        document.body.appendChild(dummyEl);
      }
      const fileScanner = new Html5Qrcode(dummyId);
      const decodedResult = await fileScanner.scanFile(file, true);
      hideLoading();
      message.success(`Đã nhận diện thành công mã: ${decodedResult}`);
      handleCameraDecoded(decodedResult);
    } catch (err: any) {
      hideLoading();
      playSound(false);
      message.error('Không tìm thấy mã vạch / QR hợp lệ trong ảnh. Vui lòng chụp rõ nét và đủ sáng hơn nhé!', 3);
    } finally {
      setIsProcessing(false);
      if (e.target) e.target.value = '';
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
        // Ignore cleanup error
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Xử lý khi camera phát hiện mã
  const handleCameraDecoded = (decodedText: string) => {
    const cleanCode = decodedText.trim().toUpperCase();
    const now = Date.now();
    // Chặn quét lặp cùng 1 mã trong vòng 2.5 giây từ camera
    if (cleanCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
      return;
    }
    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;
    processBarcode(cleanCode);
  };

  // Xử lý mã vận đơn (tự động gọi API không cần nút xác nhận)
  const processBarcode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    setIsProcessing(true);
    const nowTimeStr = new Date().toLocaleTimeString('vi-VN');

    try {
      let updatedOrder: Order;
      let successMsg = '';

      if (scanMode === 'PICKUP') {
        // Tự động gọi API quét lấy hàng
        updatedOrder = await shipperApi.scanPickup(code);
        successMsg = `Đã lấy hàng thành công đơn [${code}] từ Shop!`;
      } else {
        // Tự động gọi API quét nhập kho bưu cục
        updatedOrder = await shipperApi.scanInbound(code);
        successMsg = `Đã nhập kho bưu cục thành công đơn [${code}]!`;
      }

      playSound(true);
      setLastResult({
        success: true,
        trackingCode: code,
        message: successMsg,
        order: updatedOrder,
      });

      // Ghi nhận vào phiên quét
      setSessionList((prev) => [
        {
          trackingCode: code,
          order: updatedOrder,
          timestamp: nowTimeStr,
          statusText: scanMode === 'PICKUP' ? 'Đã lấy từ Shop' : 'Đã nhập kho Hub',
          isSuccess: true,
          message: successMsg,
        },
        ...prev,
      ]);

      // Báo ngoài màn hình chính để đồng bộ dữ liệu
      onOrderUpdated?.();
    } catch (err: any) {
      playSound(false);
      const errMsg = err.response?.data?.message || err.message || 'Lỗi xử lý mã đơn hàng!';

      setLastResult({
        success: false,
        trackingCode: code,
        message: errMsg,
      });

      setSessionList((prev) => [
        {
          trackingCode: code,
          timestamp: nowTimeStr,
          statusText: 'Cảnh báo / Thất bại',
          isSuccess: false,
          message: errMsg,
        },
        ...prev,
      ]);
    } finally {
      setIsProcessing(false);
      setBarcodeInput('');
      // Luôn giữ focus để quét tiếp mã tiếp theo ngay lập tức!
      setTimeout(() => {
        manualInputRef.current?.focus();
      }, 100);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      processBarcode(barcodeInput);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={640}
      className="continuous-scanner-modal"
      title={
        <div className="flex items-center justify-between pr-6 border-b pb-3">
          <div className="flex items-center space-x-2 text-base font-bold text-gray-900">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
              scanMode === 'PICKUP' ? 'bg-amber-600' : 'bg-red-600'
            }`}>
              <Scan size={18} />
            </div>
            <span>
              {scanMode === 'PICKUP' ? 'Quét Mã Lấy Hàng (Bưu Tá)' : 'Quét Mã Nhập Kho (Khai Thác Kho)'}
            </span>
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
        {/* Lựa chọn vai trò tác nghiệp nếu có cả 2 quyền */}
        {canPickup && canInbound && (
          <div className="bg-gray-50 p-2 rounded-xl flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 ml-1">Chế độ quét tự động:</span>
            <Segmented
              value={scanMode}
              onChange={(val) => setScanMode(val as any)}
              options={[
                { label: '⚡ Quét lấy hàng tại Shop', value: 'PICKUP', icon: <Truck size={14} /> },
                { label: '🏢 Quét nhập kho bưu cục', value: 'INBOUND', icon: <Building2 size={14} /> },
              ]}
              className="font-medium text-xs bg-white shadow-xs"
            />
          </div>
        )}

        {/* Input ẩn để kích hoạt Native Camera chụp ảnh bưu kiện trên điện thoại (chạy tốt trên cả HTTP và HTTPS) */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          className="hidden"
          onChange={handlePhotoCaptured}
        />

        {/* Cảnh báo thân thiện nếu điện thoại truy cập qua HTTP */}
        {!isSecureContext && (
          <div className="bg-amber-50/90 border border-amber-200 text-amber-900 rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-amber-800">
              <AlertTriangle size={16} className="text-amber-600" />
              <span>Lưu ý khi dùng Camera trên điện thoại:</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              Trình duyệt điện thoại (Safari/Chrome) chặn Camera live trực tiếp trên địa chỉ HTTP không bảo mật. 
              Bạn hãy dùng <b>nút chụp ảnh màu cam</b> bên dưới (mở camera máy chụp mã) hoặc truy cập qua link <b>HTTPS</b>:{' '}
              <a href={`https://${window.location.hostname}:3000`} className="text-red-600 underline font-bold" target="_self">
                https://{window.location.hostname}:3000
              </a>.
            </p>
          </div>
        )}

        {/* Nút chụp ảnh bưu kiện trực tiếp bằng Camera điện thoại */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-2.5 rounded-2xl border border-amber-200 flex items-center justify-between gap-2">
          <div className="text-xs">
            <div className="font-bold text-gray-800">Chụp ảnh bưu kiện</div>
            <div className="text-[11px] text-gray-500">Mở camera chụp mã vạch / QR bưu gửi</div>
          </div>
          <Button
            type="primary"
            icon={<Camera size={16} />}
            loading={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="bg-amber-600 hover:bg-amber-700 font-bold rounded-xl h-10 px-4 text-xs shadow-xs"
          >
            📸 Chụp ảnh quét mã
          </Button>
        </div>

        {/* Chuyển đổi phương thức: Súng quét mã/Bàn phím HOẶC Camera live */}
        <div className="flex items-center justify-between bg-slate-100 p-1.5 rounded-xl">
          <Button
            type={inputMode === 'MANUAL' ? 'primary' : 'text'}
            icon={<Barcode size={16} />}
            onClick={() => setInputMode('MANUAL')}
            className={`flex-1 rounded-lg text-xs font-semibold h-9 ${
              inputMode === 'MANUAL' ? 'bg-gray-900 hover:bg-black shadow-xs' : 'text-gray-600'
            }`}
          >
            Máy quét Barcode / Nhập tay
          </Button>
          <Button
            type={inputMode === 'CAMERA' ? 'primary' : 'text'}
            icon={<Camera size={16} />}
            onClick={() => {
              if (!isSecureContext) {
                message.info('Trình duyệt di động yêu cầu truy cập qua https:// để mở camera live. Bạn có thể dùng nút "📸 Chụp ảnh quét mã" ở trên nhé!');
              }
              setInputMode('CAMERA');
            }}
            className={`flex-1 rounded-lg text-xs font-semibold h-9 ${
              inputMode === 'CAMERA' ? 'bg-red-600 hover:bg-red-700 shadow-xs' : 'text-gray-600'
            }`}
          >
            Camera Live liên tục
          </Button>
        </div>

        {/* VÙNG 1: Camera Scanner */}
        {inputMode === 'CAMERA' && (
          <div className="space-y-2">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-red-500 shadow-inner">
              <div id="qr-reader-container" className="w-full h-full" />
              {/* Khung ngắm quét mã vạch */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-36 border-2 border-dashed border-red-400 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-red-500 shadow-lg animate-pulse" />
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500">
              Hướng camera về phía mã vạch hoặc mã QR trên tem bưu gửi. Hệ thống sẽ <b>tự động nhận diện và cập nhật tức thì</b>.
            </p>
          </div>
        )}

        {/* VÙNG 2: Máy quét Barcode / Bàn phím liên tục */}
        <form onSubmit={handleManualSubmit} className="space-y-2">
          <div className="relative">
            <Input
              ref={manualInputRef}
              size="large"
              placeholder={
                scanMode === 'PICKUP'
                  ? 'Quét hoặc nhập mã vận đơn để TỰ ĐỘNG LẤY HÀNG (VD: RKP...)'
                  : 'Quét hoặc nhập mã vận đơn để TỰ ĐỘNG NHẬP KHO (VD: RKP...)'
              }
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onPressEnter={() => {
                if (barcodeInput.trim()) processBarcode(barcodeInput);
              }}
              prefix={<Scan size={18} className="text-red-500 mr-1" />}
              suffix={
                isProcessing ? (
                  <span className="text-xs text-red-500 font-semibold animate-pulse">Đang xử lý...</span>
                ) : (
                  <Tag color="blue" className="text-[10px] m-0 font-mono">Bấm Enter / Bắn súng</Tag>
                )
              }
              className="rounded-xl font-mono text-base font-bold text-gray-900 border-2 border-red-300 focus:border-red-600 shadow-xs h-12"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
            <span>⚡ Chế độ liên tục: Máy quét barcode tự động gửi mã và đổi trạng thái không cần click chuột.</span>
            <Button
              type="link"
              size="small"
              onClick={() => manualInputRef.current?.focus()}
              className="text-xs text-blue-600 p-0 font-medium"
            >
              Focus lại ô quét
            </Button>
          </div>
        </form>

        {/* VÙNG 3: Kết quả vừa quét gần nhất */}
        {lastResult && (
          <div
            className={`p-4 rounded-2xl border transition-all ${
              lastResult.success
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/90 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">
                {lastResult.success ? (
                  <CheckCircle2 size={24} className="text-emerald-600" />
                ) : (
                  <AlertTriangle size={24} className="text-amber-600" />
                )}
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-sm">{lastResult.trackingCode}</span>
                  <Tag color={lastResult.success ? 'success' : 'warning'} className="font-bold text-[11px]">
                    {lastResult.success
                      ? scanMode === 'PICKUP' ? '✓ ĐÃ LẤY HÀNG' : '✓ ĐÃ NHẬP KHO'
                      : 'CẢNH BÁO'}
                  </Tag>
                </div>
                <div className="font-medium mt-1 leading-relaxed">{lastResult.message}</div>
                {lastResult.order && (
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 text-[11px] text-gray-600 grid grid-cols-2 gap-2">
                    <div>Người nhận: <b>{lastResult.order.receiverName}</b> ({lastResult.order.receiverPhone})</div>
                    <div>Hàng hóa: <b>{lastResult.order.itemName}</b> ({lastResult.order.billableWeightGram}g)</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VÙNG 4: Danh sách các đơn đã quét trong phiên (Session Audit Log) */}
        <div className="border border-gray-200 rounded-2xl p-3 bg-gray-50/50 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-gray-800 pb-1 border-b border-gray-200">
            <span className="flex items-center space-x-1.5">
              <Package size={15} className="text-red-600" />
              <span>Kiện hàng đã quét trong phiên</span>
              <Badge
                count={sessionList.filter((s) => s.isSuccess).length}
                overflowCount={999}
                className="ml-1"
                style={{ backgroundColor: '#10b981' }}
              />
            </span>
            {sessionList.length > 0 && (
              <Button
                type="text"
                size="small"
                icon={<RotateCcw size={12} />}
                onClick={() => setSessionList([])}
                className="text-[11px] text-gray-400 hover:text-red-600 h-6 px-1"
              >
                Xóa lịch sử phiên
              </Button>
            )}
          </div>

          {sessionList.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400 italic">
              Chưa có đơn hàng nào được quét trong phiên này. Hãy quét hoặc nhập mã vận đơn để bắt đầu.
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 text-xs">
              {sessionList.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded-xl flex items-center justify-between border ${
                    item.isSuccess ? 'bg-white border-gray-200' : 'bg-amber-50/60 border-amber-200'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-red-600">{item.trackingCode}</span>
                    <span className="text-[11px] text-gray-400">({item.timestamp})</span>
                    <Tag
                      color={item.isSuccess ? 'green' : 'orange'}
                      className="text-[10px] font-medium m-0"
                    >
                      {item.statusText}
                    </Tag>
                  </div>
                  <div className="text-[11px] text-gray-600 truncate max-w-[200px]" title={item.message}>
                    {item.order?.itemName || item.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
