import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Space,
  Tabs,
  Typography,
  message,
  Divider,
  Descriptions,
} from 'antd';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Download,
  Printer,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  CreditCard,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import { billingApi } from '../api/billing';
import { useAuth } from '../context/AuthContext';
import { MerchantWallet, ReconciliationSheet, ReconciliationDetail, WalletTransaction } from '../types';

const { Title, Text } = Typography;

export const BillingReconciliationPage: React.FC = () => {
  const { user } = useAuth();
  const isAdminOrStaff = user?.roles?.some(r =>
    ['ROLE_ADMIN', 'ROLE_BRANCH_MANAGER', 'ROLE_WAREHOUSE_STAFF', 'ROLE_ACCOUNTANT'].includes(r)
  );

  const [activeTab, setActiveTab] = useState<'SHEETS' | 'TRANSACTIONS'>('SHEETS');
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  // Danh sách bảng kê
  const [sheets, setSheets] = useState<ReconciliationSheet[]>([]);
  const [totalSheets, setTotalSheets] = useState(0);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetPage, setSheetPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Lịch sử giao dịch ví
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [totalTx, setTotalTx] = useState(0);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txPage, setTxPage] = useState(1);

  // Modal Chi tiết bảng kê
  const [detailVisible, setDetailVisible] = useState(false);
  const [sheetDetail, setSheetDetail] = useState<ReconciliationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal Tạo bảng kê
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [createSheetForm] = Form.useForm();
  const [submittingSheet, setSubmittingSheet] = useState(false);

  // Modal Rút tiền
  const [withdrawVisible, setWithdrawVisible] = useState(false);
  const [withdrawForm] = Form.useForm();
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  // Modal Cập nhật ngân hàng
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [bankForm] = Form.useForm();
  const [submittingBank, setSubmittingBank] = useState(false);

  // Modal Duyệt thanh toán
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [selectedSheetForApprove, setSelectedSheetForApprove] = useState<ReconciliationSheet | null>(null);
  const [bankTxCode, setBankTxCode] = useState('');
  const [submittingApprove, setSubmittingApprove] = useState(false);

  // Fetch Wallet
  const fetchWallet = async () => {
    try {
      setLoadingWallet(true);
      const res = await billingApi.getWallet();
      if (res.data.data) {
        setWallet(res.data.data);
      }
    } catch (err: any) {
      console.error('Lỗi lấy thông tin ví:', err);
    } finally {
      setLoadingWallet(false);
    }
  };

  // Fetch Sheets
  const fetchSheets = async (page: number = 1, status: string = selectedStatus) => {
    try {
      setLoadingSheets(true);
      const res = await billingApi.getReconciliationSheets({
        page: page - 1,
        size: 10,
        status: status === 'ALL' ? undefined : status,
      });
      if (res.data.data) {
        setSheets(res.data.data.content);
        setTotalSheets(res.data.data.totalElements);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tải danh sách bảng kê');
    } finally {
      setLoadingSheets(false);
    }
  };

  // Fetch Transactions
  const fetchTransactions = async (page: number = 1) => {
    try {
      setLoadingTx(true);
      const res = await billingApi.getWalletTransactions({
        page: page - 1,
        size: 10,
      });
      if (res.data.data) {
        setTransactions(res.data.data.content);
        setTotalTx(res.data.data.totalElements);
      }
    } catch (err: any) {
      message.error('Không thể tải lịch sử giao dịch ví');
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    fetchWallet();
    fetchSheets(1);
    fetchTransactions(1);
  }, []);

  // Mở chi tiết bảng kê
  const handleOpenDetail = async (id: number) => {
    try {
      setDetailVisible(true);
      setLoadingDetail(true);
      const res = await billingApi.getSheetDetail(id);
      if (res.data.data) {
        setSheetDetail(res.data.data);
      }
    } catch (err: any) {
      message.error('Không thể tải chi tiết bảng kê');
      setDetailVisible(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Xử lý tạo bảng kê mới
  const handleCreateSheet = async (values: any) => {
    try {
      setSubmittingSheet(true);
      let startDate: string | undefined;
      let endDate: string | undefined;
      if (values.dateRange && values.dateRange.length === 2) {
        startDate = values.dateRange[0].format('YYYY-MM-DD');
        endDate = values.dateRange[1].format('YYYY-MM-DD');
      }

      const res = await billingApi.createReconciliationSheet({
        merchantId: values.merchantId ? Number(values.merchantId) : undefined,
        startDate,
        endDate,
      });

      message.success(`Tạo Bảng kê Đối soát thành công: ${res.data.data.sheetCode}`);
      setCreateSheetVisible(false);
      createSheetForm.resetFields();
      fetchSheets(1);
      fetchWallet();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể tạo bảng kê đối soát');
    } finally {
      setSubmittingSheet(false);
    }
  };

  // Xử lý rút tiền
  const handleWithdraw = async (values: any) => {
    try {
      setSubmittingWithdraw(true);
      const res = await billingApi.requestWithdrawal({
        amount: values.amount,
        bankName: wallet?.bankName,
        bankAccountNumber: wallet?.bankAccountNumber,
        bankAccountHolder: wallet?.bankAccountHolder,
        notes: values.notes,
      });
      message.success(`Yêu cầu rút tiền thành công! Mã GD: ${res.data.data.transactionCode}`);
      setWithdrawVisible(false);
      withdrawForm.resetFields();
      fetchWallet();
      fetchTransactions(1);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể thực hiện rút tiền');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  // Cập nhật thông tin ngân hàng
  const handleUpdateBank = async (values: any) => {
    try {
      setSubmittingBank(true);
      await billingApi.updateWalletBank(values.bankName, values.bankAccountNumber, values.bankAccountHolder);
      message.success('Cập nhật thông tin tài khoản ngân hàng thành công!');
      setBankModalVisible(false);
      fetchWallet();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi cập nhật tài khoản');
    } finally {
      setSubmittingBank(false);
    }
  };

  // Duyệt thanh toán bảng kê
  const handleApproveSheet = async () => {
    if (!selectedSheetForApprove) return;
    try {
      setSubmittingApprove(true);
      await billingApi.approveAndPayout(selectedSheetForApprove.id, {
        bankTransactionCode: bankTxCode.trim() || undefined,
      });
      message.success(`Đã duyệt chi trả & cộng tiền vào Ví Shop cho bảng kê ${selectedSheetForApprove.sheetCode}`);
      setApproveModalVisible(false);
      setSelectedSheetForApprove(null);
      setBankTxCode('');
      fetchSheets(sheetPage);
      fetchWallet();
      fetchTransactions(1);
      if (detailVisible && sheetDetail?.sheet.id === selectedSheetForApprove.id) {
        handleOpenDetail(selectedSheetForApprove.id);
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể duyệt thanh toán');
    } finally {
      setSubmittingApprove(false);
    }
  };

  // In bảng kê (Print PDF layout)
  const handlePrintSheet = () => {
    window.print();
  };

  // Render Status Tag
  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Tag color="gold" icon={<Clock size={12} className="inline mr-1" />}>Chờ quyết toán</Tag>;
      case 'TRANSFERRED':
      case 'APPROVED':
        return <Tag color="green" icon={<CheckCircle2 size={12} className="inline mr-1" />}>Đã quyết toán</Tag>;
      case 'REJECTED':
        return <Tag color="red" icon={<AlertCircle size={12} className="inline mr-1" />}>Từ chối</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={2} className="!mb-1 flex items-center gap-2">
            <Wallet className="text-red-600" size={28} />
            Đối soát COD Tự động & Quản lý Ví Shop
          </Title>
          <Text type="secondary">
            Theo dõi dòng tiền thu hộ COD, tự động trừ cước phí vận chuyển & bảo hiểm, quyết toán doanh thu minh bạch.
          </Text>
        </div>

        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={() => { fetchWallet(); fetchSheets(sheetPage); fetchTransactions(txPage); }}>
            Làm mới
          </Button>
          <Button
            type="primary"
            className="bg-red-600 hover:bg-red-700"
            icon={<PlusCircle size={16} />}
            onClick={() => setCreateSheetVisible(true)}
          >
            Tạo Bảng kê Đối soát
          </Button>
        </Space>
      </div>

      {/* Wallet Summary Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-green-600 rounded-xl" loading={loadingWallet}>
            <Statistic
              title={<span className="font-medium text-gray-600 flex items-center gap-1.5"><Wallet size={16} className="text-green-600" /> Số dư ví khả dụng (Rút ngay)</span>}
              value={wallet?.availableBalance || 0}
              precision={0}
              formatter={(val) => `${Number(val).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#16a34a', fontWeight: 'bold' }}
            />
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">Miễn phí rút tiền</span>
              <Button
                type="link"
                size="small"
                className="p-0 text-green-700 font-semibold flex items-center gap-1"
                onClick={() => setWithdrawVisible(true)}
                disabled={!wallet || wallet.availableBalance < 50000}
              >
                Rút tiền <ArrowUpRight size={14} />
              </Button>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-amber-500 rounded-xl" loading={loadingWallet}>
            <Statistic
              title={<span className="font-medium text-gray-600 flex items-center gap-1.5"><Clock size={16} className="text-amber-500" /> Tiền COD chờ đối soát</span>}
              value={wallet?.holdingCodBalance || 0}
              precision={0}
              formatter={(val) => `${Number(val).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#d97706', fontWeight: 'bold' }}
            />
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <span>Đơn đã giao thành công</span>
              <span className="text-amber-600 font-medium">Kỳ đối soát T2-T4-T6</span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-blue-600 rounded-xl" loading={loadingWallet}>
            <Statistic
              title={<span className="font-medium text-gray-600 flex items-center gap-1.5"><ArrowDownLeft size={16} className="text-blue-600" /> Tổng tiền đã rút</span>}
              value={wallet?.totalWithdrawn || 0}
              precision={0}
              formatter={(val) => `${Number(val).toLocaleString('vi-VN')} đ`}
              valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
            />
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center justify-between">
              <span>Đã chuyển vào STK</span>
              <span className="text-blue-600 font-medium">An toàn 100%</span>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border-l-4 border-l-purple-600 rounded-xl" loading={loadingWallet}>
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-gray-500 block mb-1">Tài khoản Ngân hàng nhận tiền</span>
                <div className="font-bold text-gray-800 text-base">{wallet?.bankName || 'Chưa thiết lập'}</div>
                <div className="text-xs font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded mt-1 inline-block">
                  {wallet?.bankAccountNumber || '---'}
                </div>
                <div className="text-xs text-gray-600 font-medium mt-1 uppercase">
                  {wallet?.bankAccountHolder || '---'}
                </div>
              </div>
              <Button
                size="small"
                type="text"
                className="text-purple-700 hover:bg-purple-50"
                onClick={() => {
                  bankForm.setFieldsValue({
                    bankName: wallet?.bankName || 'MB Bank',
                    bankAccountNumber: wallet?.bankAccountNumber || '',
                    bankAccountHolder: wallet?.bankAccountHolder || '',
                  });
                  setBankModalVisible(true);
                }}
              >
                Đổi STK
              </Button>
            </div>
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
              key: 'SHEETS',
              label: (
                <span className="flex items-center gap-2 font-medium">
                  <FileText size={16} /> Bảng kê Đối soát COD ({totalSheets})
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Space wrap>
                      <Button
                        type={selectedStatus === 'ALL' ? 'primary' : 'default'}
                        size="small"
                        onClick={() => { setSelectedStatus('ALL'); fetchSheets(1, 'ALL'); }}
                      >
                        Tất cả
                      </Button>
                      <Button
                        type={selectedStatus === 'PENDING' ? 'primary' : 'default'}
                        size="small"
                        onClick={() => { setSelectedStatus('PENDING'); fetchSheets(1, 'PENDING'); }}
                      >
                        Chờ quyết toán
                      </Button>
                      <Button
                        type={selectedStatus === 'TRANSFERRED' ? 'primary' : 'default'}
                        size="small"
                        onClick={() => { setSelectedStatus('TRANSFERRED'); fetchSheets(1, 'TRANSFERRED'); }}
                      >
                        Đã quyết toán
                      </Button>
                    </Space>
                  </div>

                  <Table
                    dataSource={sheets}
                    rowKey="id"
                    loading={loadingSheets}
                    pagination={{
                      current: sheetPage,
                      total: totalSheets,
                      pageSize: 10,
                      onChange: (p) => {
                        setSheetPage(p);
                        fetchSheets(p);
                      },
                    }}
                    columns={[
                      {
                        title: 'Mã Bảng kê',
                        dataIndex: 'sheetCode',
                        key: 'sheetCode',
                        render: (text) => <span className="font-mono font-bold text-red-600">{text}</span>,
                      },
                      {
                        title: 'Kỳ đối soát',
                        key: 'period',
                        render: (_, r) => (
                          <span className="text-xs text-gray-600">
                            {r.startDate} ➔ {r.endDate}
                          </span>
                        ),
                      },
                      {
                        title: 'Số đơn',
                        dataIndex: 'totalOrders',
                        key: 'totalOrders',
                        align: 'center',
                        render: (val) => <Tag color="blue">{val} đơn</Tag>,
                      },
                      {
                        title: 'Tổng COD',
                        dataIndex: 'totalCod',
                        key: 'totalCod',
                        align: 'right',
                        render: (val) => <span className="font-medium">{Number(val).toLocaleString('vi-VN')} đ</span>,
                      },
                      {
                        title: 'Cước vận chuyển',
                        dataIndex: 'totalShippingFee',
                        key: 'totalShippingFee',
                        align: 'right',
                        render: (val) => <span className="text-red-500">-{Number(val).toLocaleString('vi-VN')} đ</span>,
                      },
                      {
                        title: 'Thực nhận (Net Payout)',
                        dataIndex: 'netPayout',
                        key: 'netPayout',
                        align: 'right',
                        render: (val) => (
                          <span className="font-bold text-green-700 text-sm">
                            {Number(val).toLocaleString('vi-VN')} đ
                          </span>
                        ),
                      },
                      {
                        title: 'Trạng thái',
                        dataIndex: 'status',
                        key: 'status',
                        align: 'center',
                        render: (val) => renderStatusTag(val),
                      },
                      {
                        title: 'Thao tác',
                        key: 'action',
                        align: 'center',
                        render: (_, record) => (
                          <Space size="middle">
                            <Button
                              type="link"
                              size="small"
                              onClick={() => handleOpenDetail(record.id)}
                            >
                              Chi tiết
                            </Button>
                            {isAdminOrStaff && record.status === 'PENDING' && (
                              <Button
                                type="primary"
                                size="small"
                                className="bg-green-600 hover:bg-green-700 text-xs"
                                onClick={() => {
                                  setSelectedSheetForApprove(record);
                                  setBankTxCode('TX-' + Date.now());
                                  setApproveModalVisible(true);
                                }}
                              >
                                Duyệt chi
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
            {
              key: 'TRANSACTIONS',
              label: (
                <span className="flex items-center gap-2 font-medium">
                  <CreditCard size={16} /> Biến động Số dư Ví ({totalTx})
                </span>
              ),
              children: (
                <div className="pt-2">
                  <Table
                    dataSource={transactions}
                    rowKey="id"
                    loading={loadingTx}
                    pagination={{
                      current: txPage,
                      total: totalTx,
                      pageSize: 10,
                      onChange: (p) => {
                        setTxPage(p);
                        fetchTransactions(p);
                      },
                    }}
                    columns={[
                      {
                        title: 'Mã GD',
                        dataIndex: 'transactionCode',
                        key: 'transactionCode',
                        render: (text) => <span className="font-mono text-xs">{text}</span>,
                      },
                      {
                        title: 'Loại GD',
                        dataIndex: 'transactionType',
                        key: 'transactionType',
                        render: (type) => {
                          if (type === 'COD_PAYOUT') return <Tag color="green">Cộng tiền COD</Tag>;
                          if (type === 'WITHDRAWAL') return <Tag color="volcano">Rút tiền về NH</Tag>;
                          if (type === 'FEE_DEDUCTION') return <Tag color="orange">Trừ phí</Tag>;
                          return <Tag color="blue">{type}</Tag>;
                        },
                      },
                      {
                        title: 'Số tiền biến động',
                        key: 'amount',
                        align: 'right',
                        render: (_, r) => {
                          const isPlus = r.transactionType === 'COD_PAYOUT' || r.transactionType === 'DEPOSIT';
                          return (
                            <span className={`font-bold ${isPlus ? 'text-green-600' : 'text-red-600'}`}>
                              {isPlus ? '+' : '-'}{Number(r.amount).toLocaleString('vi-VN')} đ
                            </span>
                          );
                        },
                      },
                      {
                        title: 'Số dư sau GD',
                        dataIndex: 'balanceAfter',
                        key: 'balanceAfter',
                        align: 'right',
                        render: (val) => <span className="font-semibold text-gray-800">{Number(val).toLocaleString('vi-VN')} đ</span>,
                      },
                      {
                        title: 'Mã tham chiếu',
                        dataIndex: 'referenceCode',
                        key: 'referenceCode',
                        render: (val) => <span className="font-mono text-xs text-gray-500">{val || '---'}</span>,
                      },
                      {
                        title: 'Nội dung',
                        dataIndex: 'description',
                        key: 'description',
                        render: (text) => <span className="text-xs text-gray-600">{text}</span>,
                      },
                      {
                        title: 'Thời gian',
                        dataIndex: 'createdAt',
                        key: 'createdAt',
                        render: (text) => <span className="text-xs text-gray-500">{text ? new Date(text).toLocaleString('vi-VN') : '---'}</span>,
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Chi tiết Bảng kê */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-8">
            <span className="flex items-center gap-2">
              <FileText className="text-red-600" />
              Chi tiết Bảng kê: {sheetDetail?.sheet.sheetCode}
            </span>
            {sheetDetail?.sheet.status && renderStatusTag(sheetDetail.sheet.status)}
          </div>
        }
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={950}
        footer={[
          <Button key="close" onClick={() => setDetailVisible(false)}>
            Đóng
          </Button>,
          sheetDetail && (
            <Button
              key="csv"
              icon={<Download size={14} />}
              onClick={() => {
                window.open(billingApi.exportCsvUrl(sheetDetail.sheet.id), '_blank');
              }}
            >
              Xuất CSV/Excel
            </Button>
          ),
          <Button key="print" icon={<Printer size={14} />} onClick={handlePrintSheet}>
            In Bảng kê (PDF)
          </Button>,
          isAdminOrStaff && sheetDetail?.sheet.status === 'PENDING' && (
            <Button
              key="approve"
              type="primary"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setSelectedSheetForApprove(sheetDetail.sheet);
                setBankTxCode('TX-' + Date.now());
                setApproveModalVisible(true);
              }}
            >
              Duyệt thanh toán
            </Button>
          ),
        ]}
      >
        {sheetDetail && (
          <div className="space-y-4 print:p-0">
            {/* Summary details */}
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }}>
              <Descriptions.Item label="Mã bảng kê">
                <span className="font-mono font-bold text-red-600">{sheetDetail.sheet.sheetCode}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Khách hàng/Shop">
                <b>{sheetDetail.sheet.merchantName}</b>
              </Descriptions.Item>
              <Descriptions.Item label="Kỳ đối soát">
                {sheetDetail.sheet.startDate} đến {sheetDetail.sheet.endDate}
              </Descriptions.Item>
              <Descriptions.Item label="Tổng số bưu gửi">
                <Tag color="blue">{sheetDetail.sheet.totalOrders} đơn hàng</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng tiền COD thu hộ">
                <span className="font-bold text-gray-800">{Number(sheetDetail.sheet.totalCod).toLocaleString('vi-VN')} đ</span>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng cước vận chuyển">
                <span className="text-red-500 font-medium">-{Number(sheetDetail.sheet.totalShippingFee).toLocaleString('vi-VN')} đ</span>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng phí bảo hiểm">
                <span className="text-red-500 font-medium">-{Number(sheetDetail.sheet.totalInsuranceFee).toLocaleString('vi-VN')} đ</span>
              </Descriptions.Item>
              <Descriptions.Item label="Thực nhận (Net Payout)" span={2}>
                <span className="text-lg font-bold text-green-700">
                  {Number(sheetDetail.sheet.netPayout).toLocaleString('vi-VN')} đ
                </span>
              </Descriptions.Item>
              {sheetDetail.sheet.bankTransactionCode && (
                <Descriptions.Item label="Mã giao dịch NH" span={3}>
                  <span className="font-mono font-medium text-blue-700">{sheetDetail.sheet.bankTransactionCode}</span>
                  {sheetDetail.sheet.paidAt && <span className="text-xs text-gray-500 ml-2">({new Date(sheetDetail.sheet.paidAt).toLocaleString('vi-VN')})</span>}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider className="!my-3">Danh sách Bưu phẩm trong Kỳ</Divider>

            <Table
              dataSource={sheetDetail.items}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 50,
                  align: 'center',
                  render: (_, __, idx) => idx + 1,
                },
                {
                  title: 'Mã vận đơn',
                  dataIndex: 'trackingCode',
                  key: 'trackingCode',
                  render: (text) => <span className="font-mono font-bold text-blue-600">{text}</span>,
                },
                {
                  title: 'Người nhận',
                  dataIndex: 'receiverName',
                  key: 'receiverName',
                },
                {
                  title: 'Tiền COD',
                  dataIndex: 'codAmount',
                  key: 'codAmount',
                  align: 'right',
                  render: (val) => `${Number(val).toLocaleString('vi-VN')} đ`,
                },
                {
                  title: 'Cước gửi',
                  dataIndex: 'shippingFee',
                  key: 'shippingFee',
                  align: 'right',
                  render: (val) => <span className="text-red-500">-{Number(val).toLocaleString('vi-VN')} đ</span>,
                },
                {
                  title: 'Phí bảo hiểm',
                  dataIndex: 'insuranceFee',
                  key: 'insuranceFee',
                  align: 'right',
                  render: (val) => (val > 0 ? `-${Number(val).toLocaleString('vi-VN')} đ` : '0 đ'),
                },
                {
                  title: 'Thực nhận',
                  dataIndex: 'netAmount',
                  key: 'netAmount',
                  align: 'right',
                  render: (val) => <span className="font-bold text-green-600">{Number(val).toLocaleString('vi-VN')} đ</span>,
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Modal Tạo Bảng kê mới */}
      <Modal
        title="Tạo Bảng kê Đối soát COD mới"
        open={createSheetVisible}
        onCancel={() => setCreateSheetVisible(false)}
        onOk={() => createSheetForm.submit()}
        confirmLoading={submittingSheet}
        okText="Tạo bảng kê ngay"
        okButtonProps={{ className: 'bg-red-600 hover:bg-red-700' }}
      >
        <Form form={createSheetForm} layout="vertical" onFinish={handleCreateSheet}>
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-4 text-xs text-amber-800">
            Hệ thống sẽ tự động quét tất cả các đơn hàng đã ở trạng thái <b>GIAO THÀNH CÔNG (DELIVERED)</b> nhưng chưa từng được đối soát để gom vào một Bảng kê mới.
          </div>

          {isAdminOrStaff && (
            <Form.Item label="Shop / Merchant ID (Bỏ trống để tạo cho tài khoản của bạn)" name="merchantId">
              <Input placeholder="e.g. 1 (Admin/Nhân viên có thể tạo hộ Shop)" />
            </Form.Item>
          )}

          <Form.Item label="Kỳ đối soát (Thời gian giao hàng)" name="dateRange">
            <DatePicker.RangePicker className="w-full" format="DD/MM/YYYY" placeholder={['Từ ngày', 'Đến ngày']} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Yêu cầu Rút tiền */}
      <Modal
        title="Yêu cầu Rút tiền về Ngân hàng"
        open={withdrawVisible}
        onCancel={() => setWithdrawVisible(false)}
        onOk={() => withdrawForm.submit()}
        confirmLoading={submittingWithdraw}
        okText="Xác nhận rút tiền"
        okButtonProps={{ className: 'bg-green-600 hover:bg-green-700' }}
      >
        <Form form={withdrawForm} layout="vertical" onFinish={handleWithdraw}>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-4 text-xs text-blue-800">
            Số dư khả dụng hiện tại: <b>{Number(wallet?.availableBalance || 0).toLocaleString('vi-VN')} đ</b>.<br />
            Tiền sẽ được tự động chuyển về tài khoản: <b>{wallet?.bankName} - {wallet?.bankAccountNumber} ({wallet?.bankAccountHolder})</b>.
          </div>

          <Form.Item
            label="Số tiền muốn rút (VNĐ)"
            name="amount"
            rules={[
              { required: true, message: 'Vui lòng nhập số tiền rút' },
              {
                validator: async (_, value) => {
                  if (value && value < 50000) {
                    throw new Error('Số tiền rút tối thiểu là 50,000 đ');
                  }
                  if (value && wallet && value > wallet.availableBalance) {
                    throw new Error('Số tiền rút vượt quá số dư khả dụng');
                  }
                },
              },
            ]}
          >
            <InputNumber
              className="w-full"
              size="large"
              placeholder="Tối thiểu 50,000 đ"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as any}
            />
          </Form.Item>

          <Form.Item label="Ghi chú rút tiền" name="notes">
            <Input.TextArea placeholder="Nhập ghi chú nếu có (VD: Rút doanh thu tuần...)" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Cập nhật Ngân hàng */}
      <Modal
        title="Cập nhật Tài khoản Ngân hàng nhận tiền"
        open={bankModalVisible}
        onCancel={() => setBankModalVisible(false)}
        onOk={() => bankForm.submit()}
        confirmLoading={submittingBank}
        okText="Lưu thông tin"
      >
        <Form form={bankForm} layout="vertical" onFinish={handleUpdateBank}>
          <Form.Item label="Ngân hàng" name="bankName" rules={[{ required: true, message: 'Chọn hoặc nhập tên ngân hàng' }]}>
            <Input placeholder="e.g. MB Bank, Vietcombank, Techcombank..." />
          </Form.Item>

          <Form.Item label="Số tài khoản ngân hàng" name="bankAccountNumber" rules={[{ required: true, message: 'Nhập số tài khoản' }]}>
            <Input placeholder="e.g. 0987654321" />
          </Form.Item>

          <Form.Item label="Tên chủ tài khoản (Viết in hoa không dấu)" name="bankAccountHolder" rules={[{ required: true, message: 'Nhập tên chủ tài khoản' }]}>
            <Input placeholder="e.g. NGUYEN CONG HUONG" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Duyệt chi trả COD */}
      <Modal
        title="Duyệt chi trả & Cộng tiền vào Ví Shop"
        open={approveModalVisible}
        onCancel={() => setApproveModalVisible(false)}
        onOk={handleApproveSheet}
        confirmLoading={submittingApprove}
        okText="Xác nhận chi trả ngay"
        okButtonProps={{ className: 'bg-green-600 hover:bg-green-700' }}
      >
        {selectedSheetForApprove && (
          <div className="space-y-3">
            <p className="text-sm">
              Bạn đang duyệt quyết toán cho Bảng kê <b>{selectedSheetForApprove.sheetCode}</b>:
            </p>
            <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-sm">
              <div>Tổng tiền bưu tá thu COD: <b>{Number(selectedSheetForApprove.totalCod).toLocaleString('vi-VN')} đ</b></div>
              <div>Cước phí trừ tự động: <b className="text-red-500">-{Number(selectedSheetForApprove.totalShippingFee).toLocaleString('vi-VN')} đ</b></div>
              <div className="text-base font-bold text-green-700 mt-1">
                Số tiền cộng vào Ví Shop: {Number(selectedSheetForApprove.netPayout).toLocaleString('vi-VN')} đ
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">Mã tham chiếu / Mã giao dịch Ngân hàng:</label>
              <Input value={bankTxCode} onChange={(e) => setBankTxCode(e.target.value)} placeholder="e.g. FT2632599812..." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BillingReconciliationPage;
