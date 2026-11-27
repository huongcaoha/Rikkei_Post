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
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { shipperApi } from '../api/shipper';
import { Order } from '../types';

interface ContinuousScannerModalProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: 'PICKUP' | 'INBOUND' | 'DELIVERY' | 'RETURN' | 'OUTBOUND_RETURN';
  canInbound?: boolean;
  canPickup?: boolean;
  canDelivery?: boolean;
  canReturn?: boolean;
  canOutboundReturn?: boolean;
  onOrderUpdated?: () => void;
  onOpenReturnProof?: (order: Order) => void;
}

interface PopupFeedback {
  type: 'SUCCESS' | 'WARNING' | 'ERROR';
  title?: string;
  message: string;
  routingCode?: string;
  chuteGate?: string;
  order?: Order;
}

const getChuteGate = (routingCode?: string, receiverProvinceId?: number): string => {
  const provId = receiverProvinceId || parseInt(routingCode?.split('-')?.[1] || '1', 10) || 1;
  if (provId <= 37) {
    const chuteNum = (provId % 10) + 1;
    return `Máng C0${chuteNum} (Khu vực Miền Bắc / Hà Nội)`;
  } else if (provId <= 68) {
    const chuteNum = (provId % 5) + 11;
    return `Máng C${chuteNum} (Khu vực Miền Trung / Đà Nẵng)`;
  } else {
    const chuteNum = (provId % 5) + 21;
    return `Máng C${chuteNum} (Khu vực Miền Nam / TP.HCM)`;
  }
};

