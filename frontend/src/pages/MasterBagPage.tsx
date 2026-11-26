import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Space,
  Popconfirm,
  message,
  Typography,
  Divider,
  Alert,
  Tooltip,
  Segmented,
} from 'antd';
import {
  Package,
  Plus,
  Lock,
  Printer,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  Trash2,
  Barcode,
  Layers,
  ArrowRight,
  MapPin,
  Camera,
  Scan,
  ScanLine,
  Volume2,
  VolumeX,
  RefreshCw,
  Check,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { wmsApi } from '../api/wms';
import { locationApi } from '../api/location';
import { orderApi } from '../api/order';
import { useAuth } from '../context/AuthContext';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';
import { MasterBag, Warehouse } from '../types';
import { MasterBagThermalLabel } from '../components/MasterBagThermalLabel';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const STATUS_TAGS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Đang mở đóng kiện', color: 'blue' },
  SEALED: { label: 'Đã kẹp chì (Seal)', color: 'orange' },
  ASSIGNED_TO_DRIVER: { label: 'Đã gán tài xế xe tải', color: 'gold' },
  IN_TRANSIT: { label: 'Đang trên xe trung chuyển', color: 'purple' },
  ARRIVED_AT_HUB: { label: 'Đã đến kho Hub', color: 'cyan' },
  MANIFESTED: { label: 'Đã lên bảng kê xe', color: 'cyan' },
  DISPATCHED: { label: 'Đang luân chuyển xe', color: 'purple' },
  RECEIVED: { label: 'Đã nhận tại kho đích', color: 'green' },
  UNSEALED: { label: 'Đã cắt chì / Mở bao', color: 'default' },
};

