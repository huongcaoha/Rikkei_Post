import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Button,
  Table,
  Tag,
  Tabs,
  Modal,
  Input,
  message,
  Space,
  Descriptions,
} from 'antd';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CheckCircle,
  XCircle,
  BrainCircuit,
  Filter,
  Eye,
  CreditCard,
  Coins,
  Send,
  Sparkles,
} from 'lucide-react';
import dayjs from 'dayjs';
import { payrollApi } from '../api/payroll';
import { paymentVoucherApi } from '../api/voucher';
import { AccountantDashboard, PayrollRecord, PaymentVoucher } from '../types';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

export const AccountantDashboardPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<AccountantDashboard | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'),
    dayjs().endOf('month'),
  ]);

  // Vouchers state
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [voucherLoading, setVoucherLoading] = useState<boolean>(false);
  const [voucherFilterStatus, setVoucherFilterStatus] = useState<string>('ALL');
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectVoucherId, setRejectVoucherId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Payroll state
  const [payrollMonth, setPayrollMonth] = useState<number>(dayjs().month() + 1);
  const [payrollYear, setPayrollYear] = useState<number>(dayjs().year());
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [payrollLoading, setPayrollLoading] = useState<boolean>(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  // Load dashboard
  const loadDashboard = async () => {
    setLoading(true);
    try {
      const startDate = dateRange[0].format('YYYY-MM-DD');
      const endDate = dateRange[1].format('YYYY-MM-DD');
      const data = await payrollApi.getAccountantDashboard(startDate, endDate);
      setDashboardData(data);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải dữ liệu thống kê tài chính!');
    } finally {
      setLoading(false);
    }
  };

  // Load vouchers
  const loadVouchers = async () => {
    setVoucherLoading(true);
    try {
      const data = await paymentVoucherApi.getAllVouchers();
      setVouchers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setVouchers([]);
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách phiếu thu chi!');
    } finally {
      setVoucherLoading(false);
    }
  };

  // Load payrolls
  const loadPayrolls = async () => {
    setPayrollLoading(true);
    try {
      const data = await payrollApi.getHubPayrolls(undefined, payrollMonth, payrollYear);
      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setPayrolls([]);
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách bảng kê lương!');
    } finally {
      setPayrollLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [dateRange]);

  useEffect(() => {
    loadVouchers();
    loadPayrolls();
  }, []);

  // Approve Voucher
  const handleApproveVoucher = async (voucher: PaymentVoucher) => {
    try {
      await paymentVoucherApi.approveVoucher(voucher.id, {
        notes: `Kế toán phê duyệt giải ngân thành công ngày ${dayjs().format('DD/MM/YYYY HH:mm')}`,
      });
      message.success(`Đã phê duyệt và giải ngân phiếu ${voucher.voucherCode}`);
      loadVouchers();
      loadDashboard();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Phê duyệt thất bại!');
    }
  };

  // Reject Voucher
  const handleConfirmReject = async () => {
    if (!rejectVoucherId || !rejectReason.trim()) {
      message.warning('Vui lòng nhập lý do từ chối phiếu!');
      return;
    }
    try {
      await paymentVoucherApi.rejectVoucher(rejectVoucherId, { rejectionReason: rejectReason.trim() });
      message.success('Đã từ chối phiếu đề xuất!');
      setRejectModalOpen(false);
      setRejectReason('');
      setRejectVoucherId(null);
      loadVouchers();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác từ chối thất bại!');
    }
  };

  // Approve Payroll by Accountant
  const handleApprovePayroll = async (record: PayrollRecord) => {
    try {
      await payrollApi.approveByAccountant(record.id);
      message.success(`Đã duyệt chi trả lương cho nhân viên ${record.employeeName} (ID: ${record.userId})`);
      loadPayrolls();
      loadDashboard();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Duyệt lương thất bại!');
    }
  };

  const getVoucherStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Tag color="gold" className="font-semibold">Chờ kế toán duyệt</Tag>;
      case 'APPROVED':
        return <Tag color="green" className="font-semibold">Đã duyệt & Giải ngân</Tag>;
      case 'REJECTED':
        return <Tag color="red" className="font-semibold">Bị từ chối</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const getPayrollStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Tag color="blue">AI đã khởi tạo</Tag>;
      case 'PENDING_MANAGER_APPROVAL':
        return <Tag color="orange">Chờ Quản lý duyệt</Tag>;
      case 'PENDING_ACCOUNTANT_APPROVAL':
        return <Tag color="cyan">Chờ Kế toán duyệt & Trả</Tag>;
      case 'PAID':
        return <Tag color="green">Đã trả lương</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const filteredVouchers = vouchers.filter((v) => {
    if (voucherFilterStatus === 'ALL') return true;
    return v.status === voucherFilterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <DollarSign className="mr-2 text-emerald-600" size={28} />
            Bảng Điều Khiển Kế Toán & Quản Trị Tài Chính
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Giám sát dòng tiền COD, đối soát tiền cước, xét duyệt phiếu thu chi & chi trả bảng lương 3P
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white p-2 rounded-xl border border-gray-200 shadow-xs">
          <Filter size={16} className="text-gray-400 ml-1" />
          <span className="text-xs text-gray-600 font-medium">Kỳ thống kê:</span>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]]);
              }
            }}
            format="DD/MM/YYYY"
            allowClear={false}
            className="rounded-lg"
          />
          <Button type="primary" onClick={loadDashboard} loading={loading} className="bg-emerald-600 hover:bg-emerald-700 font-semibold rounded-lg">
            Cập nhật
          </Button>
        </div>
      </div>

      {/* 4 Cards Thống kê tài chính cốt lõi */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-xs border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white">
            <Statistic
              title={<span className="text-gray-600 font-medium text-xs">Tổng Tiền Thu Hộ (COD) Thu Được</span>}
              value={dashboardData?.totalCodCollected || 0}
              precision={0}
              prefix={<Coins className="mr-2 text-emerald-600" size={20} />}
              suffix="đ"
              valueStyle={{ color: '#059669', fontWeight: 800 }}
            />
            <div className="text-[11px] text-gray-500 mt-2 flex justify-between items-center border-t border-emerald-100/60 pt-2">
              <span>Đã thu từ khách nhận</span>
              <Tag color="success" className="m-0 text-[10px]">Tiền mặt + Chuyển khoản</Tag>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-xs border-blue-100 bg-gradient-to-br from-blue-50/50 to-white">
            <Statistic
              title={<span className="text-gray-600 font-medium text-xs">Phải Chi Trả Khách Hàng (Shop)</span>}
              value={dashboardData?.totalMerchantPayable || 0}
              precision={0}
              prefix={<CreditCard className="mr-2 text-blue-600" size={20} />}
              suffix="đ"
              valueStyle={{ color: '#2563eb', fontWeight: 800 }}
            />
            <div className="text-[11px] text-gray-500 mt-2 flex justify-between items-center border-t border-blue-100/60 pt-2">
              <span>Sau khấu trừ cước nếu có</span>
              <span className="font-semibold text-blue-700">Ví / Chuyển khoản</span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-xs border-purple-100 bg-gradient-to-br from-purple-50/50 to-white">
            <Statistic
              title={<span className="text-gray-600 font-medium text-xs">Tổng Doanh Thu Cước Vận Chuyển</span>}
              value={dashboardData?.totalShippingRevenue || 0}
              precision={0}
              prefix={<TrendingUp className="mr-2 text-purple-600" size={20} />}
              suffix="đ"
              valueStyle={{ color: '#7c3aed', fontWeight: 800 }}
            />
            <div className="text-[11px] text-gray-500 mt-2 flex justify-between items-center border-t border-purple-100/60 pt-2">
              <span>Đã duyệt chi phí:</span>
              <span className="font-bold text-purple-700">
                {(dashboardData?.approvedPaymentsAmount || 0).toLocaleString()} đ
              </span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-xs border-rose-100 bg-gradient-to-br from-rose-50/50 to-white">
            <Statistic
              title={<span className="text-gray-600 font-medium text-xs">Tổng Chi Tiêu (Voucher + Lương)</span>}
              value={dashboardData?.totalExpenses || 0}
              precision={0}
              prefix={<Receipt className="mr-2 text-rose-600" size={20} />}
              suffix="đ"
              valueStyle={{ color: '#e11d48', fontWeight: 800 }}
            />
            <div className="text-[11px] text-gray-500 mt-2 flex justify-between items-center border-t border-rose-100/60 pt-2">
              <span>Lợi nhuận ròng:</span>
              <span className={`font-black ${(dashboardData?.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(dashboardData?.netProfit || 0).toLocaleString()} đ
              </span>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Tabs Quản lý Xét Duyệt: Phiếu Thu - Chi & Bảng Kê Lương */}
      <Card className="shadow-xs border-gray-200">
        <Tabs
          defaultActiveKey="vouchers"
          items={[
            {
              key: 'vouchers',
              label: (
                <span className="flex items-center space-x-2 font-bold px-1">
                  <Receipt size={17} />
                  <span>Xét Duyệt Phiếu Thu - Chi ({vouchers.filter((v) => v.status === 'PENDING').length})</span>
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold text-gray-600">Trạng thái:</span>
                      <Button
                        size="small"
                        type={voucherFilterStatus === 'ALL' ? 'primary' : 'default'}
                        onClick={() => setVoucherFilterStatus('ALL')}
                        className="rounded-lg"
                      >
                        Tất cả ({vouchers.length})
                      </Button>
                      <Button
                        size="small"
                        type={voucherFilterStatus === 'PENDING' ? 'primary' : 'default'}
                        onClick={() => setVoucherFilterStatus('PENDING')}
                        className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white"
                      >
                        Chờ duyệt ({vouchers.filter((v) => v.status === 'PENDING').length})
                      </Button>
                      <Button
                        size="small"
                        type={voucherFilterStatus === 'APPROVED' ? 'primary' : 'default'}
                        onClick={() => setVoucherFilterStatus('APPROVED')}
                        className="rounded-lg"
                      >
                        Đã duyệt
                      </Button>
                      <Button
                        size="small"
                        type={voucherFilterStatus === 'REJECTED' ? 'primary' : 'default'}
                        onClick={() => setVoucherFilterStatus('REJECTED')}
                        className="rounded-lg"
                      >
                        Từ chối
                      </Button>
                    </div>

                    <Button onClick={loadVouchers} loading={voucherLoading} size="small" className="rounded-lg">
                      Làm mới
                    </Button>
                  </div>

                  <Table
                    dataSource={Array.isArray(filteredVouchers) ? filteredVouchers : []}
                    rowKey="id"
                    loading={voucherLoading}
                    pagination={{ pageSize: 8 }}
                    columns={[
                      {
                        title: 'Mã Phiếu',
                        dataIndex: 'voucherCode',
                        key: 'voucherCode',
                        render: (code: string, r: PaymentVoucher) => (
                          <div>
                            <span className="font-mono font-bold text-gray-800">{code}</span>
                            <div className="text-[11px] text-gray-400">
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
                        title: 'Đơn vị / Bưu cục',
                        dataIndex: 'warehouseName',
                        key: 'warehouseName',
                        render: (wName: string, r: PaymentVoucher) => (
                          <div className="text-xs">
                            <div className="font-semibold text-gray-800">{wName || 'Toàn hệ thống'}</div>
                            <div className="text-gray-400">Người tạo: {r.createdByUserName}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Số Tiền',
                        dataIndex: 'amount',
                        key: 'amount',
                        render: (amt: number, r: PaymentVoucher) => (
                          <div className={`font-black text-sm ${r.voucherType === 'RECEIPT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {r.voucherType === 'RECEIPT' ? '+' : '-'}{amt?.toLocaleString()} đ
                          </div>
                        ),
                      },
                      {
                        title: 'Mục đích & Diễn giải',
                        key: 'description',
                        render: (_: any, r: PaymentVoucher) => (
                          <div className="text-xs max-w-xs">
                            <div className="font-medium text-gray-700">{r.category || 'Chi phí hoạt động'}</div>
                            <div className="text-gray-500 line-clamp-2">{r.description || r.title}</div>
                            {r.disbursementMethod && (
                              <div className="text-[11px] text-blue-600 mt-0.5">Phương thức: {r.disbursementMethod}</div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Trạng Thái',
                        dataIndex: 'status',
                        key: 'status',
                        render: (st: string) => getVoucherStatusBadge(st),
                      },
                      {
                        title: 'Thời gian',
                        dataIndex: 'createdAt',
                        key: 'createdAt',
                        render: (dt: string) => (
                          <div className="text-xs text-gray-500">
                            {dt ? dayjs(dt).format('DD/MM/YYYY HH:mm') : '-'}
                          </div>
                        ),
                      },
                      {
                        title: 'Thao Tác',
                        key: 'action',
                        render: (_: any, r: PaymentVoucher) => {
                          if (r.status !== 'PENDING') {
                            return (
                              <div className="text-xs text-gray-400">
                                {r.approvedByUserName ? `Duyệt bởi: ${r.approvedByUserName}` : 'Hoàn tất'}
                              </div>
                            );
                          }
                          return (
                            <Space size="small">
                              <Button
                                size="small"
                                type="primary"
                                icon={<CheckCircle size={14} />}
                                onClick={() => handleApproveVoucher(r)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-lg"
                              >
                                Duyệt giải ngân
                              </Button>
                              <Button
                                size="small"
                                danger
                                icon={<XCircle size={14} />}
                                onClick={() => {
                                  setRejectVoucherId(r.id);
                                  setRejectModalOpen(true);
                                }}
                                className="text-xs rounded-lg"
                              >
                                Từ chối
                              </Button>
                            </Space>
                          );
                        },
                      },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'payrolls',
              label: (
                <span className="flex items-center space-x-2 font-bold px-1">
                  <Coins size={17} />
                  <span>Duyệt Chi Trả Lương 3P Logistics</span>
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold text-gray-700">Kỳ trả lương:</span>
                      <DatePicker
                        picker="month"
                        value={dayjs().year(payrollYear).month(payrollMonth - 1)}
                        onChange={(d) => {
                          if (d) {
                            setPayrollMonth(d.month() + 1);
                            setPayrollYear(d.year());
                          }
                        }}
                        format="MM/YYYY"
                        allowClear={false}
                        className="rounded-lg"
                      />
                      <Button
                        type="primary"
                        onClick={loadPayrolls}
                        loading={payrollLoading}
                        className="bg-red-600 hover:bg-red-700 font-semibold rounded-lg text-xs"
                      >
                        Tải danh sách
                      </Button>
                    </div>

                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <BrainCircuit size={16} className="text-purple-600" />
                      <span>Công thức 3P: P1 (Vị trí) + P2 (Sản lượng) + P3 (Hiệu suất KPI) + Phụ cấp - Khấu trừ</span>
                    </div>
                  </div>

                  <Table
                    dataSource={Array.isArray(payrolls) ? payrolls : []}
                    rowKey="id"
                    loading={payrollLoading}
                    pagination={{ pageSize: 8 }}
                    columns={[
                      {
                        title: 'Mã Bảng Lương',
                        dataIndex: 'payrollCode',
                        key: 'payrollCode',
                        render: (code: string) => <span className="font-mono font-bold text-gray-800">{code}</span>,
                      },
                      {
                        title: 'Nhân Viên',
                        key: 'employee',
                        render: (_: any, r: PayrollRecord) => (
                          <div>
                            <div className="font-bold text-gray-800">{r.employeeName}</div>
                            <div className="text-xs text-gray-400 font-mono">ID: {r.userId} | {r.roleName?.replace('ROLE_', '')}</div>
                            <div className="text-xs text-gray-500">{r.warehouseName}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Chấm Công & Sản Lượng (3P)',
                        key: 'performance',
                        render: (_: any, r: PayrollRecord) => (
                          <div className="text-xs space-y-0.5">
                            <div>Công thực tế: <span className="font-semibold text-emerald-700">{r.actualWorkDays} / {r.standardWorkDays} công</span></div>
                            {r.deliveredOrdersCount > 0 && (
                              <div>Đơn giao: <span className="font-bold text-blue-600">{r.deliveredOrdersCount} đơn</span></div>
                            )}
                            {r.totalTripKm > 0 && (
                              <div>Cự ly xe: <span className="font-bold text-amber-600">{r.totalTripKm.toFixed(1)} km</span></div>
                            )}
                            {r.sortedPackagesCount > 0 && (
                              <div>Kiện chia chọn: <span className="font-bold text-purple-600">{r.sortedPackagesCount} kiện</span></div>
                            )}
                          </div>
                        ),
                      },
                      {
                        title: 'Cơ Cấu Thu Nhập (3P)',
                        key: 'breakdown',
                        render: (_: any, r: PayrollRecord) => {
                          const totalAllowances = (r.fuelAllowance || 0) + (r.phoneAllowance || 0) + (r.otherAllowances || 0);
                          const totalDeductions = (r.violationDeductions || 0) + (r.codPendingHolding || 0);
                          return (
                            <div className="text-xs space-y-0.5">
                              <div>P1 (Vị trí): {r.baseSalaryP1?.toLocaleString()} đ</div>
                              <div>P2 (Sản lượng): <span className="font-semibold text-purple-700">{r.productionSalaryP2?.toLocaleString()} đ</span></div>
                              <div>Phụ cấp: +{totalAllowances.toLocaleString()} đ</div>
                              {totalDeductions > 0 && <div className="text-rose-600">Khấu trừ: -{totalDeductions.toLocaleString()} đ</div>}
                            </div>
                          );
                        },
                      },
                      {
                        title: 'Thực Lĩnh (Net)',
                        dataIndex: 'netSalary',
                        key: 'netSalary',
                        render: (net: number) => (
                          <div className="font-black text-emerald-600 text-base">
                            {net?.toLocaleString()} đ
                          </div>
                        ),
                      },
                      {
                        title: 'Trạng Thái',
                        dataIndex: 'status',
                        key: 'status',
                        render: (st: string) => getPayrollStatusBadge(st),
                      },
                      {
                        title: 'Thao Tác',
                        key: 'action',
                        render: (_: any, r: PayrollRecord) => (
                          <Space size="small">
                            <Button
                              size="small"
                              icon={<Eye size={14} />}
                              onClick={() => {
                                setSelectedPayroll(r);
                                setDetailModalOpen(true);
                              }}
                              className="text-xs rounded-lg"
                            >
                              Xem AI giải trình
                            </Button>
                            {r.status === 'PENDING_ACCOUNTANT_APPROVAL' && (
                              <Button
                                size="small"
                                type="primary"
                                icon={<Send size={14} />}
                                onClick={() => handleApprovePayroll(r)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-xs rounded-lg font-semibold"
                              >
                                Duyệt chi trả
                              </Button>
                            )}
                          </Space>
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

      {/* Modal Từ chối Phiếu Thu / Chi */}
      <Modal
        title="Từ chối phê duyệt phiếu đề xuất"
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectReason('');
          setRejectVoucherId(null);
        }}
        onOk={handleConfirmReject}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy bỏ"
      >
        <div className="space-y-3 pt-2">
          <p className="text-xs text-gray-600">
            Vui lòng nhập lý do từ chối để thông báo đến người lập phiếu và quản lý bưu cục:
          </p>
          <TextArea
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ví dụ: Chưa đính kèm hóa đơn VAT, định mức chi vượt quá hạn mức cho phép..."
          />
        </div>
      </Modal>

      {/* Modal Chi tiết & Giải trình AI Bảng Lương 3P */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800">
            <Sparkles className="text-purple-600" size={20} />
            <span>Chi Tiết Bảng Lương 3P & Báo Cáo Giải Trình AI ({selectedPayroll?.payrollCode})</span>
          </div>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} className="rounded-lg">
            Đóng
          </Button>,
          selectedPayroll?.status === 'PENDING_ACCOUNTANT_APPROVAL' && (
            <Button
              key="approve"
              type="primary"
              icon={<CheckCircle size={15} />}
              onClick={() => {
                if (selectedPayroll) {
                  handleApprovePayroll(selectedPayroll);
                  setDetailModalOpen(false);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold"
            >
              Phê Duyệt & Chi Trả Lương
            </Button>
          ),
        ]}
        width={750}
      >
        {selectedPayroll && (
          <div className="space-y-4 pt-2">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Họ tên nhân viên">{selectedPayroll.employeeName}</Descriptions.Item>
              <Descriptions.Item label="Mã nhân viên (ID)">{selectedPayroll.userId}</Descriptions.Item>
              <Descriptions.Item label="Vai trò">{selectedPayroll.roleName}</Descriptions.Item>
              <Descriptions.Item label="Bưu cục / Hub">{selectedPayroll.warehouseName}</Descriptions.Item>
              <Descriptions.Item label="Kỳ lương">Tháng {selectedPayroll.month}/{selectedPayroll.year}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{getPayrollStatusBadge(selectedPayroll.status)}</Descriptions.Item>
              <Descriptions.Item label="Ngày công chuẩn / Thực tế">
                {selectedPayroll.standardWorkDays} công / <span className="font-bold text-emerald-600">{selectedPayroll.actualWorkDays} công</span>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng giờ làm việc">
                <span className="font-bold text-blue-600">{selectedPayroll.totalWorkHours} giờ (OT: {selectedPayroll.overtimeHours}h)</span>
              </Descriptions.Item>
            </Descriptions>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-800 text-xs mb-2">CHI TIẾT CƠ CẤU LƯƠNG 3P (LOGISTICS STANDARD)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-gray-500">P1 (Vị trí):</div>
                  <div className="font-bold text-gray-800">{selectedPayroll.baseSalaryP1?.toLocaleString()} đ</div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-purple-600 font-semibold">P2 (Sản lượng thực tế):</div>
                  <div className="font-bold text-purple-700">{selectedPayroll.productionSalaryP2?.toLocaleString()} đ</div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-blue-600 font-semibold">P3 (Thưởng KPI SLA):</div>
                  <div className="font-bold text-blue-700">{selectedPayroll.bonusKpiP3?.toLocaleString()} đ</div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-gray-500">Phụ cấp (Xăng/Xe/ĐT):</div>
                  <div className="font-bold text-emerald-600">
                    +{((selectedPayroll.fuelAllowance || 0) + (selectedPayroll.phoneAllowance || 0) + (selectedPayroll.otherAllowances || 0)).toLocaleString()} đ
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-gray-500">Khấu trừ (Phạt/Nợ COD):</div>
                  <div className="font-bold text-rose-600">
                    -{((selectedPayroll.violationDeductions || 0) + (selectedPayroll.codPendingHolding || 0)).toLocaleString()} đ
                  </div>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <div className="text-emerald-800 font-bold">THỰC LĨNH (NET):</div>
                  <div className="font-black text-emerald-700 text-sm">{selectedPayroll.netSalary?.toLocaleString()} đ</div>
                </div>
              </div>
            </div>

            {/* AI Explanation Box */}
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-2">
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs">
                <BrainCircuit size={17} className="text-purple-700" />
                <span>BÁO CÁO GIẢI TRÌNH TÍNH LƯƠNG TỰ ĐỘNG BẰNG AI</span>
              </div>
              <div className="text-xs text-purple-950 whitespace-pre-line leading-relaxed font-mono bg-white p-3 rounded-lg border border-purple-100">
                {selectedPayroll.aiExplanation || 'Chưa có phân tích giải trình từ AI.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
