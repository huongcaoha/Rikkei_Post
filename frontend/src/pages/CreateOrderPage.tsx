import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Radio, Button, Card, Divider, message, Spin, Checkbox, Tooltip, Tag, Space } from 'antd';
import { Package, User, MapPin, Calculator, CheckCircle, ArrowLeft, BookmarkCheck, RotateCcw, Truck, Crosshair, Navigation, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pricingApi } from '../api/pricing';
import { orderApi } from '../api/order';
import { locationApi } from '../api/location';
import { PriceEstimate, CreateOrderRequest, Ward } from '../types';
import { LocationPickerModal, reverseGeocodeAddress } from '../components/LocationPickerModal';

const STORAGE_SENDER_KEY = 'rkp_saved_sender_info';

// Danh mục tỉnh thành khởi tạo nhanh trước khi API trả về
const INITIAL_PROVINCES: { id: number; name: string }[] = [
  { id: 1, name: 'Hà Nội' },
  { id: 79, name: 'TP. Hồ Chí Minh' },
  { id: 48, name: 'Đà Nẵng' },
  { id: 31, name: 'Hải Phòng' },
  { id: 92, name: 'Cần Thơ' },
  { id: 74, name: 'Bình Dương' },
  { id: 75, name: 'Đồng Nai' },
  { id: 19, name: 'Thái Nguyên' },
  { id: 24, name: 'Bắc Giang' },
  { id: 27, name: 'Bắc Ninh' },
  { id: 46, name: 'Thừa Thiên Huế' },
  { id: 56, name: 'Khánh Hòa' },
  { id: 77, name: 'Bà Rịa - Vũng Tàu' },
  { id: 80, name: 'Long An' },
];

