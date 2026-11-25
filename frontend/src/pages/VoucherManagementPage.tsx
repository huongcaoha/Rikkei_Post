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
  message,
  Row,
  Col,
} from 'antd';
import {
  Receipt,
  PlusCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import dayjs from 'dayjs';
import { paymentVoucherApi } from '../api/voucher';
import { PaymentVoucher, CreateVoucherRequest } from '../types';
import { useAuth } from '../context/AuthContext';

const { TextArea } = Input;
const { Option } = Select;

export const VoucherManagementPage: React.FC = () => {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [filterStatus, setFilterFilterStatus] = useState<string>('ALL');
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await paymentVoucherApi.getMyVouchers();
      setVouchers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setVouchers([]);
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách phiếu thu chi!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateVoucher = async (values: any) => {
    try {
      const payload: CreateVoucherRequest = {
        voucherType: values.voucherType as 'RECEIPT' | 'PAYMENT',
        amount: values.amount,
        category: values.category,
        title: values.title || values.category,
        description: values.description,
        warehouseId: user?.assignedPostOfficeId || user?.managedProvinceId,
      };

      await paymentVoucherApi.createVoucher(payload);
      message.success('Tạo đề xuất phiếu thu/chi thành công! Phiếu đang chờ Kế toán xét duyệt.');
      setIsModalOpen(false);
      form.resetFields();
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Tạo phiếu thất bại!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Tag color="gold" className="flex items-center gap-1 font-semibold">
            <Clock size={12} /> Chờ kế toán duyệt
          </Tag>
        );
      case 'APPROVED':
        return (
          <Tag color="green" className="flex items-center gap-1 font-semibold">
            <CheckCircle size={12} /> Đã duyệt & Giải ngân
          </Tag>
        );
      case 'REJECTED':
        return (
          <Tag color="red" className="flex items-center gap-1 font-semibold">
            <XCircle size={12} /> Bị từ chối
          </Tag>
        );
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (filterStatus === 'ALL') return true;
    return v.status === filterStatus;
  });

  const columns = [
    {
      title: 'Mã Phiếu',
      dataIndex: 'voucherCode',
      key: 'voucherCode',
      render: (code: string, r: PaymentVoucher) => (
        <div>
          <div className="font-mono font-bold text-gray-800">{code}</div>
          <div className="text-[11px] text-gray-500">
            {r.voucherType === 'RECEIPT' ? (
              <Tag color="blue" className="m-0 text-[10px]">Phiếu Thu (+)</Tag>
            ) : (
              <Tag color="red" className="m-0 text-[10px]">Phiếu Chi (-)</Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Số Tiền Đề Xuất',
      dataIndex: 'amount',
      key: 'amount',
      render: (amt: number, r: PaymentVoucher) => (
        <div className={`font-black text-sm ${r.voucherType === 'RECEIPT' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {r.voucherType === 'RECEIPT' ? '+' : '-'}{amt?.toLocaleString()} đ
        </div>
      ),
    },
    {
      title: 'Danh Mục & Lý Do Diễn Giải',
      key: 'desc',
      render: (_: any, r: PaymentVoucher) => (
        <div className="text-xs">
          <div className="font-bold text-gray-800">{r.category}</div>
          <div className="text-gray-600 mt-0.5">{r.description || r.title}</div>
          {r.disbursementMethod && (
            <div className="text-blue-600 font-mono mt-0.5">Phương thức: {r.disbursementMethod}</div>
          )}
          {r.rejectionReason && (
            <div className="text-rose-600 bg-rose-50 p-1.5 rounded mt-1 border border-rose-200">
              <span className="font-semibold">Lý do từ chối:</span> {r.rejectionReason}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => getStatusBadge(st),
    },
    {
      title: 'Thời Gian Tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (dt: string) => (
        <div className="text-xs text-gray-500">
          {dt ? dayjs(dt).format('DD/MM/YYYY HH:mm') : '-'}
        </div>
      ),
    },
    {
      title: 'Xét Duyệt',
      key: 'approval',
      render: (_: any, r: PaymentVoucher) => (
        <div className="text-xs">
          {r.approvedByUserName ? (
            <div>
              <div className="text-gray-800 font-medium">{r.approvedByUserName}</div>
              <div className="text-gray-400 text-[11px]">{r.approvedAt ? dayjs(r.approvedAt).format('DD/MM/YYYY HH:mm') : ''}</div>
            </div>
          ) : (
            <span className="text-gray-400 italic">Đang chờ xử lý...</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <Receipt className="mr-2 text-red-600" size={28} />
            Quản Lý Phiếu Đề Xuất Thu - Chi (Vouchers)
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Tạo đề xuất chi tiêu bưu cục, chi phí vận hành, sửa chữa phương tiện và nhận giải ngân từ Kế toán
          </p>
        </div>

        <Button
          type="primary"
          icon={<PlusCircle size={16} />}
          onClick={() => {
            form.resetFields();
            setIsModalOpen(true);
          }}
          className="bg-red-600 hover:bg-red-700 font-semibold rounded-xl h-10 px-5 shadow-xs"
        >
          Tạo Đề Xuất Thu / Chi Mới
        </Button>
      </div>

      <Card className="shadow-xs border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-gray-600">Lọc theo trạng thái:</span>
            <Button
              size="small"
              type={filterStatus === 'ALL' ? 'primary' : 'default'}
              onClick={() => setFilterFilterStatus('ALL')}
              className="rounded-lg"
            >
              Tất cả ({vouchers.length})
            </Button>
            <Button
              size="small"
              type={filterStatus === 'PENDING' ? 'primary' : 'default'}
              onClick={() => setFilterFilterStatus('PENDING')}
              className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
            >
              Chờ duyệt ({vouchers.filter((v) => v.status === 'PENDING').length})
            </Button>
            <Button
              size="small"
              type={filterStatus === 'APPROVED' ? 'primary' : 'default'}
              onClick={() => setFilterFilterStatus('APPROVED')}
              className="rounded-lg"
            >
              Đã duyệt & Giải ngân ({vouchers.filter((v) => v.status === 'APPROVED').length})
            </Button>
            <Button
              size="small"
              type={filterStatus === 'REJECTED' ? 'primary' : 'default'}
              onClick={() => setFilterFilterStatus('REJECTED')}
              className="rounded-lg"
            >
              Bị từ chối ({vouchers.filter((v) => v.status === 'REJECTED').length})
            </Button>
          </div>

          <Button onClick={loadData} loading={loading} size="small" className="rounded-lg">
            Làm mới
          </Button>
        </div>

        <Table
          dataSource={Array.isArray(filteredVouchers) ? filteredVouchers : []}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Modal Tạo Phiếu Thu / Chi */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800 border-b pb-3">
            <Receipt className="text-red-600" size={20} />
            <span>Khởi Tạo Đề Xuất Phiếu Thu / Chi Bưu Cục</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        destroyOnClose
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateVoucher}
          initialValues={{
            voucherType: 'PAYMENT',
            category: 'Chi phí văn phòng phẩm & bao bì',
          }}
          className="pt-3"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="voucherType"
                label="Loại phiếu"
                rules={[{ required: true, message: 'Vui lòng chọn loại phiếu' }]}
              >
                <Select className="w-full">
                  <Option value="PAYMENT">Phiếu Chi (Đề xuất giải ngân chi tiêu)</Option>
                  <Option value="RECEIPT">Phiếu Thu (Nộp tiền mặt/COD về công ty)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="amount"
                label="Số tiền (VNĐ)"
                rules={[{ required: true, message: 'Vui lòng nhập số tiền' }]}
              >
                <InputNumber
                  className="w-full"
                  min={1000}
                  step={50000}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val!.replace(/\$\s?|(,*)/g, '') as any}
                  placeholder="e.g. 500,000"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="category"
            label="Danh mục chi phí"
            rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}
          >
            <Select>
              <Option value="Chi phí văn phòng phẩm & bao bì">Chi phí văn phòng phẩm & bao bì kẹp chì</Option>
              <Option value="Xăng dầu phương tiện bưu tá / xe tải">Xăng dầu phương tiện bưu tá / xe tải</Option>
              <Option value="Sửa chữa bảo dưỡng xe tải / xe máy">Sửa chữa bảo dưỡng xe tải / xe máy</Option>
              <Option value="Tiền điện nước mặt bằng kho bãi">Tiền điện nước mặt bằng kho bãi</Option>
              <Option value="Tạm ứng công tác phí trung chuyển">Tạm ứng công tác phí trung chuyển</Option>
              <Option value="Thu hồi nợ COD bưu tá nộp muộn">Thu hồi nợ COD bưu tá nộp muộn</Option>
              <Option value="Khác">Khoản thu chi khác</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Tiêu đề phiếu"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề phiếu' }]}
          >
            <Input placeholder="Ví dụ: Đề xuất thanh toán tiền bao bì niêm phong kẹp chì tháng 11" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả lý do chi tiết (Căn cứ giải trình với Kế toán)"
            rules={[{ required: true, message: 'Vui lòng nhập mô tả chi tiết' }]}
          >
            <TextArea
              rows={3}
              placeholder="Chi tiết nội dung chi tiêu, tài khoản thụ hưởng, số hóa đơn chứng từ..."
            />
          </Form.Item>

          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2 mb-4">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 shrink-0" />
            <span>
              Sau khi tạo, đề xuất sẽ tự động được gửi qua hệ thống thông báo thời gian thực đến phòng Kế toán. Tiền sẽ được giải ngân ngay khi Kế toán phê duyệt.
            </span>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t">
            <Button onClick={() => setIsModalOpen(false)}>Hủy bỏ</Button>
            <Button type="primary" htmlType="submit" className="bg-red-600 hover:bg-red-700 font-semibold">
              Gửi Kế Toán Phê Duyệt
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};
