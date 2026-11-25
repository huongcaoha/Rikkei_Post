import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  DatePicker,
  Modal,
  message,
  Space,
  Descriptions,
} from 'antd';
import {
  BrainCircuit,
  Coins,
  CheckCircle,
  Eye,
  Send,
  Sparkles,
  Building2,
} from 'lucide-react';
import dayjs from 'dayjs';
import { payrollApi } from '../api/payroll';
import { PayrollRecord } from '../types';
import { useAuth } from '../context/AuthContext';

export const HubPayrollApprovalPage: React.FC = () => {
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());

  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  const warehouseId = user?.assignedPostOfficeId || user?.managedProvinceId;

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await payrollApi.getHubPayrolls(warehouseId, selectedMonth, selectedYear);
      setPayrolls(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setPayrolls([]);
      message.error(err.response?.data?.message || 'Lỗi khi tải bảng kê lương!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  // AI Generate Payroll
  const handleGeneratePayroll = async () => {
    setGenerating(true);
    try {
      const res = await payrollApi.generatePayroll(warehouseId, selectedMonth, selectedYear);
      const list = Array.isArray(res) ? res : [];
      message.success(
        `AI đã tổng hợp dữ liệu chấm công FaceID & sản lượng 3P thành công cho ${list.length} nhân viên!`
      );
      setPayrolls(list);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Tính lương tự động thất bại!');
    } finally {
      setGenerating(false);
    }
  };

  // Manager Approve Payroll
  const handleApprovePayroll = async (record: PayrollRecord) => {
    try {
      await payrollApi.approveByManager(record.id);
      message.success(`Quản lý đã duyệt bảng lương cho ${record.employeeName}. Đã gửi phòng Kế toán!`);
      loadData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Duyệt bảng lương thất bại!');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Tag color="blue" className="font-semibold">AI đã tạo (Chờ duyệt)</Tag>;
      case 'PENDING_MANAGER_APPROVAL':
        return <Tag color="orange" className="font-semibold">Chờ Quản lý duyệt</Tag>;
      case 'PENDING_ACCOUNTANT_APPROVAL':
        return <Tag color="cyan" className="font-semibold">Đã gửi Kế toán duyệt</Tag>;
      case 'PAID':
        return <Tag color="green" className="font-semibold">Đã chuyển khoản trả lương</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Mã Phiếu',
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
          <div className="text-xs text-gray-500 font-mono">
            ID: {r.userId} | {r.roleName?.replace('ROLE_', '')}
          </div>
        </div>
      ),
    },
    {
      title: 'Chấm Công & Sản Lượng (3P)',
      key: 'metrics',
      render: (_: any, r: PayrollRecord) => (
        <div className="text-xs space-y-0.5">
          <div>
            Ngày công: <span className="font-bold text-emerald-700">{r.actualWorkDays} / {r.standardWorkDays}</span>
          </div>
          {r.deliveredOrdersCount > 0 && (
            <div>Đơn giao thành công: <span className="font-bold text-blue-600">{r.deliveredOrdersCount} đơn</span></div>
          )}
          {r.totalTripKm > 0 && (
            <div>Cự ly xe tải: <span className="font-bold text-amber-600">{r.totalTripKm.toFixed(1)} km</span></div>
          )}
          {r.sortedPackagesCount > 0 && (
            <div>Kiện chia chọn: <span className="font-bold text-purple-600">{r.sortedPackagesCount} kiện</span></div>
          )}
        </div>
      ),
    },
    {
      title: 'Cơ Cấu Thu Nhập 3P',
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
        <div className="font-black text-emerald-600 text-sm">
          {net?.toLocaleString()} đ
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
            AI Giải trình
          </Button>

          {(r.status === 'GENERATED' || r.status === 'PENDING_MANAGER_APPROVAL') && (
            <Button
              size="small"
              type="primary"
              icon={<Send size={14} />}
              onClick={() => handleApprovePayroll(r)}
              className="bg-red-600 hover:bg-red-700 text-xs rounded-lg font-semibold"
            >
              Duyệt gửi Kế toán
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
            <Coins className="mr-2 text-red-600" size={28} />
            Bảng Kê Lương 3P & Quản Lý Phê Duyệt Hub
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Sử dụng AI tự động quét dữ liệu chấm công FaceID & sản lượng giao hàng 3P để lập bảng lương tháng
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <DatePicker
            picker="month"
            value={dayjs().year(selectedYear).month(selectedMonth - 1)}
            onChange={(d) => {
              if (d) {
                setSelectedMonth(d.month() + 1);
                setSelectedYear(d.year());
              }
            }}
            format="MM/YYYY"
            allowClear={false}
            className="rounded-xl h-10 font-semibold"
          />

          <Button
            type="primary"
            icon={<Sparkles size={16} />}
            onClick={handleGeneratePayroll}
            loading={generating}
            className="bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-10 px-4 shadow-xs flex items-center"
          >
            Sử Dụng AI Tính Lương Tháng
          </Button>
        </div>
      </div>

      <Card className="shadow-xs border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Building2 size={16} className="text-red-600" />
            <span>Kỳ lương: <span className="font-bold text-gray-800">Tháng {selectedMonth}/{selectedYear}</span></span>
            <span className="text-gray-300">|</span>
            <span>Số nhân viên: <span className="font-bold text-gray-800">{payrolls.length}</span></span>
          </div>

          <Button onClick={loadData} loading={loading} size="small" className="rounded-lg">
            Làm mới danh sách
          </Button>
        </div>

        <Table
          dataSource={Array.isArray(payrolls) ? payrolls : []}
          columns={columns}
          rowKey="id"
          loading={loading || generating}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Modal Chi tiết & Giải trình AI */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800">
            <BrainCircuit className="text-purple-600" size={20} />
            <span>Giải Trình AI Chi Tiết Thu Nhập 3P ({selectedPayroll?.payrollCode})</span>
          </div>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} className="rounded-lg">
            Đóng
          </Button>,
          (selectedPayroll?.status === 'GENERATED' || selectedPayroll?.status === 'PENDING_MANAGER_APPROVAL') && (
            <Button
              key="approve"
              type="primary"
              icon={<Send size={15} />}
              onClick={() => {
                if (selectedPayroll) {
                  handleApprovePayroll(selectedPayroll);
                  setDetailModalOpen(false);
                }
              }}
              className="bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
            >
              Phê Duyệt & Gửi Kế Toán
            </Button>
          ),
        ]}
        width={700}
      >
        {selectedPayroll && (
          <div className="space-y-4 pt-2">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Họ tên nhân viên">{selectedPayroll.employeeName}</Descriptions.Item>
              <Descriptions.Item label="Mã nhân sự (ID)">{selectedPayroll.userId}</Descriptions.Item>
              <Descriptions.Item label="Chức danh">{selectedPayroll.roleName}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{getStatusBadge(selectedPayroll.status)}</Descriptions.Item>
              <Descriptions.Item label="Số ngày công">{selectedPayroll.actualWorkDays} / {selectedPayroll.standardWorkDays} ngày</Descriptions.Item>
              <Descriptions.Item label="Tổng giờ làm">{selectedPayroll.totalWorkHours}h (OT: {selectedPayroll.overtimeHours}h)</Descriptions.Item>
            </Descriptions>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
              <h4 className="font-bold text-gray-800 text-xs mb-2">BÓC TÁCH KHOẢN MỤC THU NHẬP (3P)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-gray-500">P1 Lương vị trí:</div>
                  <div className="font-bold text-gray-800">{selectedPayroll.baseSalaryP1?.toLocaleString()} đ</div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-purple-600 font-semibold">P2 Sản lượng:</div>
                  <div className="font-bold text-purple-700">{selectedPayroll.productionSalaryP2?.toLocaleString()} đ</div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-blue-600 font-semibold">P3 Thưởng KPI:</div>
                  <div className="font-bold text-blue-700">{selectedPayroll.bonusKpiP3?.toLocaleString()} đ</div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-gray-500">Phụ cấp:</div>
                  <div className="font-bold text-emerald-600">
                    +{((selectedPayroll.fuelAllowance || 0) + (selectedPayroll.phoneAllowance || 0) + (selectedPayroll.otherAllowances || 0)).toLocaleString()} đ
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border">
                  <div className="text-gray-500">Khấu trừ:</div>
                  <div className="font-bold text-rose-600">
                    -{((selectedPayroll.violationDeductions || 0) + (selectedPayroll.codPendingHolding || 0)).toLocaleString()} đ
                  </div>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <div className="text-emerald-800 font-bold">Thực lĩnh:</div>
                  <div className="font-black text-emerald-700 text-sm">{selectedPayroll.netSalary?.toLocaleString()} đ</div>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 space-y-2">
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-xs">
                <BrainCircuit size={17} className="text-purple-700" />
                <span>GIẢI TRÌNH CÔNG THỨC VÀ TỶ LỆ CỦA AI LOGISTICS</span>
              </div>
              <div className="text-xs text-purple-950 whitespace-pre-line leading-relaxed font-mono bg-white p-3 rounded-lg border border-purple-100">
                {selectedPayroll.aiExplanation}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