export const CreateOrderPage: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [merchantTotalOrders, setMerchantTotalOrders] = useState<number>(0);

  // Tọa độ GPS & Modal bản đồ vị trí
  const [senderLocation, setSenderLocation] = useState<{ lat?: number; lng?: number } | null>(null);
  const [receiverLocation, setReceiverLocation] = useState<{ lat?: number; lng?: number } | null>(null);
  const [mapModalTarget, setMapModalTarget] = useState<'sender' | 'receiver' | null>(null);

  // Lấy GPS hiện tại cho Người gửi (Shop) và tự động điền địa chỉ
  const handleGetSenderGps = () => {
    if (!navigator.geolocation) {
      message.error('Trình duyệt không hỗ trợ lấy vị trí GPS!');
      return;
    }
    const hide = message.loading('Đang lấy vị trí GPS và nhận diện địa chỉ Shop...', 0);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        hide();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSenderLocation({ lat, lng });
        form.setFieldValue('senderLat', lat);
        form.setFieldValue('senderLng', lng);

        const addr = await reverseGeocodeAddress(lat, lng);
        if (addr) {
          form.setFieldValue('senderAddress', addr);
          message.success(`Đã lấy vị trí GPS và điền địa chỉ Shop: ${addr}`);
        } else {
          message.success(`Đã lấy vị trí GPS của Shop (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
        triggerPriceCalculation(form.getFieldsValue());
      },
      () => {
        hide();
        message.warning('Không thể lấy vị trí GPS (vui lòng bật định vị trên thiết bị/trình duyệt).');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Lấy GPS hiện tại cho Người nhận (Khách hàng) và tự động điền địa chỉ
  const handleGetReceiverGps = () => {
    if (!navigator.geolocation) {
      message.error('Trình duyệt không hỗ trợ lấy vị trí GPS!');
      return;
    }
    const hide = message.loading('Đang lấy vị trí GPS và nhận diện địa chỉ Người nhận...', 0);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        hide();
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setReceiverLocation({ lat, lng });
        form.setFieldValue('receiverLat', lat);
        form.setFieldValue('receiverLng', lng);

        const addr = await reverseGeocodeAddress(lat, lng);
        if (addr) {
          form.setFieldValue('receiverAddress', addr);
          message.success(`Đã lấy vị trí GPS và điền địa chỉ Người nhận: ${addr}`);
        } else {
          message.success(`Đã lấy vị trí GPS của Người nhận (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        }
        triggerPriceCalculation(form.getFieldsValue());
      },
      () => {
        hide();
        message.warning('Không thể lấy vị trí GPS (vui lòng bật định vị trên thiết bị/trình duyệt).');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Danh mục Tỉnh / Thành phố từ cơ sở dữ liệu
  const [provinces, setProvinces] = useState<{ id: number; name: string }[]>(INITIAL_PROVINCES);

  // Danh sách Xã / Phường người gửi & người nhận
  const [senderWards, setSenderWards] = useState<string[]>([
    'Phường Dịch Vọng Hậu',
    'Phường Dịch Vọng',
    'Phường Trung Hòa',
    'Phường Yên Hòa',
    'Phường Láng Thượng',
    'Phường Ô Chợ Dừa',
    'Phường Bách Khoa',
    'Phường Mỹ Đình 1',
    'Phường Mỹ Đình 2',
    'Phường Cầu Diễn',
  ]);

  const [receiverWards, setReceiverWards] = useState<string[]>([
    'Phường Bến Nghé',
    'Phường Bến Thành',
    'Phường Tân Định',
    'Phường Đa Kao',
    'Phường Võ Thị Sáu',
    'Phường Thảo Điền',
    'Phường An Phú',
    'Phường Hiệp Bình Chánh',
    'Phường 1 (Tân Bình)',
    'Phường 12 (Gò Vấp)',
  ]);

  // Tải danh sách Xã / Phường theo Tỉnh
  const loadWardsForProvince = async (provinceId: number, isSender: boolean) => {
    try {
      const wards: Ward[] = await locationApi.getWardsByProvince(provinceId);
      if (wards && wards.length > 0) {
        const names = wards.map((w) => w.name);
        if (isSender) {
          setSenderWards(names);
        } else {
          setReceiverWards(names);
        }
        return names;
      }
    } catch (e) {
      console.warn(`Lỗi khi lấy danh sách Xã/Phường cho tỉnh ${provinceId}:`, e);
    }
    return [];
  };

  // Khởi tạo và nạp thông tin người gửi đã lưu & dữ liệu hành chính
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. Tải danh mục 63 Tỉnh/Thành phố từ Database Backend
      try {
        const provData = await locationApi.getProvinces();
        if (provData && provData.length > 0) {
          setProvinces(provData.map((p) => ({ id: p.id, name: p.name })));
        }
      } catch (e) {
        console.warn('Sử dụng danh mục tỉnh mặc định khi chưa kết nối được API locations');
      }

      // 2. Tải số lượng đơn hàng của Shop để áp dụng chính sách miễn phí lấy hàng (> 5 đơn)
      let shopOrderCount = 0;
      try {
        const stats = await orderApi.getDashboardStats();
        if (stats && typeof stats.totalOrders === 'number') {
          shopOrderCount = stats.totalOrders;
          setMerchantTotalOrders(stats.totalOrders);
        }
      } catch (e) {
        console.warn('Chưa lấy được thống kê số lượng đơn của shop');
      }

      // 3. Kiểm tra LocalStorage người gửi trước
      let savedSender: any = null;
      try {
        const localData = localStorage.getItem(STORAGE_SENDER_KEY);
        if (localData) {
          savedSender = JSON.parse(localData);
        }
      } catch (e) {
        console.warn('Không thể đọc dữ liệu người gửi từ localStorage');
      }

      // 4. Nếu local chưa có, lấy từ Backend MerchantAddress
      if (!savedSender) {
        try {
          const remoteAddr = await orderApi.getDefaultSenderAddress();
          if (remoteAddr) {
            savedSender = {
              senderName: remoteAddr.contactName,
              senderPhone: remoteAddr.contactPhone,
              senderProvinceId: remoteAddr.provinceId,
              senderWardName: remoteAddr.wardName,
              senderAddress: remoteAddr.streetAddress,
            };
          }
        } catch (e) {
          console.warn('Chưa có địa chỉ người gửi mặc định trên server');
        }
      }

      const initialSenderProvinceId = savedSender?.senderProvinceId || 1;
      const initialReceiverProvinceId = 79; // Mặc định TP. Hồ Chí Minh

      // Tải danh sách xã/phường cho cả người gửi và người nhận
      loadWardsForProvince(initialSenderProvinceId, true);
      loadWardsForProvince(initialReceiverProvinceId, false);

      // Khởi tạo giá trị form ban đầu
      const initialValues = {
        senderName: savedSender?.senderName || 'Shop Thời Trang Trẻ',
        senderPhone: savedSender?.senderPhone || '0912345678',
        senderProvinceId: initialSenderProvinceId,
        senderWardName: savedSender?.senderWardName || 'Phường Dịch Vọng Hậu',
        senderAddress: savedSender?.senderAddress || 'Số 10 Phố Chùa Bộc, Đống Đa',
        saveAsDefaultSender: true,

        // Thông tin người nhận
        receiverName: '',
        receiverPhone: '',
        receiverProvinceId: initialReceiverProvinceId,
        receiverWardName: 'Phường Bến Nghé',
        receiverAddress: '',

        itemName: 'Áo sơ mi nam cao cấp',
        itemValue: 450000,
        actualWeightGram: 500,
        lengthCm: 25,
        widthCm: 15,
        heightCm: 5,
        codAmount: 450000,
        paymentParty: 'RECEIVER',
        serviceType: 'STANDARD',
        pickupType: 'DROP_OFF',
        notes: 'Cho xem hàng, không thử',
      };

      form.setFieldsValue(initialValues);
      triggerPriceCalculation(initialValues, shopOrderCount);
    };

    loadInitialData();
  }, []);

  const triggerPriceCalculation = async (values: any, totalOrdersParam?: number) => {
    if (!values.senderProvinceId || !values.receiverProvinceId || !values.actualWeightGram) {
      return;
    }
    setCalculating(true);
    try {
      const estimate = await pricingApi.calculatePrice({
        senderProvinceId: values.senderProvinceId,
        receiverProvinceId: values.receiverProvinceId,
        actualWeightGram: values.actualWeightGram || 500,
        lengthCm: values.lengthCm || 10,
        widthCm: values.widthCm || 10,
        heightCm: values.heightCm || 10,
        itemValue: values.itemValue || 0,
        serviceType: values.serviceType || 'STANDARD',
        pickupType: values.pickupType || 'DROP_OFF',
        merchantTotalOrders: typeof totalOrdersParam === 'number' ? totalOrdersParam : merchantTotalOrders,
      });
      setPriceEstimate(estimate);
    } catch (e) {
      console.error('Lỗi tính cước tạm tính:', e);
    } finally {
      setCalculating(false);
    }
  };

  const handleValuesChange = async (changedValues: any, allValues: any) => {
    // Khi thay đổi Tỉnh người gửi -> tự động tải danh sách Xã/Phường người gửi
    if (changedValues.senderProvinceId) {
      const wardList = await loadWardsForProvince(changedValues.senderProvinceId, true);
      if (wardList.length > 0) {
        form.setFieldValue('senderWardName', wardList[0]);
      } else {
        form.setFieldValue('senderWardName', 'Phường Trung Tâm');
      }
    }

    // Khi thay đổi Tỉnh người nhận -> tự động tải danh sách Xã/Phường người nhận
    if (changedValues.receiverProvinceId) {
      const wardList = await loadWardsForProvince(changedValues.receiverProvinceId, false);
      if (wardList.length > 0) {
        form.setFieldValue('receiverWardName', wardList[0]);
      } else {
        form.setFieldValue('receiverWardName', 'Phường Trung Tâm');
      }
    }

    triggerPriceCalculation(allValues);
  };

  const handleReloadSavedSender = () => {
    try {
      const localData = localStorage.getItem(STORAGE_SENDER_KEY);
      if (localData) {
        const saved = JSON.parse(localData);
        form.setFieldsValue({
          senderName: saved.senderName,
          senderPhone: saved.senderPhone,
          senderProvinceId: saved.senderProvinceId,
          senderWardName: saved.senderWardName,
          senderAddress: saved.senderAddress,
        });
        loadWardsForProvince(saved.senderProvinceId, true);
        message.success('Đã tải lại thông tin người gửi đã lưu!');
        triggerPriceCalculation(form.getFieldsValue());
      } else {
        message.info('Chưa có thông tin người gửi lưu trong bộ nhớ');
      }
    } catch (e) {
      message.error('Không thể tải lại thông tin người gửi');
    }
  };

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      // 1. Lưu thông tin người gửi vào LocalStorage & Backend nếu chọn ghi nhớ
      if (values.saveAsDefaultSender) {
        const senderInfo = {
          senderName: values.senderName,
          senderPhone: values.senderPhone,
          senderProvinceId: values.senderProvinceId,
          senderWardName: values.senderWardName,
          senderAddress: values.senderAddress,
        };
        localStorage.setItem(STORAGE_SENDER_KEY, JSON.stringify(senderInfo));
      }

      // 2. Gửi dữ liệu tạo đơn chuẩn hóa: loại bỏ hoàn toàn mã quận/huyện
      const payload: CreateOrderRequest = {
        ...values,
        senderLat: senderLocation?.lat || values.senderLat,
        senderLng: senderLocation?.lng || values.senderLng,
        receiverLat: receiverLocation?.lat || values.receiverLat,
        receiverLng: receiverLocation?.lng || values.receiverLng,
        senderDistrictId: 0,
        senderWardId: 0,
        receiverDistrictId: 0,
        receiverWardId: 0,
        pickupType: values.pickupType || 'DROP_OFF',
        saveAsDefaultSender: values.saveAsDefaultSender,
      };

      const order = await orderApi.createOrder(payload);
      message.success(`Tạo đơn thành công! Mã vận đơn: ${order.trackingCode}`);
      navigate(`/orders/print/${order.trackingCode}`);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo đơn hàng. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <Button
            icon={<ArrowLeft size={16} />}
            onClick={() => navigate('/orders')}
            className="flex items-center"
          >
            Quay lại
          </Button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tạo Đơn Hàng Mới</h1>
            <p className="text-gray-500 text-sm mt-0.5">Nhập thông tin bưu gửi, tính cước phí tự động và ghi nhớ địa chỉ kho gửi.</p>
          </div>
        </div>

        <Tooltip title="Nạp lại thông tin người gửi đã lưu gần nhất">
          <Button
            icon={<RotateCcw size={15} />}
            onClick={handleReloadSavedSender}
            className="flex items-center text-xs font-semibold"
          >
            Dùng địa chỉ gửi đã lưu
          </Button>
        </Tooltip>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        onValuesChange={handleValuesChange}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Left Column (Inputs) - 2 spans */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Thông tin Người gửi (Kho hàng / Shop) */}
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2 text-gray-800">
                  <MapPin size={18} className="text-red-600" />
                  <span className="font-bold">1. Thông tin Người gửi (Kho hàng / Shop)</span>
                </div>
                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-md font-medium border border-green-200 flex items-center space-x-1">
                  <BookmarkCheck size={12} />
                  <span>Tự động ghi nhớ</span>
                </span>
              </div>
            }
            className="rounded-2xl border-gray-200 shadow-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="senderName" label="Tên người gửi / Tên Shop" rules={[{ required: true, message: 'Vui lòng nhập tên người gửi' }]}>
                <Input placeholder="Tên shop hoặc cá nhân người gửi" />
              </Form.Item>
              <Form.Item name="senderPhone" label="Số điện thoại gửi" rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}>
                <Input placeholder="0912345678" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="senderProvinceId" label="Tỉnh / Thành phố gửi" rules={[{ required: true, message: 'Chọn tỉnh/thành phố' }]}>
                <Select
                  showSearch
                  placeholder="Chọn tỉnh gửi"
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {provinces.map((p) => (
                    <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Chọn trực tiếp Tên Xã / Phường gửi */}
              <Form.Item
                name="senderWardName"
                label="Xã / Phường gửi (Chọn hoặc nhập tên)"
                rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập tên Xã/Phường' }]}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn hoặc nhập tên Xã / Phường gửi"
                  filterOption={(input, option) =>
                    (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {senderWards.map((w) => (
                    <Select.Option key={w} value={w}>{w}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            {/* Địa chỉ chi tiết người gửi kèm Định vị GPS & Chọn bản đồ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-800">
                  <span className="text-red-500 mr-1">*</span>Địa chỉ chi tiết người gửi (Số nhà, tên đường):
                </label>
                <div className="flex items-center space-x-1.5">
                  <Button
                    type="link"
                    size="small"
                    icon={<Crosshair size={14} className="text-red-600" />}
                    onClick={handleGetSenderGps}
                    className="p-0 h-auto text-xs text-red-600 font-semibold hover:text-red-700 flex items-center"
                  >
                    Vị trí hiện tại
                  </Button>
                  <span className="text-gray-300">|</span>
                  <Button
                    type="link"
                    size="small"
                    icon={<MapPin size={14} className="text-blue-600" />}
                    onClick={() => setMapModalTarget('sender')}
                    className="p-0 h-auto text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center"
                  >
                    Chọn trên bản đồ
                  </Button>
                </div>
              </div>

              <Form.Item
                name="senderAddress"
                rules={[{ required: true, message: 'Vui lòng nhập địa chỉ chi tiết người gửi' }]}
                className="mb-2"
              >
                <Input placeholder="Ví dụ: Số 10 Phố Chùa Bộc, Đống Đa, Hà Nội" />
              </Form.Item>

              {senderLocation?.lat && senderLocation?.lng && (
                <div className="mb-3 flex items-center space-x-2 text-xs">
                  <Tag color="cyan" className="font-mono">
                    📍 Tọa độ GPS Shop: [{senderLocation.lat.toFixed(5)}, {senderLocation.lng.toFixed(5)}]
                  </Tag>
                  <a
                    href={`https://www.google.com/maps?q=${senderLocation.lat},${senderLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center"
                  >
                    Xem trên Google Map <ExternalLink size={11} className="ml-0.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Checkbox lưu thông tin người gửi làm mặc định */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between">
              <Form.Item name="saveAsDefaultSender" valuePropName="checked" className="mb-0">
                <Checkbox className="text-xs text-gray-700 font-medium">
                  Lưu thông tin người gửi này làm mặc định (Tự động điền cho các lần tạo đơn sau)
                </Checkbox>
              </Form.Item>
            </div>
          </Card>

          {/* 2. Thông tin Người nhận (Khách hàng) - Thiết kế đồng bộ hoàn toàn với người gửi */}
          <Card
            title={
              <div className="flex items-center space-x-2 text-gray-800">
                <User size={18} className="text-red-600" />
                <span className="font-bold">2. Thông tin Người nhận (Khách hàng)</span>
              </div>
            }
            className="rounded-2xl border-gray-200 shadow-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="receiverName" label="Họ tên người nhận" rules={[{ required: true, message: 'Nhập tên người nhận' }]}>
                <Input placeholder="Nguyễn Văn B" />
              </Form.Item>
              <Form.Item name="receiverPhone" label="Số điện thoại nhận" rules={[{ required: true, message: 'Nhập SĐT nhận' }]}>
                <Input placeholder="0987654321" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="receiverProvinceId" label="Tỉnh / Thành phố nhận" rules={[{ required: true, message: 'Chọn tỉnh/thành phố nhận' }]}>
                <Select
                  showSearch
                  placeholder="Chọn tỉnh nhận"
                  filterOption={(input, option) =>
                    (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {provinces.map((p) => (
                    <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* Chọn trực tiếp Tên Xã / Phường nhận - Chuẩn hóa giống Người gửi */}
              <Form.Item
                name="receiverWardName"
                label="Xã / Phường nhận (Chọn hoặc nhập tên)"
                rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập tên Xã/Phường nhận' }]}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn hoặc nhập tên Xã / Phường nhận"
                  filterOption={(input, option) =>
                    (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {receiverWards.map((w) => (
                    <Select.Option key={w} value={w}>{w}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            {/* Địa chỉ chi tiết người nhận kèm Định vị GPS & Chọn bản đồ */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-800">
                  <span className="text-red-500 mr-1">*</span>Địa chỉ chi tiết người nhận (Số nhà, tên đường):
                </label>
                <div className="flex items-center space-x-1.5">
                  <Button
                    type="link"
                    size="small"
                    icon={<Crosshair size={14} className="text-red-600" />}
                    onClick={handleGetReceiverGps}
                    className="p-0 h-auto text-xs text-red-600 font-semibold hover:text-red-700 flex items-center"
                  >
                    Vị trí hiện tại
                  </Button>
                  <span className="text-gray-300">|</span>
                  <Button
                    type="link"
                    size="small"
                    icon={<MapPin size={14} className="text-blue-600" />}
                    onClick={() => setMapModalTarget('receiver')}
                    className="p-0 h-auto text-xs text-blue-600 font-semibold hover:text-blue-700 flex items-center"
                  >
                    Chọn trên bản đồ
                  </Button>
                </div>
              </div>

              <Form.Item
                name="receiverAddress"
                rules={[{ required: true, message: 'Vui lòng nhập địa chỉ chi tiết người nhận' }]}
                className="mb-2"
              >
                <Input placeholder="Ví dụ: Số 25 Lê Duẩn, Bến Nghé, Quận 1" />
              </Form.Item>

              {receiverLocation?.lat && receiverLocation?.lng && (
                <div className="mb-3 flex items-center space-x-2 text-xs">
                  <Tag color="cyan" className="font-mono">
                    📍 Tọa độ GPS Người nhận: [{receiverLocation.lat.toFixed(5)}, {receiverLocation.lng.toFixed(5)}]
                  </Tag>
                  <a
                    href={`https://www.google.com/maps?q=${receiverLocation.lat},${receiverLocation.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center"
                  >
                    Xem trên Google Map <ExternalLink size={11} className="ml-0.5" />
                  </a>
                </div>
              )}
            </div>
          </Card>

          {/* 3. Bưu gửi, Phương thức lấy hàng & Gói cước */}
          <Card
            title={
              <div className="flex items-center space-x-2 text-gray-800">
                <Package size={18} className="text-red-600" />
                <span className="font-bold">3. Thông tin Bưu gửi & Phương thức bàn giao</span>
              </div>
            }
            className="rounded-2xl border-gray-200 shadow-xs"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="itemName" label="Tên hàng hóa" rules={[{ required: true, message: 'Nhập tên hàng hóa' }]}>
                <Input placeholder="Quần áo, phụ kiện điện tử..." />
              </Form.Item>
              <Form.Item name="itemValue" label="Giá trị khai giá (VNĐ)">
                <InputNumber
                  className="w-full"
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
                  placeholder="500,000"
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Form.Item name="actualWeightGram" label="Trọng lượng (gram)" rules={[{ required: true, message: 'Bắt buộc' }]}>
                <InputNumber className="w-full" min={1} placeholder="500" />
              </Form.Item>
              <Form.Item name="lengthCm" label="Dài (cm)">
                <InputNumber className="w-full" min={1} placeholder="20" />
              </Form.Item>
              <Form.Item name="widthCm" label="Rộng (cm)">
                <InputNumber className="w-full" min={1} placeholder="15" />
              </Form.Item>
              <Form.Item name="heightCm" label="Cao (cm)">
                <InputNumber className="w-full" min={1} placeholder="10" />
              </Form.Item>
            </div>

            {/* Phương thức Shop giao đơn (Theo yêu cầu) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm font-bold text-gray-800 flex items-center space-x-2">
                  <Truck size={17} className="text-red-600" />
                  <span>Phương thức Shop gửi đơn hàng</span>
                </span>
                {merchantTotalOrders > 5 ? (
                  <Tag color="gold" className="font-semibold text-xs border-amber-300">
                    🎉 Shop thân thiết ({merchantTotalOrders} đơn) - Miễn phí lấy hàng 100%
                  </Tag>
                ) : (
                  <span className="text-xs text-gray-500">
                    Đã có: <b className="text-red-600 font-bold">{merchantTotalOrders}</b>/5 đơn để mở khóa Miễn Phí lấy hàng
                  </span>
                )}
              </div>

              <Form.Item name="pickupType" className="mb-0">
                <Radio.Group className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Radio.Button
                    value="DROP_OFF"
                    className="h-auto py-3 px-4 rounded-xl border border-gray-200 flex flex-col items-start hover:border-red-400"
                  >
                    <div className="font-bold text-gray-800">1. Shop giao đến bưu cục</div>
                    <div className="text-xs text-gray-500 font-normal mt-0.5">
                      Chủ động mang hàng ra bưu cục Rikkei Post • <span className="text-green-600 font-semibold">Miễn phí (0 đ)</span>
                    </div>
                  </Radio.Button>

                  <Radio.Button
                    value="DOOR_PICKUP"
                    className="h-auto py-3 px-4 rounded-xl border border-gray-200 flex flex-col items-start hover:border-red-400"
                  >
                    <div className="font-bold text-gray-800 flex items-center justify-between w-full">
                      <span>2. Ship bưu cục đến tận nơi lấy</span>
                      {merchantTotalOrders > 5 && (
                        <span className="text-[11px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded">FREE</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-normal mt-0.5">
                      {merchantTotalOrders > 5 ? (
                        <span className="text-green-600 font-bold">Miễn phí 100% cho Shop thân thiết &gt; 5 đơn</span>
                      ) : (
                        <span>
                          <b className="text-red-600">15.000 đ</b> (Đơn nhỏ) • Hàng to/cồng kềnh tính theo kg &amp; kích thước
                        </span>
                      )}
                    </div>
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="serviceType" label="Gói dịch vụ vận chuyển">
                <Radio.Group buttonStyle="solid" className="w-full grid grid-cols-2 text-center">
                  <Radio.Button value="STANDARD">Tiết kiệm (Standard)</Radio.Button>
                  <Radio.Button value="EXPRESS">Hỏa tốc (Express)</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="paymentParty" label="Bên trả tiền cước">
                <Radio.Group buttonStyle="solid" className="w-full grid grid-cols-2 text-center">
                  <Radio.Button value="RECEIVER">Khách nhận trả</Radio.Button>
                  <Radio.Button value="SENDER">Shop trả</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item name="codAmount" label="Tiền thu hộ COD (VNĐ)">
                <InputNumber
                  className="w-full"
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
                  placeholder="0"
                />
              </Form.Item>

              <Form.Item name="notes" label="Ghi chú phát hàng">
                <Input placeholder="Cho xem hàng, không thử..." />
              </Form.Item>
            </div>
          </Card>
        </div>

        {/* Right Column (Dynamic Pricing Card Sticky) - 1 span */}
        <div className="space-y-6">
          <Card
            title={
              <div className="flex items-center space-x-2 text-gray-800">
                <Calculator size={18} className="text-red-600" />
                <span className="font-bold">Ước tính Cước phí Động</span>
              </div>
            }
            className="rounded-2xl border-gray-200 shadow-md sticky top-6"
          >
            {calculating ? (
              <div className="py-8 text-center">
                <Spin tip="Đang tính cước phí..." />
              </div>
            ) : priceEstimate ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Trọng lượng thực tế:</span>
                    <span className="font-bold text-gray-800">{priceEstimate.actualWeightGram}g</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Trọng lượng quy đổi (DxRxC/6000):</span>
                    <span className="font-bold text-gray-800">{priceEstimate.volumetricWeightGram}g</span>
                  </div>
                  <div className="flex justify-between text-gray-900 border-t border-gray-200 pt-1 font-semibold">
                    <span>Trọng lượng tính cước (Max):</span>
                    <span className="font-bold text-red-600">{priceEstimate.billableWeightGram}g</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Vùng cước:</span>
                    <span className="font-bold text-blue-600">{priceEstimate.zoneType}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Dự kiến giao:</span>
                    <span className="font-bold text-green-700">{priceEstimate.estimatedDeliveryHours} giờ</span>
                  </div>
                </div>

                <Divider className="my-2" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Cước vận chuyển chính:</span>
                    <span>{Number(priceEstimate.shippingFee).toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Phí bảo hiểm khai giá:</span>
                    <span>{Number(priceEstimate.insuranceFee).toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Phí bưu tá đến lấy:</span>
                    {priceEstimate.pickupFee && priceEstimate.pickupFee > 0 ? (
                      <span className="font-bold text-orange-600">
                        +{Number(priceEstimate.pickupFee).toLocaleString('vi-VN')} đ
                      </span>
                    ) : (
                      <span className="font-bold text-green-600">
                        {priceEstimate.isPickupFree ? '0 đ (Miễn phí > 5 đơn)' : '0 đ (Tại bưu cục)'}
                      </span>
                    )}
                  </div>
                  {priceEstimate.pickupFeeNote && (
                    <div className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 p-2 rounded-lg">
                      {priceEstimate.pickupFeeNote}
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-red-600 border-t border-gray-200 pt-2">
                    <span>TỔNG CƯỚC TẠM TÍNH:</span>
                    <span>{Number(priceEstimate.totalFee).toLocaleString('vi-VN')} đ</span>
                  </div>
                </div>

                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  loading={loading}
                  icon={<CheckCircle size={18} />}
                  className="w-full bg-red-600 hover:bg-red-700 h-12 text-base font-bold rounded-xl shadow-lg mt-4 flex items-center justify-center"
                >
                  Xác nhận Tạo đơn hàng
                </Button>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-6 text-sm">
                Vui lòng điền đủ tỉnh gửi, nhận và trọng lượng để tính cước.
              </div>
            )}
          </Card>
        </div>
      </Form>

      {/* Modal chọn vị trí trên bản đồ tương tác / Google Maps */}
      <LocationPickerModal
        open={mapModalTarget !== null}
        onClose={() => setMapModalTarget(null)}
        title={mapModalTarget === 'sender' ? 'Chọn Vị Trí Shop / Người Gửi Trên Bản Đồ' : 'Chọn Vị Trí Người Nhận Trên Bản Đồ'}
        initialLat={mapModalTarget === 'sender' ? senderLocation?.lat : receiverLocation?.lat}
        initialLng={mapModalTarget === 'sender' ? senderLocation?.lng : receiverLocation?.lng}
        onSelectLocation={(lat, lng, addressText) => {
          if (mapModalTarget === 'sender') {
            setSenderLocation({ lat, lng });
            form.setFieldValue('senderLat', lat);
            form.setFieldValue('senderLng', lng);
            if (addressText) {
              form.setFieldValue('senderAddress', addressText);
            }
          } else {
            setReceiverLocation({ lat, lng });
            form.setFieldValue('receiverLat', lat);
            form.setFieldValue('receiverLng', lng);
            if (addressText) {
              form.setFieldValue('receiverAddress', addressText);
            }
          }
          triggerPriceCalculation(form.getFieldsValue());
        }}
      />
    </div>
  );
};