export const ContinuousScannerModal: React.FC<ContinuousScannerModalProps> = ({
  open,
  onClose,
  defaultMode = 'PICKUP',
  canInbound = false,
  canPickup = true,
  canDelivery = true,
  canReturn = false,
  canOutboundReturn = true,
  onOrderUpdated,
  onOpenReturnProof,
}) => {
  const [scanMode, setScanMode] = useState<'PICKUP' | 'INBOUND' | 'DELIVERY' | 'RETURN' | 'OUTBOUND_RETURN'>(defaultMode);
  // Yêu cầu: Mặc định là quét mã bằng CAMERA
  const [inputMode, setInputMode] = useState<'CAMERA' | 'MANUAL'>('CAMERA');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [returnReason, setReturnReason] = useState<string>('Khách hẹn lại / Không liên lạc được');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Popup thông báo kết quả (Thành công hoặc Lỗi có nút OK)
  const [popupFeedback, setPopupFeedback] = useState<PopupFeedback | null>(null);

  const manualInputRef = useRef<any>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const isPopupOpenRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);

  // Dùng Ref để chống Stale Closure trong camera event callback (html5-qrcode chạy độc lập ngoài React cycle)
  const scanModeRef = useRef(scanMode);
  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);

  const returnReasonRef = useRef(returnReason);
  useEffect(() => {
    returnReasonRef.current = returnReason;
  }, [returnReason]);

  // Đồng bộ ref trạng thái popup để chặn quét camera khi popup đang mở
  useEffect(() => {
    isPopupOpenRef.current = !!popupFeedback;
  }, [popupFeedback]);

  // Cập nhật chế độ mặc định khi mở modal
  useEffect(() => {
    if (open) {
      setScanMode(defaultMode);
      scanModeRef.current = defaultMode;
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

  // Âm thanh Beep báo hiệu (Tái sử dụng singleton AudioContext tránh tràn luồng âm thanh trên thiết bị di động)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = (isSuccess: boolean) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtxRef.current = new AudioCtxClass();
        }
      }
      const audioCtx = audioCtxRef.current;
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

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
    // Nếu đang xử lý hoặc đang có Popup mở -> Chặn ngay lập tức bằng Ref đồng bộ
    if (isProcessingRef.current || isPopupOpenRef.current) {
      return;
    }

    const cleanCode = decodedText.trim().toUpperCase();
    const now = Date.now();
    // Chặn quét lặp cùng 1 mã trong vòng 2.5 giây
    if (cleanCode === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
      return;
    }
    lastScannedCodeRef.current = cleanCode;
    lastScannedTimeRef.current = now;
    isProcessingRef.current = true;
    setIsProcessing(true);

    // Tạm dừng quét khung hình để giải phóng camera và tránh đen màn hình
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.pause(true);
      } catch (e) {
        // Ignore
      }
    }

    processBarcode(cleanCode);
  };

  const dismissFeedback = () => {
    setPopupFeedback(null);
    lastScannedCodeRef.current = '';
    isProcessingRef.current = false;
    setIsProcessing(false);

    // Phục hồi mượt mà luồng camera không bao giờ bị đen hình
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.resume();
      } catch (e) {
        startCamera();
      }
    }

    // Đảm bảo video stream của trình duyệt tiếp tục play
    const container = document.getElementById('qr-reader-container');
    const video = container?.querySelector('video');
    if (video && video.paused) {
      video.play().catch(() => {});
    }

    if (inputMode === 'MANUAL') {
      setTimeout(() => manualInputRef.current?.focus(), 150);
    }
  };

  // Xử lý mã vận đơn (Gọi API và hiển thị Popup thông báo thành công hoặc lỗi)
  const processBarcode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng nhập mã vận đơn!');
      return;
    }

    // Đọc chính xác chế độ quét và lý do từ Ref để không bao giờ bị Stale Closure
    const activeScanMode = scanModeRef.current;
    const activeReturnReason = returnReasonRef.current;

    setIsProcessing(true);

    try {
      let updatedOrder: Order;
      let successMsg = '';
      let routingCodeInfo: string | undefined;
      let chuteGateInfo: string | undefined;

      if (activeScanMode === 'PICKUP') {
        updatedOrder = await shipperApi.scanPickup(code);
        successMsg = `Đã lấy hàng thành công đơn [${code}] từ Shop!`;
      } else if (activeScanMode === 'DELIVERY') {
        updatedOrder = await shipperApi.scanDelivery(code);
        successMsg = `Đã xuất kho lấy đơn [${code}] mang đi giao thành công!`;
      } else if (activeScanMode === 'OUTBOUND_RETURN') {
        updatedOrder = await shipperApi.scanOutboundReturn(code);
        successMsg = `Đã xuất kho lấy đơn chuyển hoàn [${code}] đi trả cho Shop [${updatedOrder.senderName || 'Người gửi'}] thành công!`;
      } else if (activeScanMode === 'RETURN') {
        updatedOrder = await shipperApi.scanReturn(code, activeReturnReason);
        successMsg = `Đã quét thu hồi hoàn kho thành công đơn [${code}]!`;
      } else {
        updatedOrder = await shipperApi.scanInbound(code);
        routingCodeInfo = updatedOrder.routingCode || 'RKP-01-001';
        chuteGateInfo = getChuteGate(updatedOrder.routingCode, updatedOrder.receiverProvinceId);
        successMsg = `Đã nhập kho bưu cục thành công đơn [${code}]!`;
      }

      playSound(true);

      // Hiển thị Popup thành công kèm nút OK
      let successTitle = 'Nhập Kho Thành Công';
      if (activeScanMode === 'PICKUP') successTitle = 'Lấy Hàng Thành Công';
      else if (activeScanMode === 'DELIVERY') successTitle = 'Xuất Kho Đi Giao Thành Công';
      else if (activeScanMode === 'OUTBOUND_RETURN') successTitle = 'Xuất Kho Đi Trả Shop Thành Công';
      else if (activeScanMode === 'RETURN') successTitle = 'Thu Hồi Hoàn Kho Thành Công';

      setPopupFeedback({
        type: 'SUCCESS',
        title: successTitle,
        message: successMsg,
        routingCode: routingCodeInfo,
        chuteGate: chuteGateInfo,
        order: updatedOrder,
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
    if (scanMode === 'OUTBOUND_RETURN') return 'Quét Xuất Kho Lấy Đơn Trả Shop';
    if (scanMode === 'PICKUP') return 'Quét Mã Lấy Hàng Tại Shop';
    if (scanMode === 'RETURN') return 'Quét Mã Thu Hồi Đơn Hoàn Về Kho';
    return 'Quét Mã Nhập Kho Bưu Cục';
  };

  const getHeaderColor = () => {
    if (scanMode === 'DELIVERY') return 'bg-blue-600';
    if (scanMode === 'OUTBOUND_RETURN') return 'bg-amber-600';
    if (scanMode === 'PICKUP') return 'bg-amber-600';
    if (scanMode === 'RETURN') return 'bg-orange-600';
    return 'bg-red-600';
  };

  // Các chế độ quét khả dụng
  const modeOptions = [];
  if (canPickup) {
    modeOptions.push({ label: 'Lấy hàng Shop', value: 'PICKUP', icon: <Truck size={14} /> });
  }
  if (canDelivery) {
    modeOptions.push({ label: 'Lấy đi giao', value: 'DELIVERY', icon: <Scan size={14} /> });
  }
  if (canOutboundReturn) {
    modeOptions.push({ label: 'Lấy đơn trả Shop', value: 'OUTBOUND_RETURN', icon: <RotateCcw size={14} /> });
  }
  if (canInbound) {
    modeOptions.push({ label: 'Nhập kho', value: 'INBOUND', icon: <Building2 size={14} /> });
  }
  if (canReturn) {
    modeOptions.push({ label: 'Thu hồi hoàn', value: 'RETURN', icon: <RotateCcw size={14} /> });
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

            <div className="flex items-center space-x-1">
              <Button
                type="text"
                size="small"
                icon={<RotateCcw size={16} />}
                onClick={() => startCamera()}
                className="text-gray-400 hover:text-gray-700"
                title="Làm mới Camera (Khắc phục đứng hình)"
              />
              <Button
                type="text"
                size="small"
                icon={isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                onClick={() => setIsMuted(!isMuted)}
                className="text-gray-400 hover:text-gray-700"
                title={isMuted ? 'Bật âm thanh bíp' : 'Tắt âm thanh'}
              />
            </div>
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

          {scanMode === 'RETURN' && (
            <div className="bg-orange-50 border border-orange-200 p-2.5 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-orange-800">Lý do thu hồi hoàn về kho:</span>
              <Input
                size="small"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Nhập lý do không giao được / hoàn hàng..."
                className="rounded-lg text-xs"
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

                {/* OVERLAY KẾT QUẢ QUÉT TRỰC TIẾP TRÊN CAMERA - KHÔNG DÙNG MODAL NỀN ĐỂ KHÔNG BỊ ĐEN CAMERA */}
                {popupFeedback && (
                  <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-150">
                    <div className="flex justify-center mb-1.5">
                      {popupFeedback.type === 'SUCCESS' ? (
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
                          <CheckCircle2 size={28} />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner">
                          <AlertTriangle size={28} />
                        </div>
                      )}
                    </div>

                    <h3 className={`text-base font-bold ${popupFeedback.type === 'SUCCESS' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {popupFeedback.title || (popupFeedback.type === 'SUCCESS' ? 'Thành công' : 'Thông báo')}
                    </h3>
                    <p className="text-xs text-gray-700 font-medium leading-relaxed px-2 my-1 max-w-xs">
                      {popupFeedback.message}
                    </p>

                    {popupFeedback.chuteGate && (
                      <div className="bg-blue-50 border border-blue-400 p-2 rounded-xl text-center space-y-0.5 my-1.5 w-full max-w-xs shadow-xs">
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                          Máng Chia Chọn / Cửa Xuất (Chute/Gate):
                        </span>
                        <div className="text-sm font-black text-blue-900 tracking-wide">
                          {popupFeedback.chuteGate}
                        </div>
                        <div className="text-[10px] font-mono text-gray-600">
                          Routing Code: <strong className="text-red-600">{popupFeedback.routingCode}</strong>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
                      <Button
                        type="primary"
                        size="middle"
                        autoFocus
                        onClick={dismissFeedback}
                        className={`min-w-[130px] h-8 rounded-lg font-bold text-xs shadow-md transition-all active:scale-95 ${
                          popupFeedback.type === 'SUCCESS'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-amber-600 hover:bg-amber-700 text-white'
                        }`}
                      >
                        OK (Tiếp tục quét)
                      </Button>

                      {popupFeedback.order && onOpenReturnProof && (scanMode === 'OUTBOUND_RETURN' || scanModeRef.current === 'OUTBOUND_RETURN') && popupFeedback.type === 'SUCCESS' && (
                        <Button
                          size="middle"
                          icon={<Camera size={14} />}
                          onClick={() => {
                            const ord = popupFeedback.order!;
                            dismissFeedback();
                            onClose();
                            onOpenReturnProof(ord);
                          }}
                          className="h-8 rounded-lg font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md border-none flex items-center justify-center gap-1"
                        >
                          Chụp ảnh hoàn hàng ngay
                        </Button>
                      )}
                    </div>
                  </div>
                )}
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

              {popupFeedback && (
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                  popupFeedback.type === 'SUCCESS' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}>
                  <div className="space-y-0.5">
                    <div className="font-bold">{popupFeedback.title}</div>
                    <div>{popupFeedback.message}</div>
                  </div>
                  <Button size="small" type="primary" onClick={dismissFeedback} className="ml-2 font-bold">OK</Button>
                </div>
              )}

              <Button
                type="primary"
                size="large"
                block
                loading={isProcessing}
                onClick={handleManualSubmit}
                className="bg-red-600 hover:bg-red-700 h-11 rounded-xl font-bold shadow-xs text-sm"
              >
                {scanMode === 'PICKUP'
                  ? 'Xác nhận lấy hàng'
                  : scanMode === 'OUTBOUND_RETURN'
                  ? 'Xác nhận lấy đơn trả Shop'
                  : scanMode === 'DELIVERY'
                  ? 'Xác nhận xuất kho đi giao'
                  : 'Xác nhận nhập kho'}
              </Button>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
};

export default ContinuousScannerModal;
