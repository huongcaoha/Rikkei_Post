import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Descriptions, message } from 'antd';
import {
  Coins,
  Sparkles,
  BrainCircuit,
  Eye,
} from 'lucide-react';
import { payrollApi } from '../api/payroll';
import { PayrollRecord } from '../types';

export const MyPayrollPage: React.FC = () => {
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedPayroll, setSelectedPayroll] = useState<PayrollRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await payrollApi.getMyPayrolls();
      setPayrolls(data);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải thông tin phiếu lương!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const latestPayroll = payrolls.length > 0 ? payrolls[0] : null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return <Tag color="blue">AI đã khởi tạo</Tag>;
      case 'PENDING_MANAGER_APPROVAL':
        return <Tag color="orange">Chờ Quản lý duyệt</Tag>;
      case 'PENDING_ACCOUNTANT_APPROVAL':
        return <Tag color="cyan">Chờ Kế toán duyệt</Tag>;
      case 'PAID':
        return <Tag color="green">Đã chuyển khoản nhận lương</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Kỳ Lương',
      key: 'period',
      render: (_: any, r: PayrollRecord) => (
        <div className="font-bold text-gray-800">
          Tháng {r.month}/{r.year}
        </div>
      ),
    },
    {
      title: 'Mã Phiếu',
      dataIndex: 'payrollCode',
      key: 'payrollCode',
      render: (code: string) => <span className="font-mono text-gray-600 text-xs">{code}</span>,
    },
    {
      title: 'Ngày Công',
      key: 'workdays',
      render: (_: any, r: PayrollRecord) => (
        <div className="text-xs">
          <span className="font-bold text-emerald-600">{r.actualWorkDays}</span> / {r.standardWorkDays} ngày
        </div>
      ),
    },
    {
      title: 'Lương Vị Trí (P1)',
      dataIndex: 'baseSalaryP1',
      key: 'baseSalaryP1',
      render: (amt: number) => <span className="text-xs">{amt?.toLocaleString()} đ</span>,
    },
    {
      title: 'Lương Sản Lượng (P2)',
      dataIndex: 'productionSalaryP2',
      key: 'productionSalaryP2',
      render: (amt: number) => <span className="text-xs font-bold text-purple-700">+{amt?.toLocaleString()} đ</span>,
    },
    {
      title: 'Phụ Cấp',
      key: 'allowances',
      render: (_: any, r: PayrollRecord) => {
        const total = (r.fuelAllowance || 0) + (r.phoneAllowance || 0) + (r.otherAllowances || 0);
        return <span className="text-xs text-emerald-600">+{total.toLocaleString()} đ</span>;
      },
    },
    {
      title: 'Khấu Trừ',
      key: 'deductions',
      render: (_: any, r: PayrollRecord) => {
        const total = (r.violationDeductions || 0) + (r.codPendingHolding || 0);
        return <span className="text-xs text-rose-600">-{total.toLocaleString()} đ</span>;
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
        <Button
          size="small"
          icon={<Eye size={14} />}
          onClick={() => {
            setSelectedPayroll(r);
            setDetailModalOpen(true);
          }}
          className="text-xs rounded-lg"
        >
          Xem chi tiết & AI
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center">
          <Coins className="mr-2 text-emerald-600" size={28} />
          Phiếu Lương Của Tôi & Thu Nhập 3P
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Theo dõi thu nhập minh bạch: Lương cơ bản vị trí (P1) + Năng lực sản lượng (P2) + Thưởng hiệu suất KPI (P3)
        </p>
      </div>

      {/* Thẻ tóm tắt kỳ lương gần nhất */}
      {latestPayroll && (
        <Card className="shadow-xs border-emerald-100 bg-gradient-to-br from-emerald-50/50 via-white to-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Kỳ lương mới nhất:</span>
                <Tag color="emerald" className="font-bold">
                  Tháng {latestPayroll.month}/{latestPayroll.year}
                </Tag>
                {getStatusBadge(latestPayroll.status)}
              </div>
              <div className="text-3xl font-black text-emerald-600 mt-2">
                {latestPayroll.netSalary?.toLocaleString()} đ
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Số ngày công chấm công FaceID: <span className="font-bold text-gray-800">{latestPayroll.actualWorkDays} ngày</span> ({latestPayroll.totalWorkHours}h)
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                <div className="text-gray-400">P1 Cứng:</div>
                <div className="font-bold text-gray-800">{latestPayroll.baseSalaryP1?.toLocaleString()} đ</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                <div className="text-purple-600 font-semibold">P2 Sản lượng:</div>
                <div className="font-bold text-purple-700">+{latestPayroll.productionSalaryP2?.toLocaleString()} đ</div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                <div className="text-gray-400">Phụ cấp:</div>
                <div className="font-bold text-emerald-600">
                  +{((latestPayroll.fuelAllowance || 0) + (latestPayroll.phoneAllowance || 0) + (latestPayroll.otherAllowances || 0)).toLocaleString()} đ
                </div>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                <div className="text-gray-400">Khấu trừ:</div>
                <div className="font-bold text-rose-600">
                  -{((latestPayroll.violationDeductions || 0) + (latestPayroll.codPendingHolding || 0)).toLocaleString()} đ
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Lịch sử phiếu lương */}
      <Card title="Lịch Sử Bảng Kê Lương Hàng Tháng" className="shadow-xs border-gray-200">
        <Table
          dataSource={payrolls}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      {/* Modal Chi tiết & Giải trình AI */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800">
            <Sparkles className="text-purple-600" size={20} />
            <span>Chi Tiết Thu Nhập & Giải Trình AI Kỳ Tháng {selectedPayroll?.month}/{selectedPayroll?.year}</span>
          </div>
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)} className="rounded-lg">
            Đóng
          </Button>,
        ]}
        width={680}
      >
        {selectedPayroll && (
          <div className="space-y-4 pt-2">
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Mã bảng lương">{selectedPayroll.payrollCode}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">{getStatusBadge(selectedPayroll.status)}</Descriptions.Item>
              <Descriptions.Item label="Số ngày công">{selectedPayroll.actualWorkDays} / {selectedPayroll.standardWorkDays} ngày</Descriptions.Item>
              <Descriptions.Item label="Tổng giờ làm">{selectedPayroll.totalWorkHours}h (OT: {selectedPayroll.overtimeHours}h)</Descriptions.Item>
              {selectedPayroll.deliveredOrdersCount > 0 && (
                <Descriptions.Item label="Đơn giao thành công">{selectedPayroll.deliveredOrdersCount} đơn</Descriptions.Item>
              )}
              {selectedPayroll.totalTripKm > 0 && (
                <Descriptions.Item label="Cự ly chuyến xe">{selectedPayroll.totalTripKm.toFixed(1)} km</Descriptions.Item>
              )}
            </Descriptions>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs">
              <h4 className="font-bold text-gray-800 mb-2">CHI TIẾT 3P & KHOẢN MỤC THU NHẬP</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                <span>BÁO CÁO GIẢI TRÌNH CỦA TRÍ TUỆ NHÂN TẠO AI</span>
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
