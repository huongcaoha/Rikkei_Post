import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Space,
  Row,
  Col,
  Statistic,
  Tabs,
  Typography,
  message,
  Rate,
  Progress,
  Descriptions,
} from 'antd';
import {
  Truck,
  PlusCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Calendar,
  FileCheck,
} from 'lucide-react';
import { carrierApi } from '../api/carrier';
import { locationApi } from '../api/location';
import { CarrierPartner, CarrierTrip, Warehouse } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const CarrierPartnerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PARTNERS' | 'TRIPS'>('PARTNERS');

  // Carriers
  const [partners, setPartners] = useState<CarrierPartner[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partnerModalVisible, setPartnerModalVisible] = useState(false);
  const [editingPartner, setEditingPartner] = useState<CarrierPartner | null>(null);
  const [partnerForm] = Form.useForm();
  const [submittingPartner, setSubmittingPartner] = useState(false);

  // Trips
  const [trips, setTrips] = useState<CarrierTrip[]>([]);
  const [totalTrips, setTotalTrips] = useState(0);
  const [tripPage, setTripPage] = useState(1);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [tripModalVisible, setTripModalVisible] = useState(false);
  const [tripForm] = Form.useForm();
  const [submittingTrip, setSubmittingTrip] = useState(false);

  // Update Trip Modal
  const [arrivalModalVisible, setArrivalModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<CarrierTrip | null>(null);
  const [arrivalForm] = Form.useForm();
  const [submittingArrival, setSubmittingArrival] = useState(false);

  // Warehouses list
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  // Fetch partners
  const fetchPartners = async () => {
    try {
      setLoadingPartners(true);
      const res = await carrierApi.getAllPartners();
      if (res.data.data) {
        setPartners(res.data.data);
      }
    } catch (err: any) {
      message.error('Không thể tải danh sách đối tác vận tải');
    } finally {
      setLoadingPartners(false);
    }
  };

  // Fetch trips
  const fetchTrips = async (page: number = 1) => {
    try {
      setLoadingTrips(true);
      const res = await carrierApi.getTrips({ page: page - 1, size: 10 });
      if (res.data.data) {
        setTrips(res.data.data.content);
        setTotalTrips(res.data.data.totalElements);
      }
    } catch (err: any) {
      message.error('Không thể tải danh sách chuyến xe');
    } finally {
      setLoadingTrips(false);
    }
  };

  // Fetch warehouses
  const fetchWarehouses = async () => {
    try {
      const data = await locationApi.getAllWarehouses();
      if (data) {
        setWarehouses(data);
      }
    } catch (err: any) {
      console.error('Lỗi lấy danh sách kho:', err);
    }
  };

  useEffect(() => {
    fetchPartners();
    fetchTrips(1);
    fetchWarehouses();
  }, []);

  // Submit Partner
  const handleSubmitPartner = async (values: any) => {
    try {
      setSubmittingPartner(true);
      if (editingPartner) {
        await carrierApi.updatePartner(editingPartner.id, values);
        message.success(`Cập nhật đối tác ${values.companyName} thành công!`);
      } else {
        await carrierApi.createPartner(values);
        message.success(`Thêm đối tác vận tải ${values.companyName} thành công!`);
      }
      setPartnerModalVisible(false);
      partnerForm.resetFields();
      setEditingPartner(null);
      fetchPartners();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể lưu đối tác');
    } finally {
      setSubmittingPartner(false);
    }
  };

  // Submit Trip
  const handleSubmitTrip = async (values: any) => {
    try {
      setSubmittingTrip(true);
      await carrierApi.createTrip({
        carrierId: values.carrierId,
        sourceHubId: values.sourceHubId,
        destinationHubId: values.destinationHubId,
        driverName: values.driverName,
        driverPhone: values.driverPhone,
        licensePlate: values.licensePlate,
        distanceKm: values.distanceKm,
        departureTime: values.departureTime ? values.departureTime.toISOString() : undefined,
        estimatedArrivalTime: values.estimatedArrivalTime ? values.estimatedArrivalTime.toISOString() : undefined,
      });
      message.success('Điều phối chuyến xe vận chuyển 3PL thành công!');
      setTripModalVisible(false);
      tripForm.resetFields();
      fetchTrips(1);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo chuyến xe');
    } finally {
      setSubmittingTrip(false);
    }
  };

  // Submit Arrival & SLA Evaluation
  const handleSubmitArrival = async (values: any) => {
    if (!selectedTrip) return;
    try {
      setSubmittingArrival(true);
      const res = await carrierApi.updateTripStatus(selectedTrip.id, {
        status: values.status,
        actualArrivalTime: values.actualArrivalTime ? values.actualArrivalTime.toISOString() : dayjs().toISOString(),
        notes: values.notes,
      });

      const updated = res.data.data;
      if (updated.slaCompliant) {
        message.success('Chuyến xe đã đến kho ĐÚNG GIỜ theo SLA cam kết!');
      } else {
        message.warning('Chuyến xe đã đến kho TRỄ HẸN. Hệ thống tự động ghi nhận vi phạm SLA.');
      }

      setArrivalModalVisible(false);
      setSelectedTrip(null);
      arrivalForm.resetFields();
      fetchTrips(tripPage);
      fetchPartners(); // update SLA rate on partners
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi cập nhật chuyến xe');
    } finally {
      setSubmittingArrival(false);
    }
  };

  // Stats calculation
  const totalPartners = partners.length;
  const avgSla = partners.length > 0 ? (partners.reduce((acc, p) => acc + (p.onTimeDeliveryRate || 0), 0) / partners.length).toFixed(1) : '100';
  const totalFleet = partners.reduce((acc, p) => acc + (p.vehicleFleetCount || 0), 0);
  const activeTripsCount = trips.filter(t => t.status === 'IN_TRANSIT').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={2} className="!mb-1 flex items-center gap-2">
            <Truck className="text-red-600" size={28} />
            Đối tác Vận tải 3PL & Đánh giá Hiệu suất SLA
          </Title>
          <Text type="secondary">
            Quản trị mạng lưới nhà xe đối tác, hợp đồng đơn giá theo km, điều phối chuyến xe liên tỉnh và tự động giám sát SLA đúng giờ.
          </Text>
        </div>

        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={() => { fetchPartners(); fetchTrips(tripPage); }}>
            Làm mới
          </Button>
          {activeTab === 'PARTNERS' ? (
            <Button
              type="primary"
              className="bg-red-600 hover:bg-red-700"
              icon={<PlusCircle size={16} />}
              onClick={() => {
                setEditingPartner(null);
                partnerForm.resetFields();
                setPartnerModalVisible(true);
              }}
            >
              Thêm Đối tác 3PL
            </Button>
          ) : (
            <Button
              type="primary"
              className="bg-red-600 hover:bg-red-700"
              icon={<PlusCircle size={16} />}
              onClick={() => {
                tripForm.resetFields();
                setTripModalVisible(true);
              }}
            >
              Điều phối Chuyến xe mới
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-blue-600 rounded-xl">
            <Statistic
              title={<span className="font-medium text-gray-600 flex items-center gap-1.5"><Building2 size={16} className="text-blue-600" /> Tổng đối tác 3PL</span>}
              value={totalPartners}
              suffix="nhà xe"
              valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
            />
            <div className="mt-2 text-xs text-gray-500">Mạng lưới vận tải liên tỉnh</div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-green-600 rounded-xl">
            <Statistic
              title={<span className="font-medium text-gray-600 flex items-center gap-1.5"><ShieldCheck size={16} className="text-green-600" /> SLA Giao đúng giờ TB</span>}
              value={avgSla}
              suffix="%"
              valueStyle={{ color: '#16a34a', fontWeight: 'bold' }}
            />
            <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircle2 size={12} /> Tiêu chuẩn cam kết ≥ 95%
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-purple-600 rounded-xl">
            <Statistic
              title={<span className="font-medium text-gray-600 flex items-center gap-1.5"><Truck size={16} className="text-purple-600" /> Tổng đầu xe liên kết</span>}
              value={totalFleet}
              suffix="xe tải"
              valueStyle={{ color: '#9333ea', fontWeight: 'bold' }}
            />
            <div className="mt-2 text-xs text-gray-500">Trọng tải từ 1.5T - 15T</div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-amber-500 rounded-xl">
            <Statistic
              title={<span className="font-medium text-gray-600 flex items-center gap-1.5"><Clock size={16} className="text-amber-500" /> Chuyến xe đang chạy</span>}
              value={activeTripsCount}
              suffix="chuyến"
              valueStyle={{ color: '#d97706', fontWeight: 'bold' }}
            />
            <div className="mt-2 text-xs text-gray-500">Đang trung chuyển trên tuyến</div>
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Card className="shadow-sm rounded-xl">
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as any)}
          items={[
            {
              key: 'PARTNERS',
              label: (
                <span className="flex items-center gap-2 font-medium">
                  <Building2 size={16} /> Danh sách Đối tác Vận tải ({partners.length})
                </span>
              ),
              children: (
                <div className="pt-2">
                  <Table
                    dataSource={partners}
                    rowKey="id"
                    loading={loadingPartners}
                    pagination={{ pageSize: 8 }}
                    columns={[
                      {
                        title: 'Mã & Tên Nhà xe',
                        key: 'name',
                        render: (_, r) => (
                          <div>
                            <div className="font-bold text-gray-800">{r.companyName}</div>
                            <div className="font-mono text-xs text-red-600">{r.partnerCode}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Tuyến vận hành',
                        dataIndex: 'routesOperated',
                        key: 'routesOperated',
                        render: (text) => <span className="text-xs text-gray-600">{text || 'Toàn quốc'}</span>,
                      },
                      {
                        title: 'Đội xe',
                        dataIndex: 'vehicleFleetCount',
                        key: 'vehicleFleetCount',
                        align: 'center',
                        render: (val) => <Tag color="cyan">{val} xe</Tag>,
                      },
                      {
                        title: 'Giá cước / km',
                        dataIndex: 'contractPricePerKm',
                        key: 'contractPricePerKm',
                        align: 'right',
                        render: (val) => (
                          <span className="font-semibold text-gray-800">
                            {Number(val || 12000).toLocaleString('vi-VN')} đ/km
                          </span>
                        ),
                      },
                      {
                        title: 'SLA Đúng giờ',
                        key: 'sla',
                        align: 'center',
                        width: 160,
                        render: (_, r) => {
                          const rate = r.onTimeDeliveryRate || 98;
                          const color = rate >= 95 ? '#16a34a' : rate >= 90 ? '#eab308' : '#dc2626';
                          return (
                            <div>
                              <Progress percent={Math.round(rate)} size="small" strokeColor={color} />
                              <span className="text-xs font-semibold" style={{ color }}>{rate}% On-time</span>
                            </div>
                          );
                        },
                      },
                      {
                        title: 'Đánh giá SLA',
                        dataIndex: 'slaScore',
                        key: 'slaScore',
                        align: 'center',
                        render: (val) => (
                          <div>
                            <Rate disabled allowHalf value={val || 4.8} className="text-xs text-amber-500" />
                            <div className="text-xs text-gray-500 mt-0.5">{val || 4.8} / 5.0</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Liên hệ',
                        key: 'contact',
                        render: (_, r) => (
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>{r.contactPerson}</div>
                            <div className="text-gray-500">{r.contactPhone}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Thao tác',
                        key: 'action',
                        align: 'center',
                        render: (_, r) => (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setEditingPartner(r);
                              partnerForm.setFieldsValue({
                                ...r,
                              });
                              setPartnerModalVisible(true);
                            }}
                          >
                            Chỉnh sửa
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'TRIPS',
              label: (
                <span className="flex items-center gap-2 font-medium">
                  <Truck size={16} /> Theo dõi Chuyến xe Liên tỉnh ({totalTrips})
                </span>
              ),
              children: (
                <div className="pt-2">
                  <Table
                    dataSource={trips}
                    rowKey="id"
                    loading={loadingTrips}
                    pagination={{
                      current: tripPage,
                      total: totalTrips,
                      pageSize: 10,
                      onChange: (p) => {
                        setTripPage(p);
                        fetchTrips(p);
                      },
                    }}
                    columns={[
                      {
                        title: 'Mã Chuyến xe',
                        dataIndex: 'tripCode',
                        key: 'tripCode',
                        render: (text) => <span className="font-mono font-bold text-red-600">{text}</span>,
                      },
                      {
                        title: 'Nhà xe 3PL',
                        dataIndex: 'carrierName',
                        key: 'carrierName',
                        render: (text) => <span className="font-medium text-gray-800">{text}</span>,
                      },
                      {
                        title: 'Lộ trình vận chuyển',
                        key: 'route',
                        render: (_, r) => (
                          <div className="text-xs">
                            <span className="font-semibold text-blue-700">{r.sourceHubName}</span>
                            <span className="text-gray-400 mx-1">➔</span>
                            <span className="font-semibold text-green-700">{r.destinationHubName}</span>
                            <div className="text-gray-500 mt-0.5">Khoảng cách: ~{r.distanceKm} km</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Lái xe & Biển số',
                        key: 'driver',
                        render: (_, r) => (
                          <div className="text-xs">
                            <Tag color="geekblue" className="font-mono mb-0.5">{r.licensePlate || 'Xe đối tác'}</Tag>
                            <div className="text-gray-600">{r.driverName} ({r.driverPhone})</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Thời gian xuất / đến dự kiến',
                        key: 'times',
                        render: (_, r) => (
                          <div className="text-xs text-gray-600 space-y-0.5">
                            <div>Khởi hành: {r.departureTime ? new Date(r.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(r.departureTime).toLocaleDateString('vi-VN') : '---'}</div>
                            <div className="text-amber-700 font-medium">ETA dự kiến: {r.estimatedArrivalTime ? new Date(r.estimatedArrivalTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(r.estimatedArrivalTime).toLocaleDateString('vi-VN') : '---'}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Trạng thái & SLA',
                        key: 'status',
                        align: 'center',
                        render: (_, r) => {
                          if (r.status === 'IN_TRANSIT') return <Tag color="processing" icon={<Clock size={12} className="inline mr-1" />}>Đang trung chuyển</Tag>;
                          if (r.status === 'COMPLETED_ON_TIME') return <Tag color="success" icon={<CheckCircle2 size={12} className="inline mr-1" />}>Đến đúng giờ</Tag>;
                          if (r.status === 'DELAYED') return <Tag color="error" icon={<AlertTriangle size={12} className="inline mr-1" />}>Trễ hẹn</Tag>;
                          return <Tag>{r.status}</Tag>;
                        },
                      },
                      {
                        title: 'Thao tác',
                        key: 'action',
                        align: 'center',
                        render: (_, r) => (
                          r.status === 'IN_TRANSIT' ? (
                            <Button
                              type="primary"
                              size="small"
                              className="bg-green-600 hover:bg-green-700 text-xs"
                              onClick={() => {
                                setSelectedTrip(r);
                                arrivalForm.setFieldsValue({
                                  status: 'COMPLETED_ON_TIME',
                                  actualArrivalTime: dayjs(),
                                });
                                setArrivalModalVisible(true);
                              }}
                            >
                              Xác nhận đến kho
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">Đã hoàn tất</span>
                          )
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Thêm/Sửa Đối tác 3PL */}
      <Modal
        title={editingPartner ? `Chỉnh sửa Đối tác: ${editingPartner.companyName}` : 'Thêm mới Đối tác Vận tải 3PL'}
        open={partnerModalVisible}
        onCancel={() => setPartnerModalVisible(false)}
        onOk={() => partnerForm.submit()}
        confirmLoading={submittingPartner}
        width={680}
        okText="Lưu thông tin"
        okButtonProps={{ className: 'bg-red-600 hover:bg-red-700' }}
      >
        <Form form={partnerForm} layout="vertical" onFinish={handleSubmitPartner}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Mã đối tác (VD: 3PL-BACNAM-01)" name="partnerCode" rules={[{ required: true, message: 'Nhập mã đối tác' }]}>
                <Input placeholder="3PL-VIETTEL-01" disabled={!!editingPartner} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tên công ty vận tải" name="companyName" rules={[{ required: true, message: 'Nhập tên công ty' }]}>
                <Input placeholder="Công ty TNHH Vận tải Bắc Nam Express" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Người liên hệ" name="contactPerson">
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số điện thoại" name="contactPhone">
                <Input placeholder="0912345678" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Email liên hệ" name="email">
                <Input placeholder="contact@bacnamexpress.vn" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Số lượng đầu xe tải" name="vehicleFleetCount" initialValue={5}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Tuyến vận hành chính" name="routesOperated" initialValue="Hà Nội - Đà Nẵng - TP. Hồ Chí Minh">
                <Input placeholder="Hà Nội - Hải Phòng - Quảng Ninh" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Đơn giá hợp đồng (đ/km)" name="contractPricePerKm" initialValue={12000}>
                <InputNumber min={1000} className="w-full" formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Ghi chú năng lực đối tác" name="notes">
            <Input.TextArea placeholder="Chuyên xe thùng kín 5T - 10T có GPS hành trình..." rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Điều phối Chuyến xe */}
      <Modal
        title="Điều phối Chuyến xe Vận chuyển 3PL mới"
        open={tripModalVisible}
        onCancel={() => setTripModalVisible(false)}
        onOk={() => tripForm.submit()}
        confirmLoading={submittingTrip}
        width={700}
        okText="Khởi tạo chuyến xe"
        okButtonProps={{ className: 'bg-red-600 hover:bg-red-700' }}
      >
        <Form form={tripForm} layout="vertical" onFinish={handleSubmitTrip}>
          <Form.Item label="Chọn Nhà xe Đối tác 3PL" name="carrierId" rules={[{ required: true, message: 'Chọn nhà xe' }]}>
            <Select placeholder="Chọn đối tác phụ trách">
              {partners.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.companyName} ({p.partnerCode}) - Đơn giá: {Number(p.contractPricePerKm || 12000).toLocaleString('vi-VN')} đ/km
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Kho / Bưu cục xuất phát" name="sourceHubId" rules={[{ required: true, message: 'Chọn kho xuất phát' }]}>
                <Select placeholder="Chọn kho nguồn">
                  {warehouses.map(w => (
                    <Select.Option key={w.id} value={w.id}>{w.name} ({w.code})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Kho / Bưu cục đích đến" name="destinationHubId" rules={[{ required: true, message: 'Chọn kho đích' }]}>
                <Select placeholder="Chọn kho đích">
                  {warehouses.map(w => (
                    <Select.Option key={w.id} value={w.id}>{w.name} ({w.code})</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Tên tài xế" name="driverName" rules={[{ required: true, message: 'Nhập tên tài xế' }]}>
                <Input placeholder="Trần Văn Nam" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="SĐT tài xế" name="driverPhone" rules={[{ required: true, message: 'Nhập SĐT tài xế' }]}>
                <Input placeholder="0988776655" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Biển số xe" name="licensePlate" rules={[{ required: true, message: 'Nhập biển số xe' }]}>
                <Input placeholder="29C-888.99" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Cự ly dự kiến (km)" name="distanceKm" initialValue={120}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Giờ khởi hành" name="departureTime" initialValue={dayjs()}>
                <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Giờ đến dự kiến (ETA)" name="estimatedArrivalTime" initialValue={dayjs().add(4, 'hour')}>
                <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Modal Xác nhận đến kho & Đánh giá SLA */}
      <Modal
        title="Xác nhận Chuyến xe Đến Kho & Đánh giá SLA"
        open={arrivalModalVisible}
        onCancel={() => setArrivalModalVisible(false)}
        onOk={() => arrivalForm.submit()}
        confirmLoading={submittingArrival}
        okText="Xác nhận & Cập nhật SLA"
        okButtonProps={{ className: 'bg-green-600 hover:bg-green-700' }}
      >
        {selectedTrip && (
          <Form form={arrivalForm} layout="vertical" onFinish={handleSubmitArrival}>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-4 text-xs space-y-1">
              <div>Chuyến xe: <b>{selectedTrip.tripCode}</b> - Nhà xe: <b>{selectedTrip.carrierName}</b></div>
              <div>Lộ trình: {selectedTrip.sourceHubName} ➔ {selectedTrip.destinationHubName}</div>
              <div>ETA Cam kết: <b>{selectedTrip.estimatedArrivalTime ? new Date(selectedTrip.estimatedArrivalTime).toLocaleString('vi-VN') : '---'}</b></div>
            </div>

            <Form.Item label="Thời gian xe cập kho thực tế" name="actualArrivalTime" rules={[{ required: true, message: 'Chọn thời gian xe đến' }]}>
              <DatePicker showTime format="DD/MM/YYYY HH:mm" className="w-full" />
            </Form.Item>

            <Form.Item label="Đánh giá Trạng thái Đến kho" name="status" rules={[{ required: true }]}>
              <Select>
                <Select.Option value="COMPLETED_ON_TIME">Đến đúng hẹn (On-time Delivery)</Select.Option>
                <Select.Option value="DELAYED">Trễ hẹn do sự cố / thời tiết (Delayed)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item label="Ghi chú kiểm tra tình trạng hàng" name="notes">
              <Input.TextArea placeholder="Nguyên đai nguyên kiện, niêm phong chì trùng khớp..." rows={2} />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default CarrierPartnerPage;
