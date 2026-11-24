import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Typography, Space, Tag, message, InputNumber, Input } from 'antd';
import { Banknote, Printer, Check, Coins, Calendar, FileText, ArrowRight } from 'lucide-react';
import dayjs from 'dayjs';
import { CashReconciliationResponse, Order } from '../types';
import { shipperApi } from '../api/shipper';

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
  const [data, setData] = useState<CashReconciliationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>('');
  const [submitAmount, setSubmitAmount] = useState<number>(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const res = await shipperApi.getCashReconciliation(shipperId, today);
      setData(res);
      setSubmitAmount(res.totalCashToSubmit || 0);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải bảng kê nộp tiền!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, shipperId]);

  const handleSubmitCash = async () => {
    setSubmitting(true);
    try {
      await shipperApi.submitCash(submitAmount, notes);
      message.success('Đã nộp tiền mặt COD thành công cho thủ quỹ bưu cục!');
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi nộp tiền!');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const columns = [
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
        <span className="font-bold text-red-600">
          {(amount || 0).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Cước phí (Khách trả)',
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
      title: 'Hình thức',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      render: (method: string) => <Tag color="green">Tiền mặt (CASH)</Tag>,
    },
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      centered
      title={
        <div className="flex items-center space-x-2 text-emerald-700">
          <Banknote size={24} />
          <span className="font-bold text-lg">Bảng Kê Nộp Tiền Mặt COD & Cước Cuối Ca</span>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        {/* Thẻ tóm tắt tiền mặt */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 font-medium">TỔNG TIỀN PHẢI NỘP</div>
            <div className="text-xl font-black text-emerald-700 mt-1">
              {(data?.totalCashToSubmit || 0).toLocaleString('vi-VN')} đ
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Tiền mặt đang giữ</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 font-medium">TIỀN THU HỘ COD</div>
            <div className="text-xl font-black text-red-600 mt-1">
              {(data?.totalCodCollected || 0).toLocaleString('vi-VN')} đ
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">{data?.totalOrdersDelivered || 0} đơn hàng</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 font-medium">CƯỚC THU NGƯỜI NHẬN</div>
            <div className="text-xl font-black text-blue-700 mt-1">
              {(data?.totalFeeCollected || 0).toLocaleString('vi-VN')} đ
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Tiền cước chuyển phát</div>
          </div>
        </div>

        {/* Thông tin nhân sự */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex justify-between items-center text-xs text-gray-700">
          <div>
            Bưu tá nộp: <b className="text-gray-900">{data?.shipperName}</b> (SĐT: {data?.shipperPhone})
          </div>
          <div>
            Ca ngày: <b className="text-blue-700">{data?.shiftDate}</b>
          </div>
        </div>

        {/* Bảng chi tiết đơn hàng */}
        <div>
          <div className="text-xs font-bold text-gray-700 mb-1 flex items-center space-x-1">
            <FileText size={14} className="text-blue-600" />
            <span>Danh sách các đơn hàng thu tiền mặt trong ca ({data?.orders?.length || 0} đơn):</span>
          </div>
          <Table
            dataSource={data?.orders || []}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 5 }}
            loading={loading}
          />
        </div>

        {/* Khung nộp tiền */}
        <div className="bg-yellow-50/70 border border-yellow-200 rounded-xl p-3 space-y-2">
          <div className="text-xs font-bold text-gray-800">Xác nhận nộp tiền về cho Thủ quỹ bưu cục:</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-gray-600 mb-1">Số tiền thực tế bàn giao:</div>
              <InputNumber
                className="w-full font-bold text-base text-emerald-700"
                value={submitAmount}
                onChange={(val) => setSubmitAmount(val || 0)}
                formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(val) => Number(val?.replace(/\$\s?|(,*)/g, '') || 0)}
                addonAfter="đ"
              />
            </div>
            <div>
              <div className="text-[11px] text-gray-600 mb-1">Ghi chú nộp tiền:</div>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ghi chú bàn giao ca..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t">
          <Button
            icon={<Printer size={16} />}
            onClick={handlePrint}
            className="text-xs font-medium"
          >
            In Phiếu Nộp Tiền Cuối Ca
          </Button>
          <Space>
            <Button onClick={onClose}>Đóng</Button>
            <Button
              type="primary"
              loading={submitting}
              onClick={handleSubmitCash}
              icon={<Check size={16} />}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
            >
              Xác Nhận Nộp Tiền Cuối Ca
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
};
