import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  InputNumber,
  Select,
  Switch,
  Tag,
  Space,
  Popconfirm,
  message,
  Tabs,
  Typography,
  Divider,
  Alert,
  Spin,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  DollarSign,
  Plus,
  Edit2,
  Trash2,
  Sliders,
  Calculator,
  ShieldCheck,
  Truck,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { pricingApi } from '../api/pricing';
import { locationApi } from '../api/location';
import { PricingMatrixItem, PricingMatrixRequest, PricingPolicy, Province, PriceEstimate } from '../types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Định nghĩa nhãn hiển thị cho vùng cước
const ZONE_LABELS: Record<string, { label: string; color: string }> = {
  INTRA_PROVINCE: { label: 'Nội tỉnh', color: 'blue' },
  INTRA_REGION: { label: 'Nội vùng', color: 'cyan' },
  INTER_REGION_NEAR: { label: 'Liên vùng gần', color: 'orange' },
  INTER_REGION_FAR: { label: 'Liên vùng xa', color: 'volcano' },
};

// Định nghĩa nhãn cho loại dịch vụ
const SERVICE_LABELS: Record<string, { label: string; color: string }> = {
  STANDARD: { label: 'Chuyển phát Tiêu chuẩn', color: 'blue' },
  EXPRESS: { label: 'Chuyển phát Hỏa tốc', color: 'red' },
  ROAD_FREIGHT: { label: 'Vận tải Đường bộ', color: 'purple' },
  SAME_DAY: { label: 'Giao trong ngày', color: 'magenta' },
};

