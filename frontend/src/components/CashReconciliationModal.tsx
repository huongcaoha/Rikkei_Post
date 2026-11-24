import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Button,
  Table,
  Typography,
  Space,
  Tag,
  message,
  InputNumber,
  Input,
  Tabs,
  Alert,
  Segmented,
  Spin,
  Badge,
  DatePicker,
} from 'antd';
import {
  Banknote,
  Printer,
  Check,
  Calendar,
  FileText,
  CreditCard,
  QrCode,
  History,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import dayjs from 'dayjs';
import { CashReconciliationResponse, CashSubmission, Order } from '../types';
import { shipperApi } from '../api/shipper';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

interface CashReconciliationModalProps {
  visible: boolean;
  onClose: () => void;
  shipperId?: number;
}

export const CashReconciliationModal: React.FC<CashReconciliationModalProps> = ({
  visible,
  onClose,
  shipperId,
}) => {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.roles?.includes('ROLE_ADMIN') || user?.roles?.includes('ROLE_POST_OFFICE_MANAGER');

  const [activeTab, setActiveTab] = useState<'RECONCILE' | 'HISTORY'>('RECONCILE');
  const [data, setData] = useState<CashReconciliationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [submitAmount, setSubmitAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'PAYOS' | 'CASH'>('PAYOS');

  // Bộ lọc khoảng thời gian Tab 1 & Tab 2
  const [reconcileDates, setReconcileDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [historyDates, setHistoryDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(7, 'day').startOf('day'),
    dayjs().endOf('day'),
  ]);

  // Lịch sử nộp tiền
  const [submissions, setSubmissions] = useState<CashSubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // PayOS QR Checkout Popup
  const [payOsModalVisible, setPayOsModalVisible] = useState<boolean>(false);
  const [payOsData, setPayOsData] = useState<any>(null);
  const [checkingPayOs, setCheckingPayOs] = useState<boolean>(false);
  const pollTimerRef = useRef<any>(null);

  const loadData = async (startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const sDate = startDate || reconcileDates[0].format('YYYY-MM-DD');
      const eDate = endDate || reconcileDates[1].format('YYYY-MM-DD');
      const res = await shipperApi.getCashReconciliation(shipperId, undefined, sDate, eDate);
      setData(res);
      setSubmitAmount(res.totalCashToSubmit || 0);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải bảng kê nộp tiền!');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (startDate?: string, endDate?: string) => {
    setLoadingHistory(true);
    try {
      const sDate = startDate || historyDates[0].format('YYYY-MM-DD');
      const eDate = endDate || historyDates[1].format('YYYY-MM-DD');
      const res = await shipperApi.getCashSubmissions({
        shipperId,
        startDate: sDate,
        endDate: eDate,
        page: 0,
        size: 50,
      });
      setSubmissions(res.content || []);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải lịch sử nộp tiền!');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
      loadHistory();
    } else {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [visible, shipperId]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Xử lý nộp tiền (PayOS VietQR hoặc Tiền mặt)
  const handleSubmit = async () => {
    if (submitAmount <= 0) {
      message.warning('Số tiền nộp phải lớn hơn 0 VNĐ!');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        amountSubmitted: submitAmount,
        shiftDate: dayjs().format('YYYY-MM-DD'),
        paymentMethod: paymentMethod,
        notes: notes || `Nộp tiền cuối ca qua ${paymentMethod === 'PAYOS' ? 'PayOS VietQR' : 'Tiền mặt'}`,
        returnUrl: window.location.href,
        cancelUrl: window.location.href,
      };

      const res = await shipperApi.submitCash(payload);

      if (paymentMethod === 'PAYOS') {
        setPayOsData(res);
        setPayOsModalVisible(true);
        startPollingPayment(res.submissionCode);
      } else {
        message.success('Đã gửi yêu cầu nộp tiền mặt. Vui lòng bàn giao tiền cho Thủ quỹ bưu cục để xác nhận!');
        loadData();
        loadHistory();
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi nộp tiền!');
    } finally {
      setSubmitting(false);
    }
  };

  // Polling kiểm tra trạng thái thanh toán PayOS
  const startPollingPayment = (submissionCode: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const checkRes = await shipperApi.checkSubmissionStatus(submissionCode);
        if (checkRes.status === 'COMPLETED') {
          clearInterval(pollTimerRef.current);
          message.success('🎉 Thanh toán PayOS VietQR thành công! Đã quyết toán trừ nợ trên hệ thống.');
          setPayOsModalVisible(false);
          loadData();
          loadHistory();
        }
      } catch (e) {
        // Silent polling error
      }
    }, 2500);
  };

  // Quản lý / Thủ quỹ duyệt nhận tiền mặt
  const handleApproveCash = async (submissionCode: string) => {
    try {
      await shipperApi.approveCashSubmission(submissionCode);
      message.success(`Đã duyệt nhận đủ tiền mặt cho bảng kê [${submissionCode}]!`);
      loadData();
      loadHistory();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi duyệt tiền mặt!');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Cột bảng đơn hàng trong ca
  const orderColumns = [
    {
      title: 'Mã vận đơn',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      render: (code: string) => <span className="font-mono font-bold text-blue-700">{code}</span>,
    },
    {
      title: 'Khách nhận',
      dataIndex: 'receiverName',
      key: 'receiverName',
      render: (name: string, record: Order) => (
        <div>
          <div className="font-medium text-xs text-gray-800">{name}</div>
          <div className="text-[11px] text-gray-500">{record.receiverPhone}</div>
        </div>
      ),
    },
    {
      title: 'Tiền COD',
      dataIndex: 'codAmount',
      key: 'codAmount',
      align: 'right' as const,
      render: (amount: number) => (
        <span className="font-bold text-red-600">{(amount || 0).toLocaleString('vi-VN')} đ</span>
      ),
    },
    {
      title: 'Cước thu khách',
      dataIndex: 'totalFee',
      key: 'totalFee',
      align: 'right' as const,
      render: (fee: number, record: Order) => {
        if (record.paymentParty === 'RECEIVER') {
          return <span className="font-bold text-gray-700">{(fee || 0).toLocaleString('vi-VN')} đ</span>;
        }
        return <span className="text-gray-400 text-xs">Người gửi trả</span>;
      },
    },
    {
      title: 'Đã nộp',
      dataIndex: 'settledCashAmount',
      key: 'settledCashAmount',
      align: 'right' as const,
      render: (settled: number) => (
        <span className="font-semibold text-emerald-700">{(settled || 0).toLocaleString('vi-VN')} đ</span>
      ),
    },
    {
      title: 'Còn phải nộp',
      key: 'remainingAmount',
      align: 'right' as const,
      render: (_: any, record: Order) => {
        const orderCod = record.codAmount || 0;
        const orderFee = record.paymentParty === 'RECEIVER' ? (record.totalFee || 0) : 0;
        const totalOrder = orderCod + orderFee;
        const settled = record.settledCashAmount || 0;
        const remaining = record.remainingCashAmount !== undefined ? record.remainingCashAmount : Math.max(0, totalOrder - settled);
        return (
          <span className={`font-black ${remaining > 0 ? 'text-red-700' : 'text-gray-400'}`}>
            {remaining.toLocaleString('vi-VN')} đ
          </span>
        );
      },
    },
    {
      title: 'Trạng thái nộp',
      key: 'isCashSettled',
      render: (_: any, record: Order) => {
        const settled = record.settledCashAmount || 0;
        if (record.isCashSettled) {
          return (
            <Tag color="success" className="font-medium text-[11px]">
              Đã quyết toán đủ
            </Tag>
          );
        }
        if (settled > 0) {
          return (
            <Tag color="processing" className="font-medium text-[11px]">
              Đã nộp 1 phần
            </Tag>
          );
        }
        return (
          <Tag color="warning" className="font-medium text-[11px]">
            Chưa nộp tiền
          </Tag>
        );
      },
    },
  ];

  // Cột bảng lịch sử nộp tiền
  const historyColumns = [
    {
      title: 'Mã bảng kê',
      dataIndex: 'submissionCode',
      key: 'submissionCode',
      render: (code: string) => <span className="font-mono font-bold text-gray-900">{code}</span>,
    },
    {
      title: 'Ngày nộp',
      dataIndex: 'shiftDate',
      key: 'shiftDate',
      render: (date: string, record: CashSubmission) => (
        <div className="text-xs">
          <div className="font-semibold text-gray-800">{date}</div>
          <div className="text-[10px] text-gray-400">
            {record.createdAt ? dayjs(record.createdAt).format('HH:mm DD/MM') : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Số đơn',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      align: 'center' as const,
      render: (count: number) => <span className="font-medium">{count || 0} đơn</span>,
    },
    {
      title: 'Số tiền nộp',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right' as const,
      render: (amount: number) => (
        <span className="font-black text-emerald-700">
          {(amount || 0).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Phương thức',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method: string) => (
        <Tag color={method === 'PAYOS' ? 'purple' : 'blue'} className="font-semibold text-xs">
          {method === 'PAYOS' ? 'PayOS VietQR' : 'Tiền mặt'}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: CashSubmission) => {
        if (status === 'COMPLETED') {
          return (
            <Tag color="success" icon={<CheckCircle2 size={12} className="inline mr-1" />}>
              Đã hoàn tất
            </Tag>
          );
        }
        if (status === 'PENDING') {
          return (
            <Tag color="warning" icon={<AlertTriangle size={12} className="inline mr-1" />}>
              Chờ thanh toán / duyệt
            </Tag>
          );
        }
        return <Tag color="default">{status}</Tag>;
      },
    },
    {
      title: 'Người duyệt / Cổng',
      dataIndex: 'approvedByName',
      key: 'approvedByName',
      render: (name: string, record: CashSubmission) => (
        <span className="text-xs text-gray-600">
          {name || (record.paymentMethod === 'PAYOS' ? 'PayOS VietQR Gateway' : 'N/A')}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: CashSubmission) => {
        if (record.status === 'PENDING') {
          if (record.paymentMethod === 'PAYOS') {
            return (
              <Button
                size="small"
                type="primary"
                className="bg-purple-600 hover:bg-purple-700 text-xs font-semibold"
                onClick={() => {
                  setPayOsData(record);
                  setPayOsModalVisible(true);
                  startPollingPayment(record.submissionCode);
                }}
              >
                Thanh toán
              </Button>
            );
          }
          if (record.paymentMethod === 'CASH' && isManagerOrAdmin) {
            return (
              <Button
                size="small"
                type="primary"
                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold"
                onClick={() => handleApproveCash(record.submissionCode)}
              >
                Duyệt tiền
              </Button>
            );
          }
        }
        return <span className="text-gray-400 text-xs font-mono">Đã xong</span>;
      },
    },
  ];

  return (
    <>
      <Modal
        open={visible}
        onCancel={onClose}
        footer={null}
        width={780}
        centered
        title={
          <div className="flex items-center space-x-2 text-emerald-700">
            <Banknote size={24} />
            <span className="font-bold text-lg">Đối Soát & Nộp Tiền Cuối Ca Bưu Tá</span>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Tabs: Quyết toán nộp tiền & Lịch sử nộp tiền */}
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as any)}
            items={[
              {
                key: 'RECONCILE',
                label: (
                  <span className="flex items-center gap-1.5 font-bold text-sm">
                    <Banknote size={16} /> Bảng Kê Quyết Toán Nộp Tiền
                  </span>
                ),
              },
              {
                key: 'HISTORY',
                label: (
                  <span className="flex items-center gap-1.5 font-bold text-sm">
                    <History size={16} /> Lịch Sử Nộp Tiền & Đối Soát ({submissions.length})
                  </span>
                ),
              },
            ]}
          />

          {/* TAB 1: BẢNG KÊ QUYẾT TOÁN NỘP TIỀN */}
          {activeTab === 'RECONCILE' && (
            <div className="space-y-4">
              {/* Bộ lọc khoảng thời gian tìm kiếm */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700">Thời gian giao:</span>
                  <DatePicker.RangePicker
                    value={reconcileDates}
                    onChange={(dates) => {
                      if (dates && dates[0] && dates[1]) {
                        setReconcileDates([dates[0], dates[1]]);
                        loadData(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
                      }
                    }}
                    size="small"
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="small"
                    onClick={() => {
                      const today = [dayjs().startOf('day'), dayjs().endOf('day')] as [dayjs.Dayjs, dayjs.Dayjs];
                      setReconcileDates(today);
                      loadData(today[0].format('YYYY-MM-DD'), today[1].format('YYYY-MM-DD'));
                    }}
                  >
                    Hôm nay
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      const range = [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')] as [dayjs.Dayjs, dayjs.Dayjs];
                      setReconcileDates(range);
                      loadData(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'));
                    }}
                  >
                    7 ngày qua
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      const range = [dayjs().startOf('month'), dayjs().endOf('month')] as [dayjs.Dayjs, dayjs.Dayjs];
                      setReconcileDates(range);
                      loadData(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'));
                    }}
                  >
                    Tháng này
                  </Button>
                  <Button
                    size="small"
                    icon={<RotateCcw size={13} />}
                    onClick={() => loadData()}
                    loading={loading}
                  />
                </div>
              </div>

              {/* CẢNH BÁO KHÓA XUẤT KHO NẾU CÒN NỢ TỪ CÁC NGÀY TRƯỚC */}
              {data?.isBlockedFromDelivery && (
                <Alert
                  type="error"
                  showIcon
                  icon={<ShieldAlert size={20} className="text-red-600" />}
                  message={
                    <span className="font-bold text-red-800">
                      KHÓA XUẤT KHO GIAO HÀNG NGÀY HÔM SAU
                    </span>
                  }
                  description={
                    <div className="text-xs text-red-700 leading-relaxed mt-0.5">
                      Bạn đang còn nợ{' '}
                      <strong className="text-base text-red-900 font-black">
                        {(data.pastUnsettledDebt || 0).toLocaleString('vi-VN')} đ
                      </strong>{' '}
                      tiền thu hộ COD từ các ca ngày trước chưa thanh toán! Theo quy định an toàn tiền hàng,
                      bạn sẽ <strong>bị khóa không được quét lấy đơn mới đi giao</strong> cho đến khi hoàn
                      tất nộp tiền nợ này qua PayOS hoặc nộp tiền mặt cho Thủ quỹ bưu cục.
                    </div>
                  }
                  className="border-red-300 bg-red-50 rounded-xl"
                />
              )}

              {/* Thẻ tóm tắt tiền mặt */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                    TỔNG TIỀN PHẢI NỘP
                  </div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {(data?.totalCashToSubmit || 0).toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5 font-medium">
                    {data?.unsettledOrdersCount || 0} đơn chưa nộp tiền
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                    TIỀN THU HỘ COD
                  </div>
                  <div className="text-2xl font-black text-red-600 mt-1">
                    {(data?.totalCodCollected || 0).toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Tiền hàng shop thu hộ</div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center shadow-xs">
                  <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">
                    CƯỚC THU NGƯỜI NHẬN
                  </div>
                  <div className="text-2xl font-black text-blue-700 mt-1">
                    {(data?.totalFeeCollected || 0).toLocaleString('vi-VN')} đ
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">Tiền cước vận chuyển</div>
                </div>
              </div>

              {/* Thông tin nhân sự */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center text-xs text-gray-700">
                <div>
                  Bưu tá: <b className="text-gray-900">{data?.shipperName}</b> (SĐT: {data?.shipperPhone})
                </div>
                <div>
                  Ca ngày: <b className="text-blue-700">{data?.shiftDate}</b>
                </div>
              </div>

              {/* Bảng chi tiết đơn hàng */}
              <div>
                <div className="text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <FileText size={15} className="text-blue-600" />
                    <span>Danh sách đơn hàng trong ca ({data?.orders?.length || 0} đơn):</span>
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Đã quyết toán: <strong className="text-emerald-600">{data?.settledOrdersCount || 0}</strong> | Chưa nộp: <strong className="text-red-600">{data?.unsettledOrdersCount || 0}</strong>
                  </span>
                </div>
                <Table
                  dataSource={data?.orders || []}
                  columns={orderColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 5 }}
                  loading={loading}
                  className="border rounded-xl overflow-hidden"
                />
              </div>

              {/* Khung nộp tiền với 2 phương thức: PayOS hoặc Tiền mặt */}
              <div className="bg-gradient-to-r from-emerald-50/70 to-teal-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <CreditCard size={16} className="text-emerald-600" />
                    <span>Phương thức nộp tiền cuối ca:</span>
                  </div>
                  <Segmented
                    value={paymentMethod}
                    onChange={(val) => setPaymentMethod(val as any)}
                    options={[
                      {
                        label: 'Nộp Online qua PayOS (VietQR)',
                        value: 'PAYOS',
                        icon: <QrCode size={14} className="text-purple-600 inline mr-1" />,
                      },
                      {
                        label: 'Nộp tiền mặt tại bưu cục',
                        value: 'CASH',
                        icon: <Banknote size={14} className="text-emerald-600 inline mr-1" />,
                      },
                    ]}
                    className="font-bold text-xs bg-white shadow-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="text-[11px] text-gray-600 font-semibold mb-1">
                      Số tiền thực tế bàn giao / chuyển khoản:
                    </div>
                    <InputNumber
                      className="w-full font-bold text-lg text-emerald-700 rounded-xl"
                      value={submitAmount}
                      onChange={(val) => setSubmitAmount(val || 0)}
                      formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={(val) => Number(val?.replace(/\$\s?|(,*)/g, '') || 0)}
                      addonAfter="đ"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-600 font-semibold mb-1">Ghi chú nộp tiền:</div>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ghi chú nộp tiền cuối ca..."
                      className="rounded-xl h-9"
                    />
                  </div>
                </div>

                {paymentMethod === 'PAYOS' && (
                  <div className="text-2xs text-purple-700 bg-purple-50 p-2 rounded-xl flex items-center gap-2 border border-purple-200">
                    <QrCode size={16} className="shrink-0" />
                    <span>
                      Hệ thống sẽ tạo mã QR thanh toán <strong>VietQR 24/7 qua cổng PayOS</strong>. Sau khi chuyển
                      khoản thành công, hệ thống tự động ghi nhận trừ nợ và mở khóa lấy hàng ngay lập tức!
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-2 border-t">
                <Button
                  icon={<Printer size={16} />}
                  onClick={handlePrint}
                  className="text-xs font-medium rounded-xl"
                >
                  In Phiếu Bảng Kê
                </Button>
                <Space>
                  <Button onClick={onClose} className="rounded-xl">
                    Đóng
                  </Button>
                  <Button
                    type="primary"
                    loading={submitting}
                    onClick={handleSubmit}
                    icon={paymentMethod === 'PAYOS' ? <QrCode size={16} /> : <Check size={16} />}
                    className={`font-bold rounded-xl h-10 px-5 shadow-sm ${
                      paymentMethod === 'PAYOS'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {paymentMethod === 'PAYOS' ? 'Nộp Tiền Qua PayOS (VietQR)' : 'Xác Nhận Nộp Tiền Mặt'}
                  </Button>
                </Space>
              </div>
            </div>
          )}

          {/* TAB 2: LỊCH SỬ NỘP TIỀN & ĐỐI SOÁT */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              {/* Bộ lọc khoảng thời gian tìm kiếm lịch sử */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-gray-600" />
                  <span className="text-xs font-semibold text-gray-700">Lọc ngày nộp:</span>
                  <DatePicker.RangePicker
                    value={historyDates}
                    onChange={(dates) => {
                      if (dates && dates[0] && dates[1]) {
                        setHistoryDates([dates[0], dates[1]]);
                        loadHistory(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
                      }
                    }}
                    size="small"
                    format="DD/MM/YYYY"
                    allowClear={false}
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="small"
                    onClick={() => {
                      const range = [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')] as [dayjs.Dayjs, dayjs.Dayjs];
                      setHistoryDates(range);
                      loadHistory(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'));
                    }}
                  >
                    7 ngày qua
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      const range = [dayjs().startOf('month'), dayjs().endOf('month')] as [dayjs.Dayjs, dayjs.Dayjs];
                      setHistoryDates(range);
                      loadHistory(range[0].format('YYYY-MM-DD'), range[1].format('YYYY-MM-DD'));
                    }}
                  >
                    Tháng này
                  </Button>
                  <Button
                    size="small"
                    icon={<RotateCcw size={13} />}
                    onClick={() => loadHistory()}
                    loading={loadingHistory}
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600 font-medium">
                  Lịch sử các lần nộp tiền mặt và thanh toán PayOS để đối soát:
                </span>
              </div>

              <Table
                dataSource={submissions}
                columns={historyColumns}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 8 }}
                loading={loadingHistory}
                className="border rounded-xl overflow-hidden"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* POPUP THANH TOÁN PAYOS VIETQR */}
      <Modal
        open={payOsModalVisible}
        onCancel={() => {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setPayOsModalVisible(false);
          loadData();
          loadHistory();
        }}
        footer={null}
        width={420}
        centered
        className="payos-checkout-modal"
        title={
          <div className="flex items-center gap-2 text-purple-700 border-b pb-2">
            <QrCode size={20} />
            <span className="font-bold text-base">Thanh Toán Nộp Tiền PayOS (VietQR)</span>
          </div>
        }
      >
        <div className="py-2 text-center space-y-3">
          <div className="text-xs text-gray-600">
            Mã bảng kê: <strong className="font-mono text-gray-900">{payOsData?.submissionCode}</strong>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
            <div className="text-xs text-purple-700 font-bold uppercase tracking-wider mb-1">
              SỐ TIỀN CẦN THANH TOÁN
            </div>
            <div className="text-3xl font-black text-purple-800">
              {(payOsData?.totalAmount || payOsData?.amount || 0).toLocaleString('vi-VN')} đ
            </div>
          </div>

          {/* Hiển thị QR Code nếu có */}
          {payOsData?.qrCode ? (
            <div className="flex flex-col items-center justify-center p-3 bg-white border-2 border-dashed border-purple-300 rounded-2xl shadow-xs">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  payOsData.qrCode
                )}`}
                alt="PayOS VietQR"
                className="w-48 h-48 rounded-lg shadow-sm"
              />
              <span className="text-[11px] text-gray-500 mt-2 font-medium">
                Mở ứng dụng Ngân hàng quét mã VietQR để thanh toán
              </span>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border rounded-xl text-center space-y-2">
              <p className="text-xs text-gray-700">Bấm nút bên dưới để mở trang thanh toán PayOS:</p>
              {payOsData?.checkoutUrl && (
                <a
                  href={payOsData.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-purple-600 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-purple-700 shadow-sm"
                >
                  <ExternalLink size={14} /> Mở Trang Thanh Toán PayOS
                </a>
              )}
            </div>
          )}

          {/* Trạng thái lắng nghe realtime */}
          <div className="flex items-center justify-center gap-2 text-xs text-purple-700 font-medium py-1">
            <Spin size="small" /> Đang chờ ngân hàng xác nhận giao dịch chuyển khoản...
          </div>

          {/* Đóng cửa sổ */}
          <div className="pt-2 border-t flex flex-col gap-2">
            <Button
              block
              onClick={() => {
                if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                setPayOsModalVisible(false);
                loadData();
                loadHistory();
              }}
              className="text-xs"
            >
              Đóng cửa sổ
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default CashReconciliationModal;