export const MasterBagPage: React.FC = () => {
  const { user } = useAuth();
  const [bags, setBags] = useState<MasterBag[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDestWarehouseId, setFilterDestWarehouseId] = useState<number | 'ALL'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Tự động lắng nghe sự kiện WebSocket cập nhật danh sách bao tải
  useOrderWebSocket({
    onEvent: (event) => {
      if (
        event.type === 'MASTER_BAG_CREATED' ||
        event.type === 'BAG_SEALED' ||
        event.type === 'BAG_UNSEALED' ||
        event.type === 'BAG_ASSIGNED_TO_DRIVER' ||
        event.type === 'MASTER_BAG_IN_TRANSIT' ||
        event.type === 'MASTER_BAG_ARRIVED_AT_HUB'
      ) {
        fetchData();
      }
    },
    showNotification: false,
  });

  // Modal tạo bao mới kèm quét kiện trực tiếp
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState<boolean>(false);
  const [scannedItems, setScannedItems] = useState<
    Array<{ trackingCode: string; itemName: string; weightGram: number; receiverAddress?: string }>
  >([]);
  const [newBagScanInput, setNewBagScanInput] = useState<string>('');
  const [checkingItem, setCheckingItem] = useState<boolean>(false);

  // Modal quét nhập kho Hub (Súng barcode / Camera)
  const [hubScanModalOpen, setHubScanModalOpen] = useState<boolean>(false);
  const [hubScanInput, setHubScanInput] = useState<string>('');
  const [hubScanning, setHubScanning] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<'CAMERA' | 'GUN'>('CAMERA');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hubSelectedWarehouseId, setHubSelectedWarehouseId] = useState<number | undefined>(undefined);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    code: string;
    message: string;
    success: boolean;
    time: string;
    bag?: MasterBag;
  } | null>(null);
  const [sessionScannedBags, setSessionScannedBags] = useState<
    Array<{
      bagCode: string;
      sealNumber?: string;
      originWarehouseName: string;
      destWarehouseName: string;
      totalItems: number;
      totalWeightKg: number;
      time: string;
    }>
  >([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const gunInputRef = useRef<any>(null);

  // Drawer chi tiết bàn đóng bao
  const [activeBag, setActiveBag] = useState<MasterBag | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [scanItemInput, setScanItemInput] = useState<string>('');
  const [scanningItem, setScanningItem] = useState<boolean>(false);
  const scanInputRef = useRef<any>(null);

  // Modal kẹp chì
  const [sealModalOpen, setSealModalOpen] = useState<boolean>(false);
  const [sealForm] = Form.useForm();
  const [sealing, setSealing] = useState<boolean>(false);

  // Modal in nhãn bao
  const [printBag, setPrintBag] = useState<MasterBag | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bagsData, whData] = await Promise.all([
        wmsApi.getAllBags(),
        locationApi.getAllWarehouses().catch(() => []),
      ]);
      setBags(bagsData || []);
      setWarehouses(whData || []);
    } catch (err: any) {
      message.error('Không thể tải danh sách bao tải: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    const defaultOrigin = user?.assignedPostOfficeId || (warehouses.length > 0 ? warehouses[0].id : undefined);
    const suggestedSeal = 'SEAL' + dayjs().format('YYYYMMDD') + '-' + Math.floor(1000 + Math.random() * 9000);
    setScannedItems([]);
    setNewBagScanInput('');
    createForm.setFieldsValue({
      originWarehouseId: defaultOrigin,
      sealNumber: suggestedSeal,
      destWarehouseId: undefined,
      notes: '',
    });
    setCreateModalOpen(true);
  };

  const handleAddTrackingToNewBag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = newBagScanInput.trim().toUpperCase();
    if (!code) return;

    if (scannedItems.some((item) => item.trackingCode === code)) {
      message.warning(`Đơn hàng [${code}] đã có trong danh sách đóng bao này rồi!`);
      return;
    }

    setCheckingItem(true);
    try {
      const order = await orderApi.getOrderByTrackingCode(code);
      setScannedItems((prev) => [
        ...prev,
        {
          trackingCode: code,
          itemName: order.itemName || 'Hàng hóa tổng hợp',
          weightGram: order.billableWeightGram || order.actualWeightGram || 500,
          receiverAddress: order.receiverAddress,
        },
      ]);
      message.success(`Đã quét đơn hàng [${code}] vào bao thành công!`);
      setNewBagScanInput('');
    } catch (err: any) {
      setScannedItems((prev) => [
        ...prev,
        {
          trackingCode: code,
          itemName: 'Kiện hàng gom bao',
          weightGram: 500,
        },
      ]);
      message.info(`Đã thêm mã vận đơn [${code}] vào danh sách đóng bao.`);
      setNewBagScanInput('');
    } finally {
      setCheckingItem(false);
    }
  };

  const handleRemoveTrackingFromNewBag = (trackingCode: string) => {
    setScannedItems((prev) => prev.filter((item) => item.trackingCode !== trackingCode));
  };

  const handleCreateBag = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      const newBag = await wmsApi.createBag({
        originWarehouseId: values.originWarehouseId,
        destWarehouseId: values.destWarehouseId,
        sealNumber: values.sealNumber,
        notes: values.notes,
        trackingCodes: scannedItems.map((item) => item.trackingCode),
      });
      message.success(
        `Đã tạo bao tải gom hàng [${newBag.bagCode}] kẹp chì [${newBag.sealNumber}] gồm ${newBag.totalItems} kiện thành công! Đã gửi thông báo tới kho đích.`
      );
      setCreateModalOpen(false);
      createForm.resetFields();
      setScannedItems([]);
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi khi tạo bao tải');
    } finally {
      setCreating(false);
    }
  };

  const openBagDrawer = async (bag: MasterBag) => {
    try {
      const detail = await wmsApi.getBagById(bag.id);
      setActiveBag(detail);
      setDrawerOpen(true);
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 300);
    } catch (err: any) {
      message.error('Lỗi tải chi tiết bao: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleScanItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBag || !scanItemInput.trim()) return;

    const code = scanItemInput.trim().toUpperCase();
    setScanningItem(true);
    try {
      const updated = await wmsApi.addItemToBag(activeBag.id, code);
      setActiveBag(updated);
      message.success(`Đã thêm kiện [${code}] vào bao thành công!`);
      setScanItemInput('');
      // Cập nhật lại trong bảng danh sách
      setBags((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      message.error(err.response?.data?.message || `Lỗi khi nạp kiện [${code}] vào bao`);
    } finally {
      setScanningItem(false);
      setTimeout(() => {
        scanInputRef.current?.focus();
      }, 100);
    }
  };

  const handleRemoveItem = async (trackingCode: string) => {
    if (!activeBag) return;
    try {
      const updated = await wmsApi.removeItemFromBag(activeBag.id, trackingCode);
      setActiveBag(updated);
      message.success(`Đã gỡ kiện [${trackingCode}] ra khỏi bao!`);
      setBags((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi gỡ kiện hàng');
    }
  };

  // Âm thanh Beep báo hiệu Web Audio API
  const playBeep = (isSuccess = true) => {
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
      // Bỏ qua lỗi audio nếu browser chặn
    }
  };

  const startCamera = async (mode: 'environment' | 'user' = 'environment') => {
    try {
      if (html5QrCodeRef.current) {
        await stopCamera();
      }
      await new Promise((r) => setTimeout(r, 200));
      const element = document.getElementById('hub-bag-camera-reader');
      if (!element) return;

      const qrCode = new Html5Qrcode('hub-bag-camera-reader');
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
            cameras.find(
              (c) =>
                c.label.toLowerCase().includes('back') ||
                c.label.toLowerCase().includes('sau') ||
                c.label.toLowerCase().includes('environment')
            ) || cameras[cameras.length - 1];

          await qrCode.start(
            mode === 'environment'
              ? backCam
                ? backCam.id
                : { facingMode: 'environment' }
              : { facingMode: 'user' },
            config,
            (decodedText) => handleCameraDecoded(decodedText),
            () => {}
          );
        } else {
          await qrCode.start(
            { facingMode: mode },
            config,
            (decodedText) => handleCameraDecoded(decodedText),
            () => {}
          );
        }
        setCameraActive(true);
      } catch (camErr) {
        await qrCode.start(
          { facingMode: mode },
          config,
          (decodedText) => handleCameraDecoded(decodedText),
          () => {}
        );
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Lỗi bật camera:', err);
      setCameraActive(false);
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
    setCameraActive(false);
  };

  const handleSwitchCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  const handleSwitchScanMode = async (mode: 'CAMERA' | 'GUN') => {
    setScanMode(mode);
    if (mode === 'CAMERA') {
      setTimeout(() => {
        startCamera(facingMode);
      }, 300);
    } else {
      await stopCamera();
      setTimeout(() => {
        gunInputRef.current?.focus();
      }, 200);
    }
  };

  const handleCameraDecoded = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    // Chặn quét lặp cùng 1 mã trong vòng 2.5 giây
    const now = Date.now();
    if (code === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
      return;
    }

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    lastScannedCodeRef.current = code;
    lastScannedTimeRef.current = now;

    await handleProcessInboundCode(code);
    isProcessingRef.current = false;
  };

  const handleProcessInboundCode = async (rawCode?: string) => {
    const code = (rawCode || hubScanInput).trim().toUpperCase();
    if (!code) {
      message.warning('Vui lòng quét hoặc nhập mã bao tải / mã seal!');
      return;
    }

    setHubScanning(true);
    try {
      const effectiveWhId =
        hubSelectedWarehouseId ||
        user?.assignedPostOfficeId ||
        (warehouses.length > 0 ? warehouses[0].id : 1);
      const updated = await wmsApi.hubScanInbound(code, effectiveWhId);

      playBeep(true);
      setLastScannedFeedback({
        code: updated.bagCode,
        message: `Đã tiếp nhận bao tải [${updated.bagCode}] vào kho thành công! (${updated.totalItems} kiện hàng)`,
        success: true,
        time: dayjs().format('HH:mm:ss'),
        bag: updated,
      });

      setSessionScannedBags((prev) => [
        {
          bagCode: updated.bagCode,
          sealNumber: updated.sealNumber,
          originWarehouseName: updated.originWarehouseName || 'Kho gửi',
          destWarehouseName: updated.destWarehouseName || 'Kho đích',
          totalItems: updated.totalItems || 0,
          totalWeightKg: updated.totalWeightKg || 0,
          time: dayjs().format('HH:mm:ss'),
        },
        ...prev.filter((b) => b.bagCode !== updated.bagCode),
      ]);

      message.success(`Đã quét tiếp nhận bao [${updated.bagCode}] thành công!`);
      setHubScanInput('');
      fetchData();
    } catch (err: any) {
      playBeep(false);
      const errMsg = err.response?.data?.message || err.message || 'Lỗi khi quét tiếp nhận bao tải';
      setLastScannedFeedback({
        code,
        message: errMsg,
        success: false,
        time: dayjs().format('HH:mm:ss'),
      });
      message.error(errMsg);
    } finally {
      setHubScanning(false);
      if (scanMode === 'GUN') {
        setTimeout(() => {
          gunInputRef.current?.focus();
        }, 100);
      }
    }
  };

  const handleOpenHubScanModal = (bag?: MasterBag) => {
    setHubScanInput(bag ? bag.bagCode : '');
    setLastScannedFeedback(null);
    const defaultWhId =
      user?.assignedPostOfficeId || (warehouses.length > 0 ? warehouses[0].id : 1);
    setHubSelectedWarehouseId(defaultWhId);
    setHubScanModalOpen(true);

    if (scanMode === 'CAMERA') {
      setTimeout(() => {
        startCamera(facingMode);
      }, 350);
    } else {
      setTimeout(() => {
        gunInputRef.current?.focus();
      }, 200);
    }
  };

  const handleCloseHubScanModal = async () => {
    await stopCamera();
    setHubScanModalOpen(false);
    setHubScanInput('');
    setLastScannedFeedback(null);
  };

  const handleOpenSealModal = (bag: MasterBag) => {
    setActiveBag(bag);
    sealForm.resetFields();
    // Gợi ý mã seal chì ngẫu nhiên
    const randomSeal = 'SEAL' + Math.floor(100000 + Math.random() * 900000);
    sealForm.setFieldsValue({ sealNumber: randomSeal });
    setSealModalOpen(true);
  };

  const handleConfirmSeal = async () => {
    if (!activeBag) return;
    try {
      const values = await sealForm.validateFields();
      setSealing(true);
      const updated = await wmsApi.sealBag(activeBag.id, values.sealNumber);
      message.success(`Niêm phong kẹp chì bao [${updated.bagCode}] thành công!`);
      setSealModalOpen(false);
      setActiveBag(updated);
      setBags((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi khi kẹp chì');
    } finally {
      setSealing(false);
    }
  };

  // Thống kê số lượng bao tải theo từng kho đích đến (Chỉ hiển thị các kho có số lượng bao > 0)
  const destWarehouseStats = React.useMemo(() => {
    const statsMap: Record<number, { id: number; name: string; count: number; totalWeightKg: number; totalItems: number }> = {};
    bags.forEach((b) => {
      const destId = b.destWarehouseId;
      const destName = b.destWarehouseName || `Kho #${destId}`;
      if (!destId) return;
      if (!statsMap[destId]) {
        statsMap[destId] = {
          id: destId,
          name: destName,
          count: 0,
          totalWeightKg: 0,
          totalItems: 0,
        };
      }
      statsMap[destId].count += 1;
      statsMap[destId].totalWeightKg += Number(b.totalWeightKg || 0);
      statsMap[destId].totalItems += Number(b.totalItems || 0);
    });

    return Object.values(statsMap)
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [bags]);

  const filteredBags = bags.filter((b) => {
    if (filterStatus !== 'ALL' && b.status !== filterStatus) return false;
    if (filterDestWarehouseId !== 'ALL' && b.destWarehouseId !== filterDestWarehouseId) return false;
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      const matchCode = b.bagCode.toLowerCase().includes(kw);
      const matchSeal = b.sealNumber?.toLowerCase().includes(kw);
      const matchOrig = b.originWarehouseName?.toLowerCase().includes(kw);
      const matchDest = b.destWarehouseName?.toLowerCase().includes(kw);
      return matchCode || matchSeal || matchOrig || matchDest;
    }
    return true;
  });

  const totalBags = bags.length;
  const openBags = bags.filter((b) => b.status === 'OPEN').length;
  const sealedBags = bags.filter((b) => b.status === 'SEALED').length;
  const inTransitBags = bags.filter((b) => ['MANIFESTED', 'DISPATCHED'].includes(b.status)).length;

  const columns = [
    {
      title: 'Mã Bao Tải',
      dataIndex: 'bagCode',
      key: 'bagCode',
      render: (code: string, record: MasterBag) => (
        <div>
          <span className="font-mono font-bold text-blue-600 text-sm">{code}</span>
          {record.sealNumber && (
            <div className="mt-1">
              <Tag color="volcano" className="font-mono text-xs">
                Seal: {record.sealNumber}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tuyến Vận Chuyển',
      key: 'route',
      render: (_: any, record: MasterBag) => (
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-gray-700">{record.originWarehouseName}</span>
          <ArrowRight size={14} className="text-gray-400 shrink-0" />
          <span className="font-bold text-red-600">{record.destWarehouseName}</span>
        </div>
      ),
    },
    {
      title: 'Số Kiện',
      dataIndex: 'totalItems',
      key: 'totalItems',
      render: (count: number) => (
        <span className="font-bold text-gray-800">{count} kiện</span>
      ),
    },
    {
      title: 'Tổng Trọng Lượng',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      render: (kg: number) => (
        <span className="font-semibold text-gray-700">{Number(kg).toFixed(2)} kg</span>
      ),
    },
    {
      title: 'Tài xế & Xe tải',
      key: 'driverTruck',
      render: (_: any, record: MasterBag) => (
        <div className="text-xs">
          {record.assignedDriverName ? (
            <div>
              <div className="font-semibold text-gray-800">{record.assignedDriverName}</div>
              <div className="text-gray-500">{record.assignedDriverPhone}</div>
              {record.assignedTruckPlate && (
                <Tag color="gold" className="text-xs mt-0.5 font-bold">
                  Xe: {record.assignedTruckPlate}
                </Tag>
              )}
            </div>
          ) : (
            <Tag color="default" className="text-gray-500 italic">
              Chờ tài xế quét mã
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => {
        const info = STATUS_TAGS[st] || { label: st, color: 'default' };
        return <Tag color={info.color} className="font-semibold">{info.label}</Tag>;
      },
    },
    {
      title: 'Thời Gian Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (dt: string) => (
        <span className="text-xs text-gray-500">
          {dt ? new Date(dt).toLocaleString('vi-VN') : '-'}
        </span>
      ),
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      render: (_: any, record: MasterBag) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<Package size={14} />}
            onClick={() => openBagDrawer(record)}
            className="bg-blue-600 hover:bg-blue-700 text-xs"
          >
            {record.status === 'OPEN' ? 'Đóng hàng' : 'Xem chi tiết'}
          </Button>

          {record.status === 'OPEN' && record.totalItems > 0 && (
            <Button
              size="small"
              icon={<Lock size={14} />}
              onClick={() => handleOpenSealModal(record)}
              className="border-orange-500 text-orange-600 hover:bg-orange-50 text-xs"
            >
              Kẹp chì
            </Button>
          )}

          {['IN_TRANSIT', 'DISPATCHED', 'ASSIGNED_TO_DRIVER', 'SEALED'].includes(record.status) && (
            <Button
              size="small"
              type="primary"
              icon={<ScanLine size={14} />}
              onClick={() => handleOpenHubScanModal(record)}
              className="bg-purple-600 hover:bg-purple-700 text-xs font-semibold"
              title="Quét tiếp nhận nhập kho đích/Hub"
            >
              Quét nhập kho
            </Button>
          )}

          <Button
            size="small"
            icon={<Printer size={14} />}
            onClick={() => setPrintBag(record)}
            className="text-gray-600 hover:text-black text-xs"
            title="In tem nhãn bao tải A6"
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Tiêu đề & Nút hành động */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Layers size={28} />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-gray-800">
              Quy Trình Đóng Bao Tải Master Bag & Kẹp Chì Seal
            </Title>
            <Text type="secondary" className="text-sm">
              Gom kiện hàng theo tuyến đích, niêm phong mã chì Seal và in tem nhãn bao tải trước khi chuyển lên xe tải.
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button icon={<RotateCcw size={16} />} onClick={fetchData} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="default"
            icon={<Scan size={16} className="text-purple-600" />}
            onClick={() => handleOpenHubScanModal()}
            className="border-purple-600 text-purple-700 hover:bg-purple-50 font-bold shadow-xs"
          >
            Quét Nhập Kho Bao Tải (Súng / Camera)
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenCreateModal}
            className="bg-red-600 hover:bg-red-700"
          >
            Tạo bao tải mới
          </Button>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Tổng số bao tải"
              value={totalBags}
              suffix="bao"
              prefix={<Layers size={20} className="text-blue-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đang mở đóng hàng"
              value={openBags}
              suffix="bao"
              valueStyle={{ color: '#2563eb' }}
              prefix={<Package size={20} className="text-blue-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đã kẹp chì (Sẵn sàng)"
              value={sealedBags}
              suffix="bao"
              valueStyle={{ color: '#ea580c' }}
              prefix={<Lock size={20} className="text-orange-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100">
            <Statistic
              title="Đang trên xe luân chuyển"
              value={inTransitBags}
              suffix="bao"
              valueStyle={{ color: '#7c3aed' }}
              prefix={<Truck size={20} className="text-purple-600 mr-2" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Thống kê số lượng bao tải giao đến từng kho đích đến (Chỉ hiển thị các kho có số lượng bao > 0) */}
      {destWarehouseStats.length > 0 && (
        <Card className="rounded-2xl shadow-sm border border-gray-100 bg-gradient-to-r from-orange-50/40 via-white to-blue-50/40 p-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                <MapPin size={20} />
              </div>
              <div>
                <span className="font-bold text-gray-800 text-sm">
                  Thống Kê Số Lượng Bao Tải Giao Đến Từng Kho Đích Đến ({destWarehouseStats.length} kho có bao tải)
                </span>
                <div className="text-[11px] text-gray-500">
                  Nhấn vào từng kho để lọc nhanh danh sách bao tải (Chỉ hiển thị các kho đích có số lượng bao tải &gt; 0)
                </div>
              </div>
            </div>

            {filterDestWarehouseId !== 'ALL' && (
              <Button
                size="small"
                type="link"
                onClick={() => setFilterDestWarehouseId('ALL')}
                className="text-orange-600 font-semibold p-0 text-xs"
              >
                ✕ Bỏ lọc kho đích (Hiển thị tất cả)
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {destWarehouseStats.map((stat) => {
              const isSelected = filterDestWarehouseId === stat.id;
              return (
                <div
                  key={stat.id}
                  onClick={() => setFilterDestWarehouseId(isSelected ? 'ALL' : stat.id)}
                  className={`cursor-pointer p-3 rounded-xl border transition-all duration-200 select-none ${
                    isSelected
                      ? 'bg-orange-600 text-white border-orange-700 shadow-md transform -translate-y-0.5'
                      : 'bg-white hover:bg-orange-50 text-gray-800 border-gray-200 hover:border-orange-300 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-800'}`}
                      title={stat.name}
                    >
                      {stat.name}
                    </span>
                    {isSelected && <CheckCircle2 size={14} className="text-white shrink-0 ml-1" />}
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-orange-600'}`}>
                      {stat.count} <span className="text-xs font-semibold">bao</span>
                    </span>
                    <span className={`text-[11px] ${isSelected ? 'text-orange-100' : 'text-gray-500'}`}>
                      {stat.totalWeightKg.toFixed(1)} kg
                    </span>
                  </div>
                  <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-orange-100' : 'text-gray-400'}`}>
                    Tổng {stat.totalItems} kiện hàng
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Bảng danh sách bao tải */}
      <Card className="rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              prefix={<Search size={16} className="text-gray-400" />}
              placeholder="Tìm theo mã bao, mã seal, tên kho..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={filterDestWarehouseId}
              onChange={setFilterDestWarehouseId}
              style={{ width: 230 }}
              placeholder="Lọc theo kho đích đến"
              showSearch
              optionFilterProp="children"
            >
              <Option value="ALL">🏢 Tất cả kho đích đến</Option>
              {warehouses.map((w) => {
                const countForWh = destWarehouseStats.find((s) => s.id === w.id)?.count || 0;
                return (
                  <Option key={w.id} value={w.id}>
                    {w.name} {countForWh > 0 ? `(${countForWh} bao)` : ''}
                  </Option>
                );
              })}
            </Select>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              style={{ width: 190 }}
            >
              <Option value="ALL">Tất cả trạng thái</Option>
              <Option value="OPEN">Đang mở đóng kiện</Option>
              <Option value="SEALED">Đã kẹp chì (Seal)</Option>
              <Option value="MANIFESTED">Đã lên bảng kê xe</Option>
              <Option value="DISPATCHED">Đang luân chuyển</Option>
              <Option value="RECEIVED">Đã nhận kho đích</Option>
              <Option value="UNSEALED">Đã cắt chì / Mở bao</Option>
            </Select>
          </div>

          <Text type="secondary" className="text-xs">
            Hiển thị {filteredBags.length} / {bags.length} bao tải
          </Text>
        </div>

        <Table
          columns={columns}
          dataSource={filteredBags}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          className="overflow-x-auto"
        />
      </Card>

      {/* Drawer: Bàn Đóng Bao Tải Chi Tiết (Active Bag Workspace) */}
      <Drawer
        title={
          <div className="flex items-center justify-between pr-4">
            <div className="flex items-center gap-2">
              <Package size={20} className="text-blue-600" />
              <span className="font-bold text-base">Bàn Đóng Bao: {activeBag?.bagCode}</span>
              {activeBag && (
                <Tag color={STATUS_TAGS[activeBag.status]?.color || 'default'} className="ml-2 font-medium">
                  {STATUS_TAGS[activeBag.status]?.label || activeBag.status}
                </Tag>
              )}
            </div>
          </div>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        destroyOnClose
      >
        {activeBag && (
          <div className="space-y-6">
            {/* Header thông tin bao */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500 block">Kho xuất phát:</span>
                  <span className="font-bold text-gray-800">{activeBag.originWarehouseName}</span>
                </div>
                <ArrowRight size={18} className="text-blue-500" />
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Kho / Hub đích:</span>
                  <span className="font-bold text-red-600">{activeBag.destWarehouseName}</span>
                </div>
              </div>

              <Divider className="my-2" />

              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-500">Số kiện hiện có: </span>
                  <span className="font-bold text-base text-blue-700">{activeBag.totalItems} kiện</span>
                </div>
                <div>
                  <span className="text-gray-500">Tổng trọng lượng: </span>
                  <span className="font-bold text-base text-gray-800">{Number(activeBag.totalWeightKg).toFixed(2)} kg</span>
                </div>
                {activeBag.sealNumber && (
                  <div>
                    <span className="text-gray-500">Mã Seal chì: </span>
                    <span className="font-mono font-bold text-red-600">{activeBag.sealNumber}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ô quét mã vận đơn (chỉ cho phép khi trạng thái OPEN) */}
            {activeBag.status === 'OPEN' ? (
              <form onSubmit={handleScanItem} className="space-y-2">
                <Text strong className="text-gray-800 text-sm block">
                  Bắn mã vạch đơn hàng để gom vào bao (Súng barcode hoặc gõ Enter):
                </Text>
                <div className="flex gap-2">
                  <Input
                    ref={scanInputRef}
                    size="large"
                    prefix={<Barcode size={20} className="text-gray-400" />}
                    placeholder="Quét mã vận đơn (ví dụ: RKP...)"
                    value={scanItemInput}
                    onChange={(e) => setScanItemInput(e.target.value)}
                    disabled={scanningItem}
                    className="font-mono font-bold text-base"
                  />
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    loading={scanningItem}
                    className="bg-blue-600 hover:bg-blue-700 font-semibold"
                  >
                    Nạp vào bao
                  </Button>
                </div>
              </form>
            ) : (
              <Alert
                type="info"
                message={`Bao tải này đã được ${STATUS_TAGS[activeBag.status]?.label || activeBag.status}`}
                description="Không thể thêm hoặc gỡ kiện hàng khỏi bao tải đã được niêm phong."
                showIcon
              />
            )}

            {/* Bảng danh sách kiện hàng bên trong */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Text strong className="text-sm text-gray-700">
                  Danh sách kiện hàng trong bao ({activeBag.items?.length || 0}):
                </Text>
                {activeBag.status === 'OPEN' && activeBag.totalItems > 0 && (
                  <Button
                    type="primary"
                    icon={<Lock size={14} />}
                    onClick={() => handleOpenSealModal(activeBag)}
                    className="bg-orange-600 hover:bg-orange-700 text-xs"
                  >
                    Kẹp chì niêm phong
                  </Button>
                )}
              </div>

              <Table
                dataSource={activeBag.items || []}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                size="small"
                columns={[
                  {
                    title: 'Mã Vận Đơn',
                    dataIndex: 'trackingCode',
                    key: 'trackingCode',
                    render: (c: string) => <span className="font-mono font-bold text-red-600 text-xs">{c}</span>,
                  },
                  {
                    title: 'Tên hàng hóa',
                    dataIndex: 'itemName',
                    key: 'itemName',
                    ellipsis: true,
                    render: (n: string) => <span className="text-xs">{n || '-'}</span>,
                  },
                  {
                    title: 'Routing Code',
                    dataIndex: 'routingCode',
                    key: 'routingCode',
                    render: (rc: string) => <Tag color="blue" className="font-mono text-xs">{rc || '-'}</Tag>,
                  },
                  {
                    title: 'Cân nặng',
                    dataIndex: 'weightGram',
                    key: 'weightGram',
                    render: (w: number) => <span className="text-xs font-semibold">{w} g</span>,
                  },
                  {
                    title: '',
                    key: 'del',
                    render: (_: any, item: any) =>
                      activeBag.status === 'OPEN' ? (
                        <Popconfirm
                          title="Gỡ kiện hàng khỏi bao?"
                          onConfirm={() => handleRemoveItem(item.trackingCode)}
                          okText="Gỡ"
                          cancelText="Hủy"
                        >
                          <Button type="link" danger size="small" icon={<Trash2 size={14} />} />
                        </Popconfirm>
                      ) : null,
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal Tạo Bao Tải Mới & Kẹp Chì */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-red-600">
            <Plus size={20} />
            Khởi Tạo Bao Tải Gom Hàng & Kẹp Chì Niêm Phong
          </div>
        }
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCreateModalOpen(false)}>
            Hủy
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={creating}
            onClick={handleCreateBag}
            icon={<Lock size={16} />}
            className="bg-red-600 hover:bg-red-700 font-bold"
          >
            Tạo bao tải & Kẹp chì ({scannedItems.length} kiện)
          </Button>,
        ]}
        width={720}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" className="mt-2 space-y-3">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="originWarehouseId"
                label={
                  <span className="font-semibold text-xs text-gray-700">
                    Kho / Bưu cục xuất phát (Nơi gom hàng){' '}
                    <Tag color="blue" className="ml-1 text-[10px]">
                      Cố định địa điểm của bạn
                    </Tag>
                  </span>
                }
                rules={[{ required: true, message: 'Vui lòng chọn kho xuất phát' }]}
              >
                <Select disabled placeholder="Kho / bưu cục xuất phát">
                  {warehouses.map((w) => (
                    <Option key={w.id} value={w.id}>
                      {w.name} ({w.type})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="destWarehouseId"
                label={
                  <span className="font-semibold text-xs text-red-700">
                    * Kho / Hub đích đến (Nơi tiếp nhận bao)
                  </span>
                }
                rules={[{ required: true, message: 'Vui lòng chọn kho đích đến' }]}
              >
                <Select placeholder="Chọn kho / Hub đích đến" showSearch optionFilterProp="children">
                  {warehouses
                    .filter((w) => w.id !== createForm.getFieldValue('originWarehouseId'))
                    .map((w) => (
                      <Option key={w.id} value={w.id}>
                        {w.name} ({w.type})
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="sealNumber"
                label={
                  <span className="font-semibold text-xs text-orange-700">
                    * Mã số kẹp chì kim loại / Seal nhựa
                  </span>
                }
                rules={[{ required: true, message: 'Vui lòng nhập mã số kẹp chì' }]}
              >
                <Input
                  prefix={<Barcode size={18} className="text-gray-400" />}
                  placeholder="Nhập hoặc quét mã chì niêm phong..."
                  className="font-mono font-bold"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="notes"
                label={<span className="font-semibold text-xs text-gray-700">Ghi chú bao tải</span>}
              >
                <Input placeholder="Ví dụ: Hàng dễ vỡ, bưu phẩm hỏa tốc..." />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-2" />

          {/* Phần quét mã đơn hàng gom vào bao */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <Barcode size={16} className="text-blue-600" />
                Quét / Nhập mã vận đơn muốn cho vào bao tải:
              </span>
              <span className="text-xs text-gray-500">
                Đã quét: <strong className="text-blue-700 font-bold">{scannedItems.length}</strong> kiện | Tổng cân nặng:{' '}
                <strong className="text-gray-800 font-bold">
                  {(scannedItems.reduce((acc, it) => acc + (it.weightGram || 500), 0) / 1000).toFixed(2)} kg
                </strong>
              </span>
            </div>

            <div className="flex gap-2">
              <Input
                size="large"
                prefix={<Barcode size={20} className="text-gray-400" />}
                placeholder="Quét mã vận đơn (VD: RKP261124...) rồi nhấn Enter"
                value={newBagScanInput}
                onChange={(e) => setNewBagScanInput(e.target.value)}
                onPressEnter={handleAddTrackingToNewBag}
                className="font-mono font-bold"
                disabled={checkingItem}
              />
              <Button
                type="primary"
                size="large"
                onClick={handleAddTrackingToNewBag}
                loading={checkingItem}
                className="bg-blue-600 hover:bg-blue-700 font-semibold"
              >
                Thêm đơn
              </Button>
            </div>

            {/* Bảng danh sách các đơn đã quét */}
            <div className="border rounded-xl overflow-hidden mt-2">
              <Table
                dataSource={scannedItems}
                rowKey="trackingCode"
                size="small"
                pagination={{ pageSize: 5 }}
                locale={{ emptyText: 'Chưa có đơn hàng nào được quét vào bao tải' }}
                columns={[
                  {
                    title: 'STT',
                    key: 'stt',
                    width: 50,
                    align: 'center' as const,
                    render: (_: any, __: any, index: number) => index + 1,
                  },
                  {
                    title: 'Mã Vận Đơn',
                    dataIndex: 'trackingCode',
                    key: 'trackingCode',
                    render: (c: string) => <span className="font-mono font-bold text-blue-700 text-xs">{c}</span>,
                  },
                  {
                    title: 'Hàng Hóa',
                    dataIndex: 'itemName',
                    key: 'itemName',
                    render: (name: string) => <span className="text-xs text-gray-800 font-medium">{name}</span>,
                  },
                  {
                    title: 'Trọng lượng',
                    dataIndex: 'weightGram',
                    key: 'weightGram',
                    align: 'right' as const,
                    render: (w: number) => <span className="text-xs font-semibold text-gray-700">{w || 500}g</span>,
                  },
                  {
                    title: '',
                    key: 'action',
                    width: 50,
                    align: 'center' as const,
                    render: (_: any, record: any) => (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<Trash2 size={14} />}
                        onClick={() => handleRemoveTrackingFromNewBag(record.trackingCode)}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </div>
        </Form>
      </Modal>

      {/* Modal Kẹp Chì (Seal) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-orange-600">
            <Lock size={18} />
            Niêm Phong Kẹp Chì Bao Tải [{activeBag?.bagCode}]
          </div>
        }
        open={sealModalOpen}
        onCancel={() => setSealModalOpen(false)}
        onOk={handleConfirmSeal}
        confirmLoading={sealing}
        okText="Xác nhận kẹp chì"
        cancelText="Hủy"
        destroyOnClose
      >
        <div className="my-2">
          <Alert
            type="warning"
            message="Lưu ý kẹp chì"
            description="Sau khi kẹp chì, bao tải sẽ bị khóa hoàn toàn. Không thể nạp thêm hoặc gỡ bỏ kiện hàng cho đến khi bao được cắt chì tại kho đích."
            showIcon
            className="mb-4"
          />
          <Form form={sealForm} layout="vertical">
            <Form.Item
              name="sealNumber"
              label="Mã số kẹp chì kim loại / Seal nhựa (Quét barcode hoặc nhập số)"
              rules={[{ required: true, message: 'Vui lòng nhập mã kẹp chì' }]}
            >
              <Input
                size="large"
                prefix={<Barcode size={20} className="text-gray-400" />}
                placeholder="Nhập hoặc quét mã số kẹp chì..."
                className="font-mono font-bold text-base"
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* ================= MODAL QUÉT TIẾP NHẬN & NHẬP KHO BAO TẢI (SÚNG / CAMERA) ================= */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-6 w-full">
            <div className="flex items-center gap-2 text-base font-bold text-purple-800">
              <Scan size={22} className="text-purple-600" />
              <span>Quét Nhập Kho Bao Tải (Súng Barcode / Camera)</span>
            </div>
            <div className="flex items-center gap-2">
              {scanMode === 'CAMERA' && (
                <>
                  <Button
                    size="small"
                    icon={isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-xs font-medium"
                  >
                    {isMuted ? 'Bật âm' : 'Tắt âm'}
                  </Button>
                  <Button
                    size="small"
                    icon={<RefreshCw size={14} />}
                    onClick={handleSwitchCamera}
                    className="text-xs font-medium"
                  >
                    Đổi Cam
                  </Button>
                </>
              )}
            </div>
          </div>
        }
        open={hubScanModalOpen}
        onCancel={handleCloseHubScanModal}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={handleCloseHubScanModal}
            className="bg-purple-600 hover:bg-purple-700 font-bold px-6"
          >
            Hoàn tất & Đóng
          </Button>,
        ]}
        width={680}
        destroyOnClose={false}
      >
        <div className="my-2 space-y-4">
          {/* Chọn kho tiếp nhận */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-purple-50 p-3 rounded-xl border border-purple-200 text-xs gap-2">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-purple-700 shrink-0" />
              <span className="font-bold text-purple-900">Kho Tiếp Nhận:</span>
              <Select
                size="middle"
                value={hubSelectedWarehouseId}
                onChange={(val) => setHubSelectedWarehouseId(val)}
                className="min-w-[240px]"
              >
                {warehouses.map((wh) => (
                  <Option key={wh.id} value={wh.id}>
                    {wh.name} {wh.type === 'HUB' ? '(Hub Trung Tâm)' : '(Bưu Cục)'}
                  </Option>
                ))}
              </Select>
            </div>
            <Tag color="purple" className="font-semibold text-xs self-start sm:self-center">
              Tác Nghiệp Nhập Kho
            </Tag>
          </div>

          {/* Toggle Chế độ: CAMERA vs SÚNG QUÉT */}
          <Segmented
            size="large"
            block
            value={scanMode}
            onChange={(val) => handleSwitchScanMode(val as 'CAMERA' | 'GUN')}
            options={[
              {
                label: (
                  <div className="flex items-center justify-center gap-2 py-1.5 font-bold">
                    <Camera size={18} className="text-blue-600" />
                    <span>Quét Bằng Camera (Điện thoại / Webcam)</span>
                  </div>
                ),
                value: 'CAMERA',
              },
              {
                label: (
                  <div className="flex items-center justify-center gap-2 py-1.5 font-bold">
                    <Barcode size={18} className="text-purple-600" />
                    <span>Súng Bắn Barcode / Nhập Tay</span>
                  </div>
                ),
                value: 'GUN',
              },
            ]}
          />

          {/* THÔNG BÁO PHẢN HỒI KẾT QUẢ QUÉT GẦN NHẤT */}
          {lastScannedFeedback && (
            <Alert
              message={
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span>{lastScannedFeedback.success ? '✅ Tiếp Nhận Thành Công' : '⚠️ Lỗi Tiếp Nhận'}</span>
                    <span className="text-xs font-normal text-gray-500">{lastScannedFeedback.time}</span>
                  </div>
                  <div className="text-xs text-gray-700">{lastScannedFeedback.message}</div>
                </div>
              }
              type={lastScannedFeedback.success ? 'success' : 'error'}
              showIcon
              className="rounded-xl border shadow-xs"
            />
          )}

          {/* NỘI DUNG CHẾ ĐỘ CAMERA */}
          {scanMode === 'CAMERA' && (
            <div className="space-y-2">
              <div className="relative rounded-2xl overflow-hidden border-2 border-purple-500 bg-black shadow-lg">
                <div id="hub-bag-camera-reader" className="w-full" style={{ minHeight: '300px' }} />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/80 p-4 text-center">
                    <RefreshCw className="animate-spin text-3xl text-purple-400 mb-2" size={32} />
                    <p className="text-sm font-semibold mb-0">Đang khởi động Camera quét mã bao tải...</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Vui lòng cấp quyền truy cập Camera máy ảnh trên trình duyệt.
                    </p>
                  </div>
                )}
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Camera Trực Tiếp Sẵn Sàng</span>
                </div>
              </div>
              <div className="text-center text-xs text-gray-500 italic">
                💡 Hướng camera vào mã vạch Code-128 hoặc mã QR trên tem dán bao tải A6 để hệ thống tự động nhận diện và nhập kho.
              </div>
            </div>
          )}

          {/* NỘI DUNG CHẾ ĐỘ SÚNG BẮN BARCODE */}
          {scanMode === 'GUN' && (
            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-xl space-y-3">
              <label className="text-xs font-extrabold text-purple-900 uppercase tracking-wide block">
                Bắn Súng Quét Barcode Mã Bao Tải Hoặc Mã Seal (Enter):
              </label>
              <div className="flex items-center gap-2">
                <Input
                  ref={gunInputRef}
                  size="large"
                  prefix={<Barcode size={22} className="text-purple-600" />}
                  placeholder="Quét mã bao tải (VD: BAG2611...) hoặc mã Seal rồi nhấn Enter..."
                  value={hubScanInput}
                  onChange={(e) => setHubScanInput(e.target.value)}
                  onPressEnter={() => handleProcessInboundCode(hubScanInput)}
                  className="font-mono font-bold text-lg h-12 uppercase"
                  autoFocus
                />
                <Button
                  type="primary"
                  onClick={() => handleProcessInboundCode(hubScanInput)}
                  loading={hubScanning}
                  className="bg-purple-600 hover:bg-purple-700 h-12 px-6 font-bold"
                >
                  Nhập Kho
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 mb-0">
                * Đầu đọc súng quét barcode khi bắn vào tem sẽ tự động nạp mã và gửi lệnh Enter để xác nhận nhập kho.
              </p>
            </div>
          )}

          {/* DANH SÁCH BAO TẢI ĐÃ TIẾP NHẬN PHIÊN NÀY */}
          {sessionScannedBags.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                <span>Danh Sách Bao Đã Nhập Kho Phiên Này ({sessionScannedBags.length} bao):</span>
                <Button
                  size="small"
                  type="link"
                  onClick={() => setSessionScannedBags([])}
                  className="text-xs text-gray-500 p-0"
                >
                  Xóa danh sách
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white shadow-inner">
                {sessionScannedBags.map((bag, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-gray-50">
                    <div>
                      <span className="font-mono font-bold text-blue-700">{bag.bagCode}</span>
                      {bag.sealNumber && (
                        <span className="ml-2 font-mono text-[11px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                          Seal: {bag.sealNumber}
                        </span>
                      )}
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {bag.originWarehouseName} ➔ {bag.destWarehouseName} | {bag.totalItems} kiện | {bag.totalWeightKg} kg
                      </div>
                    </div>
                    <div className="text-right">
                      <Tag color="green" className="text-[11px] font-semibold">
                        Đã nhập kho
                      </Tag>
                      <div className="text-[10px] text-gray-400 mt-0.5">{bag.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal In Nhãn Nhiệt Bao Tải A6 */}
      <Modal
        title="Tem Nhãn Dán Bao Tải Master Bag (Khổ A6)"
        open={!!printBag}
        onCancel={() => setPrintBag(null)}
        footer={[
          <Button key="close" onClick={() => setPrintBag(null)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<Printer size={16} />}
            onClick={() => window.print()}
            className="bg-red-600 hover:bg-red-700 font-bold"
          >
            In tem ngay
          </Button>,
        ]}
        width={560}
      >
        {printBag && (
          <div className="py-2">
            <MasterBagThermalLabel bag={printBag} />
          </div>
        )}
      </Modal>
    </div>
  );
};