export const PricingManagementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('matrix');
  const [loading, setLoading] = useState<boolean>(false);
  const [matrices, setMatrices] = useState<PricingMatrixItem[]>([]);
  const [policy, setPolicy] = useState<PricingPolicy | null>(null);

  // Bộ lọc bảng cước
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');

  // Modal Matrix (Thêm / Sửa)
  const [matrixModalVisible, setMatrixModalVisible] = useState<boolean>(false);
  const [editingMatrix, setEditingMatrix] = useState<PricingMatrixItem | null>(null);
  const [matrixForm] = Form.useForm();
  const [savingMatrix, setSavingMatrix] = useState<boolean>(false);

  // Form Policy
  const [policyForm] = Form.useForm();
  const [savingPolicy, setSavingPolicy] = useState<boolean>(false);

  // Công cụ tính cước Simulator
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [calcForm] = Form.useForm();
  const [simResult, setSimResult] = useState<PriceEstimate | null>(null);
  const [calculating, setCalculating] = useState<boolean>(false);

  // Tải dữ liệu ban đầu
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [matrixData, policyData, provsData] = await Promise.all([
        pricingApi.getAllPricingMatrices(),
        pricingApi.getPricingPolicy(),
        locationApi.getProvinces().catch(() => []),
      ]);
      setMatrices(matrixData || []);
      setPolicy(policyData);
      setProvinces(provsData || []);

      if (policyData) {
        policyForm.setFieldsValue({
          doorPickupBaseFee: policyData.doorPickupBaseFee,
          freePickupOrderThreshold: policyData.freePickupOrderThreshold,
          bulkyWeightThresholdGram: policyData.bulkyWeightThresholdGram,
          bulkyMaxDimensionCm: policyData.bulkyMaxDimensionCm,
          bulkySumDimensionsCm: policyData.bulkySumDimensionsCm,
          bulkyExtraPricePerKg: policyData.bulkyExtraPricePerKg,
          oversizeDimensionFee: policyData.oversizeDimensionFee,
          insuranceValueThreshold: policyData.insuranceValueThreshold,
          insurancePercentRate: Number(policyData.insurancePercentRate) * 100, // đổi ra % hiển thị
        });
      }
    } catch (err: any) {
      message.error('Không thể tải cấu hình giá cước: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddMatrix = () => {
    setEditingMatrix(null);
    matrixForm.resetFields();
    matrixForm.setFieldsValue({
      serviceType: 'STANDARD',
      zoneType: 'INTRA_PROVINCE',
      baseWeightGram: 500,
      basePrice: 16000,
      stepWeightGram: 500,
      stepPrice: 3000,
      estimatedDeliveryHours: 24,
      isActive: true,
    });
    setMatrixModalVisible(true);
  };

  const handleOpenEditMatrix = (item: PricingMatrixItem) => {
    setEditingMatrix(item);
    matrixForm.setFieldsValue({
      serviceType: item.serviceType,
      zoneType: item.zoneType,
      baseWeightGram: item.baseWeightGram,
      basePrice: item.basePrice,
      stepWeightGram: item.stepWeightGram,
      stepPrice: item.stepPrice,
      estimatedDeliveryHours: item.estimatedDeliveryHours,
      isActive: item.isActive,
    });
    setMatrixModalVisible(true);
  };

  const handleSaveMatrix = async () => {
    try {
      const values = await matrixForm.validateFields();
      setSavingMatrix(true);

      const payload: PricingMatrixRequest = {
        serviceType: values.serviceType,
        zoneType: values.zoneType,
        baseWeightGram: values.baseWeightGram,
        basePrice: values.basePrice,
        stepWeightGram: values.stepWeightGram,
        stepPrice: values.stepPrice,
        estimatedDeliveryHours: values.estimatedDeliveryHours,
        isActive: values.isActive,
      };

      if (editingMatrix) {
        await pricingApi.updatePricingMatrix(editingMatrix.id, payload);
        message.success('Cập nhật cấu hình cước thành công!');
      } else {
        await pricingApi.createPricingMatrix(payload);
        message.success('Thêm mới cấu hình cước thành công!');
      }

      setMatrixModalVisible(false);
      const updatedList = await pricingApi.getAllPricingMatrices();
      setMatrices(updatedList || []);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu cấu hình cước');
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleDeleteMatrix = async (id: number) => {
    try {
      await pricingApi.deletePricingMatrix(id);
      message.success('Đã xóa cấu hình cước thành công');
      setMatrices(matrices.filter((m) => m.id !== id));
    } catch (err: any) {
      message.error('Không thể xóa cấu hình cước: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      const updated = await pricingApi.togglePricingMatrixActive(id);
      message.success(
        `Đã ${updated.isActive ? 'kích hoạt' : 'tạm dừng'} cấu hình ${updated.serviceType} - ${updated.zoneType}`
      );
      setMatrices(matrices.map((m) => (m.id === id ? updated : m)));
    } catch (err: any) {
      message.error('Không thể đổi trạng thái: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleSavePolicy = async () => {
    try {
      const values = await policyForm.validateFields();
      setSavingPolicy(true);

      const payload: PricingPolicy = {
        id: policy?.id,
        doorPickupBaseFee: values.doorPickupBaseFee,
        freePickupOrderThreshold: values.freePickupOrderThreshold,
        bulkyWeightThresholdGram: values.bulkyWeightThresholdGram,
        bulkyMaxDimensionCm: values.bulkyMaxDimensionCm,
        bulkySumDimensionsCm: values.bulkySumDimensionsCm,
        bulkyExtraPricePerKg: values.bulkyExtraPricePerKg,
        oversizeDimensionFee: values.oversizeDimensionFee,
        insuranceValueThreshold: values.insuranceValueThreshold,
        insurancePercentRate: Number(values.insurancePercentRate) / 100, // đổi từ % về thập phân (0.5% -> 0.005)
      };

      const updated = await pricingApi.updatePricingPolicy(payload);
      setPolicy(updated);
      message.success('Lưu chính sách phụ phí thành công! Mọi đơn hàng mới sẽ tự động áp dụng chính sách này.');
    } catch (err: any) {
      message.error('Không thể lưu phụ phí: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleRunSimulator = async () => {
    try {
      const values = await calcForm.validateFields();
      setCalculating(true);
      const res = await pricingApi.calculatePrice({
        senderProvinceId: values.senderProvinceId,
        receiverProvinceId: values.receiverProvinceId,
        actualWeightGram: values.actualWeightGram,
        lengthCm: values.lengthCm || 10,
        widthCm: values.widthCm || 10,
        heightCm: values.heightCm || 10,
        itemValue: values.itemValue || 0,
        serviceType: values.serviceType || 'STANDARD',
        pickupType: values.pickupType || 'DROP_OFF',
        merchantTotalOrders: values.merchantTotalOrders || 0,
      });
      setSimResult(res);
      message.success('Đã tính cước mô phỏng thành công');
    } catch (err: any) {
      message.error('Lỗi tính cước mô phỏng: ' + (err.response?.data?.message || err.message));
    } finally {
      setCalculating(false);
    }
  };

  // Lọc bảng ma trận
  const filteredMatrices = matrices.filter((m) => {
    if (serviceFilter !== 'ALL' && m.serviceType !== serviceFilter) return false;
    if (zoneFilter !== 'ALL' && m.zoneType !== zoneFilter) return false;
    return true;
  });

  // Thống kê nhanh
  const totalMatrices = matrices.length;
  const activeMatrices = matrices.filter((m) => m.isActive).length;
  const standardIntra = matrices.find((m) => m.serviceType === 'STANDARD' && m.zoneType === 'INTRA_PROVINCE');

  const columns = [
    {
      title: 'Loại Dịch vụ',
      dataIndex: 'serviceType',
      key: 'serviceType',
      render: (service: string) => {
        const info = SERVICE_LABELS[service] || { label: service, color: 'default' };
        return (
          <Tag color={info.color} className="font-semibold px-2.5 py-1 text-sm">
            {info.label} ({service})
          </Tag>
        );
      },
    },
    {
      title: 'Tuyến / Vùng cước',
      dataIndex: 'zoneType',
      key: 'zoneType',
      render: (zone: string) => {
        const info = ZONE_LABELS[zone] || { label: zone, color: 'default' };
        return (
          <Tag color={info.color} className="font-medium">
            {info.label} ({zone})
          </Tag>
        );
      },
    },
    {
      title: 'Cước cơ sở',
      key: 'baseRate',
      render: (_: any, record: PricingMatrixItem) => (
        <div>
          <span className="font-bold text-red-600 text-base">
            {Number(record.basePrice).toLocaleString('vi-VN')} đ
          </span>
          <div className="text-xs text-gray-500">Mức đầu: {record.baseWeightGram}g</div>
        </div>
      ),
    },
    {
      title: 'Cước nấc tăng thêm',
      key: 'stepRate',
      render: (_: any, record: PricingMatrixItem) => (
        <div>
          <span className="font-semibold text-gray-800">
            +{Number(record.stepPrice).toLocaleString('vi-VN')} đ
          </span>
          <div className="text-xs text-gray-500">mỗi +{record.stepWeightGram}g</div>
        </div>
      ),
    },
    {
      title: 'Thời gian giao',
      dataIndex: 'estimatedDeliveryHours',
      key: 'estimatedDeliveryHours',
      render: (hours: number) => (
        <span className="inline-flex items-center gap-1.5 font-medium text-gray-700">
          <Clock size={15} className="text-blue-500" />
          {hours} giờ ({Math.round((hours / 24) * 10) / 10} ngày)
        </span>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean, record: PricingMatrixItem) => (
        <Switch
          checked={isActive}
          checkedChildren="Áp dụng"
          unCheckedChildren="Tạm dừng"
          onChange={() => handleToggleActive(record.id)}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, record: PricingMatrixItem) => (
        <Space size="small">
          <Button
            type="link"
            icon={<Edit2 size={16} />}
            onClick={() => handleOpenEditMatrix(record)}
            className="text-blue-600 hover:text-blue-800 p-0"
          >
            Sửa
          </Button>
          <Divider type="vertical" />
          <Popconfirm
            title="Xác nhận xóa biểu phí"
            description={`Bạn có chắc chắn muốn xóa biểu phí ${record.serviceType} - ${record.zoneType}?`}
            onConfirm={() => handleDeleteMatrix(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              icon={<Trash2 size={16} />}
              className="p-0"
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Tiêu đề trang */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
              <DollarSign size={28} />
            </div>
            <div>
              <Title level={3} className="!mb-0 text-gray-800">
                Quản Lý Giá Cước Vận Chuyển & Phụ Phí
              </Title>
              <Text type="secondary" className="text-sm">
                Toàn quyền điều chỉnh ma trận giá cước, ngưỡng phụ phí và chính sách ưu đãi không cần sửa lại code.
              </Text>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            icon={<RotateCcw size={16} />}
            onClick={fetchInitialData}
            loading={loading}
          >
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenAddMatrix}
            className="bg-red-600 hover:bg-red-700"
          >
            Thêm biểu phí mới
          </Button>
        </div>
      </div>

      {/* Thẻ thống kê tổng quan */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 hover:border-red-200 transition-all">
            <Statistic
              title="Tổng số Biểu phí"
              value={totalMatrices}
              suffix="biểu cước"
              prefix={<Layers size={20} className="text-blue-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 hover:border-red-200 transition-all">
            <Statistic
              title="Đang hoạt động"
              value={activeMatrices}
              suffix={`/ ${totalMatrices}`}
              valueStyle={{ color: '#16a34a' }}
              prefix={<CheckCircle2 size={20} className="text-green-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 hover:border-red-200 transition-all">
            <Statistic
              title="Cước Tiêu chuẩn Nội tỉnh"
              value={standardIntra ? Number(standardIntra.basePrice) : 16000}
              suffix="đ"
              valueStyle={{ color: '#dc2626' }}
              prefix={<Truck size={20} className="text-red-600 mr-2" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="rounded-xl shadow-sm border border-gray-100 hover:border-red-200 transition-all">
            <Statistic
              title="Phí Lấy hàng Cơ sở"
              value={policy ? Number(policy.doorPickupBaseFee) : 15000}
              suffix="đ"
              valueStyle={{ color: '#ea580c' }}
              prefix={<Sliders size={20} className="text-orange-600 mr-2" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Nội dung các Tabs */}
      <Card className="rounded-2xl shadow-sm border border-gray-100">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: 'matrix',
              label: (
                <span className="flex items-center gap-2 font-medium">
                  <Layers size={18} />
                  Ma Trận Biểu Phí Vận Chuyển ({filteredMatrices.length})
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  {/* Bộ lọc */}
                  <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase mr-2">Dịch vụ:</span>
                        <Select
                          value={serviceFilter}
                          onChange={setServiceFilter}
                          style={{ width: 220 }}
                        >
                          <Option value="ALL">Tất cả dịch vụ</Option>
                          <Option value="STANDARD">STANDARD - Tiêu chuẩn</Option>
                          <Option value="EXPRESS">EXPRESS - Hỏa tốc</Option>
                          <Option value="ROAD_FREIGHT">ROAD_FREIGHT - Đường bộ</Option>
                          <Option value="SAME_DAY">SAME_DAY - Giao trong ngày</Option>
                        </Select>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase mr-2">Vùng cước:</span>
                        <Select
                          value={zoneFilter}
                          onChange={setZoneFilter}
                          style={{ width: 200 }}
                        >
                          <Option value="ALL">Tất cả vùng cước</Option>
                          <Option value="INTRA_PROVINCE">Nội tỉnh</Option>
                          <Option value="INTRA_REGION">Nội vùng</Option>
                          <Option value="INTER_REGION_NEAR">Liên vùng gần</Option>
                          <Option value="INTER_REGION_FAR">Liên vùng xa</Option>
                        </Select>
                      </div>
                    </div>

                    <Text type="secondary" className="text-xs">
                      Hiển thị {filteredMatrices.length} / {matrices.length} cấu hình
                    </Text>
                  </div>

                  {/* Bảng dữ liệu */}
                  <Table
                    columns={columns}
                    dataSource={filteredMatrices}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10, showSizeChanger: true }}
                    className="overflow-x-auto"
                  />
                </div>
              ),
            },
            {
              key: 'policy',
              label: (
                <span className="flex items-center gap-2 font-medium">
                  <Sliders size={18} />
                  Cấu Hình Phụ Phí & Chính Sách Ưu Đãi
                </span>
              ),
              children: (
                <div className="pt-2 max-w-4xl">
                  <Alert
                    message="Cấu hình động thời gian thực"
                    description="Các tham số dưới đây được áp dụng trực tiếp vào thuật toán tính giá cước tại thời điểm khách hàng hoặc shop tạo đơn hàng. Bạn có thể cập nhật mọi lúc mà không cần can thiệp mã nguồn."
                    type="info"
                    showIcon
                    className="mb-6"
                  />

                  <Form
                    form={policyForm}
                    layout="vertical"
                    onFinish={handleSavePolicy}
                    requiredMark="optional"
                  >
                    {/* Phần 1: Phí Lấy hàng tận nơi */}
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-6 space-y-4">
                      <div className="flex items-center gap-2 text-red-600 font-bold text-base border-b pb-2">
                        <Truck size={20} />
                        1. Chính sách Phí Lấy Hàng Tận Nơi (DOOR_PICKUP)
                      </div>

                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="doorPickupBaseFee"
                            label="Cước lấy hàng tận nơi cơ sở (VNĐ)"
                            rules={[{ required: true, message: 'Vui lòng nhập cước lấy hàng' }]}
                            tooltip="Áp dụng cho đơn hàng nhỏ tiêu chuẩn"
                          >
                            <InputNumber
                              style={{ width: '100%' }}
                              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
                              addonAfter="đ/lần"
                              min={0}
                              step={1000}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="freePickupOrderThreshold"
                            label="Ngưỡng đơn hàng để MIỄN PHÍ lấy hàng"
                            rules={[{ required: true, message: 'Vui lòng nhập ngưỡng đơn' }]}
                            tooltip="Nếu Shop có tổng số đơn hàng vượt quá con số này thì hệ thống sẽ tự động miễn phí lấy hàng"
                          >
                            <InputNumber
                              style={{ width: '100%' }}
                              addonAfter="đơn"
                              min={0}
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Divider className="my-2" />
                      <Text strong className="text-gray-700 block">
                        Định mức phân loại Đơn Hàng Nhỏ vs Đơn To Cồng Kềnh:
                      </Text>

                      <Row gutter={16}>
                        <Col xs={24} sm={8}>
                          <Form.Item
                            name="bulkyWeightThresholdGram"
                            label="Trọng lượng tối đa đơn nhỏ (g)"
                            rules={[{ required: true, message: 'Nhập trọng lượng' }]}
                          >
                            <InputNumber style={{ width: '100%' }} addonAfter="g" min={100} step={100} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item
                            name="bulkyMaxDimensionCm"
                            label="Chiều dài tối đa đơn nhỏ (cm)"
                            rules={[{ required: true, message: 'Nhập chiều dài' }]}
                          >
                            <InputNumber style={{ width: '100%' }} addonAfter="cm" min={1} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Form.Item
                            name="bulkySumDimensionsCm"
                            label="Tổng 3 chiều tối đa đơn nhỏ (cm)"
                            rules={[{ required: true, message: 'Nhập tổng kích thước' }]}
                          >
                            <InputNumber style={{ width: '100%' }} addonAfter="cm" min={1} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="bulkyExtraPricePerKg"
                            label="Phụ phí mỗi kg vượt ngưỡng đối với hàng cồng kềnh (VNĐ)"
                            rules={[{ required: true, message: 'Nhập phụ phí/kg' }]}
                          >
                            <InputNumber
                              style={{ width: '100%' }}
                              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
                              addonAfter="đ/kg"
                              min={0}
                              step={1000}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="oversizeDimensionFee"
                            label="Phụ phí quá khổ kích thước lớn (VNĐ)"
                            rules={[{ required: true, message: 'Nhập phụ phí quá khổ' }]}
                            tooltip="Áp dụng khi kiện hàng có chiều dài > 50cm hoặc tổng 3 chiều > 100cm"
                          >
                            <InputNumber
                              style={{ width: '100%' }}
                              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
                              addonAfter="đ/kiện"
                              min={0}
                              step={1000}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    {/* Phần 2: Phí Bảo hiểm & Khai giá */}
                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 mb-6 space-y-4">
                      <div className="flex items-center gap-2 text-blue-600 font-bold text-base border-b pb-2">
                        <ShieldCheck size={20} />
                        2. Chính sách Bảo Hiểm Khai Giá Hàng Hóa
                      </div>

                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="insuranceValueThreshold"
                            label="Ngưỡng giá trị hàng hóa bắt đầu tính bảo hiểm (VNĐ)"
                            rules={[{ required: true, message: 'Nhập ngưỡng giá trị bảo hiểm' }]}
                            tooltip="Dưới ngưỡng này sẽ được miễn phí bảo hiểm khai giá hoàn toàn"
                          >
                            <InputNumber
                              style={{ width: '100%' }}
                              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
                              addonAfter="đ"
                              min={0}
                              step={100000}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="insurancePercentRate"
                            label="Tỷ lệ % phí bảo hiểm (trên phần giá trị bưu gửi)"
                            rules={[{ required: true, message: 'Nhập tỷ lệ %' }]}
                            tooltip="Ví dụ: 0.5% tương đương 5.000 đ cho mỗi 1.000.000 đ giá trị bưu gửi"
                          >
                            <InputNumber
                              style={{ width: '100%' }}
                              addonAfter="%"
                              min={0}
                              max={100}
                              step={0.1}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={savingPolicy}
                        icon={<Sparkles size={16} />}
                        className="bg-red-600 hover:bg-red-700 px-6 h-10 font-medium"
                      >
                        Lưu Cấu Hình Phụ Phí
                      </Button>
                    </div>
                  </Form>
                </div>
              ),
            },
            {
              key: 'simulator',
              label: (
                <span className="flex items-center gap-2 font-medium">
                  <Calculator size={18} />
                  Mô Phỏng & Kiểm Tra Cước Tức Thì
                </span>
              ),
              children: (
                <div className="pt-2">
                  <Alert
                    message="Công cụ kiểm tra nhanh biểu phí mới cập nhật"
                    description="Nhập thử các thông số đơn hàng mẫu để kiểm tra xem hệ thống áp dụng bảng giá cước và chính sách phụ phí mới nhất như thế nào."
                    type="info"
                    showIcon
                    className="mb-6"
                  />

                  <Row gutter={[24, 24]}>
                    <Col xs={24} md={12}>
                      <Card title="Nhập thông số đơn hàng thử nghiệm" className="rounded-xl border border-gray-200">
                        <Form
                          form={calcForm}
                          layout="vertical"
                          initialValues={{
                            senderProvinceId: 1, // Hà Nội
                            receiverProvinceId: 1,
                            serviceType: 'STANDARD',
                            pickupType: 'DROP_OFF',
                            actualWeightGram: 500,
                            lengthCm: 20,
                            widthCm: 15,
                            heightCm: 10,
                            itemValue: 500000,
                            merchantTotalOrders: 2,
                          }}
                          onFinish={handleRunSimulator}
                        >
                          <Row gutter={16}>
                            <Col xs={12}>
                              <Form.Item name="senderProvinceId" label="Tỉnh/TP gửi" rules={[{ required: true }]}>
                                <Select showSearch optionFilterProp="children">
                                  {provinces.map((p) => (
                                    <Option key={p.id} value={p.id}>
                                      {p.name}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col xs={12}>
                              <Form.Item name="receiverProvinceId" label="Tỉnh/TP nhận" rules={[{ required: true }]}>
                                <Select showSearch optionFilterProp="children">
                                  {provinces.map((p) => (
                                    <Option key={p.id} value={p.id}>
                                      {p.name}
                                    </Option>
                                  ))}
                                </Select>
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={16}>
                            <Col xs={12}>
                              <Form.Item name="serviceType" label="Loại dịch vụ">
                                <Select>
                                  <Option value="STANDARD">STANDARD - Tiêu chuẩn</Option>
                                  <Option value="EXPRESS">EXPRESS - Hỏa tốc</Option>
                                  <Option value="ROAD_FREIGHT">ROAD_FREIGHT - Đường bộ</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                            <Col xs={12}>
                              <Form.Item name="pickupType" label="Hình thức lấy hàng">
                                <Select>
                                  <Option value="DROP_OFF">Shop tự mang ra bưu cục</Option>
                                  <Option value="DOOR_PICKUP">Bưu tá đến tận nơi lấy</Option>
                                </Select>
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={16}>
                            <Col xs={12}>
                              <Form.Item name="actualWeightGram" label="Cân nặng thực tế (g)" rules={[{ required: true }]}>
                                <InputNumber style={{ width: '100%' }} addonAfter="g" min={1} />
                              </Form.Item>
                            </Col>
                            <Col xs={12}>
                              <Form.Item name="itemValue" label="Giá trị hàng hóa (VNĐ)">
                                <InputNumber
                                  style={{ width: '100%' }}
                                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                  parser={(val) => val?.replace(/\$\s?|(,*)/g, '') as any}
                                  addonAfter="đ"
                                  min={0}
                                />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={8}>
                            <Col xs={8}>
                              <Form.Item name="lengthCm" label="Dài (cm)">
                                <InputNumber style={{ width: '100%' }} addonAfter="cm" min={1} />
                              </Form.Item>
                            </Col>
                            <Col xs={8}>
                              <Form.Item name="widthCm" label="Rộng (cm)">
                                <InputNumber style={{ width: '100%' }} addonAfter="cm" min={1} />
                              </Form.Item>
                            </Col>
                            <Col xs={8}>
                              <Form.Item name="heightCm" label="Cao (cm)">
                                <InputNumber style={{ width: '100%' }} addonAfter="cm" min={1} />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Form.Item name="merchantTotalOrders" label="Số đơn Shop đã gửi trước đó (kiểm tra ưu đãi)">
                            <InputNumber style={{ width: '100%' }} addonAfter="đơn" min={0} />
                          </Form.Item>

                          <Button
                            type="primary"
                            htmlType="submit"
                            loading={calculating}
                            icon={<Calculator size={16} />}
                            className="w-full bg-red-600 hover:bg-red-700 h-10 font-semibold"
                          >
                            Tính Cước Thử Nghiệm
                          </Button>
                        </Form>
                      </Card>
                    </Col>

                    <Col xs={24} md={12}>
                      <Card title="Kết quả Tính toán Chi tiết" className="rounded-xl border border-gray-200">
                        {simResult ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Vùng cước xác định:</span>
                                <Tag color={ZONE_LABELS[simResult.zoneType]?.color || 'blue'}>
                                  {ZONE_LABELS[simResult.zoneType]?.label || simResult.zoneType}
                                </Tag>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Trọng lượng thực tế:</span>
                                <span className="font-medium">{simResult.actualWeightGram} g</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Trọng lượng quy đổi (DxRxC/6000):</span>
                                <span className="font-medium">{simResult.volumetricWeightGram} g</span>
                              </div>
                              <div className="flex justify-between border-t pt-2">
                                <span className="font-semibold text-gray-700">Trọng lượng tính cước (Max):</span>
                                <span className="font-bold text-blue-600">{simResult.billableWeightGram} g</span>
                              </div>
                            </div>

                            <div className="space-y-2 border-t pt-3">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Cước vận chuyển chính:</span>
                                <span className="font-semibold">{Number(simResult.shippingFee).toLocaleString('vi-VN')} đ</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Phí bảo hiểm khai giá:</span>
                                <span className="font-semibold">{Number(simResult.insuranceFee).toLocaleString('vi-VN')} đ</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Phí bưu tá đến lấy:</span>
                                <span className="font-semibold">{Number(simResult.pickupFee || 0).toLocaleString('vi-VN')} đ</span>
                              </div>
                              {simResult.pickupFeeNote && (
                                <div className="text-xs text-gray-500 italic bg-amber-50 p-2 rounded">
                                  {simResult.pickupFeeNote}
                                </div>
                              )}
                              <div className="flex justify-between items-center bg-red-50 p-4 rounded-xl border border-red-100 mt-4">
                                <span className="font-bold text-gray-800 text-base">TỔNG CƯỚC THU:</span>
                                <span className="font-extrabold text-red-600 text-2xl">
                                  {Number(simResult.totalFee).toLocaleString('vi-VN')} đ
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 text-right">
                                Thời gian giao dự kiến: {simResult.estimatedDeliveryHours} giờ
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-400">
                            <Calculator size={48} className="mx-auto mb-3 opacity-40" />
                            <p>Nhập thông số và bấm "Tính Cước Thử Nghiệm" để xem kết quả chi tiết</p>
                          </div>
                        )}
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Thêm / Chỉnh sửa Cấu hình Cước */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-lg font-bold">
            <DollarSign size={20} className="text-red-600" />
            {editingMatrix ? 'Chỉnh Sửa Cấu Hình Cước' : 'Thêm Cấu Hình Cước Mới'}
          </div>
        }
        open={matrixModalVisible}
        onCancel={() => setMatrixModalVisible(false)}
        onOk={handleSaveMatrix}
        confirmLoading={savingMatrix}
        okText={editingMatrix ? 'Lưu thay đổi' : 'Thêm mới'}
        cancelText="Hủy"
        width={600}
        destroyOnClose
      >
        <Form form={matrixForm} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="serviceType"
                label="Loại dịch vụ"
                rules={[{ required: true, message: 'Vui lòng chọn loại dịch vụ' }]}
              >
                <Select disabled={!!editingMatrix}>
                  <Option value="STANDARD">STANDARD - Tiêu chuẩn</Option>
                  <Option value="EXPRESS">EXPRESS - Hỏa tốc</Option>
                  <Option value="ROAD_FREIGHT">ROAD_FREIGHT - Đường bộ</Option>
                  <Option value="SAME_DAY">SAME_DAY - Giao trong ngày</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item
                name="zoneType"
                label="Vùng cước"
                rules={[{ required: true, message: 'Vui lòng chọn vùng cước' }]}
              >
                <Select disabled={!!editingMatrix}>
                  <Option value="INTRA_PROVINCE">INTRA_PROVINCE - Nội tỉnh</Option>
                  <Option value="INTRA_REGION">INTRA_REGION - Nội vùng</Option>
                  <Option value="INTER_REGION_NEAR">INTER_REGION_NEAR - Liên vùng gần</Option>
                  <Option value="INTER_REGION_FAR">INTER_REGION_FAR - Liên vùng xa</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="baseWeightGram"
                label="Khối lượng cơ sở (g)"
                rules={[{ required: true, message: 'Nhập khối lượng cơ sở' }]}
              >
                <InputNumber style={{ width: '100%' }} addonAfter="g" min={1} step={100} />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item
                name="basePrice"
                label="Cước phí cơ sở (VNĐ)"
                rules={[{ required: true, message: 'Nhập cước phí cơ sở' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val?.replace(/\$\s?|(,*)/g, '') as any}
                  addonAfter="đ"
                  min={0}
                  step={1000}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="stepWeightGram"
                label="Nấc khối lượng tăng thêm (g)"
                rules={[{ required: true, message: 'Nhập nấc khối lượng' }]}
              >
                <InputNumber style={{ width: '100%' }} addonAfter="g" min={1} step={100} />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item
                name="stepPrice"
                label="Cước mỗi nấc tăng (VNĐ)"
                rules={[{ required: true, message: 'Nhập cước nấc tăng' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val?.replace(/\$\s?|(,*)/g, '') as any}
                  addonAfter="đ"
                  min={0}
                  step={500}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12}>
              <Form.Item
                name="estimatedDeliveryHours"
                label="Thời gian giao dự kiến (Giờ)"
                rules={[{ required: true, message: 'Nhập số giờ dự kiến' }]}
              >
                <InputNumber style={{ width: '100%' }} addonAfter="giờ" min={1} step={6} />
              </Form.Item>
            </Col>
            <Col xs={12}>
              <Form.Item name="isActive" label="Trạng thái áp dụng" valuePropName="checked">
                <Switch checkedChildren="Đang áp dụng" unCheckedChildren="Tạm dừng" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};
