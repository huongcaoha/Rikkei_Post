import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, Typography, Space, Tag, message, Select, Row, Col, Alert } from 'antd';
import { Cpu, Truck, Check, RefreshCw, UserCheck, Sparkles, Navigation } from 'lucide-react';
import { Order } from '../types';
import { shipperApi } from '../api/shipper';

const { Title, Text } = Typography;
const { Option } = Select;

interface SmartDispatchModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  postOfficeId?: number;
}

export const SmartDispatchModal: React.FC<SmartDispatchModalProps> = ({
  visible,
  onClose,
  onSuccess,
  postOfficeId,
}) => {
  const [unassignedOrders, setUnassignedOrders] = useState<Order[]>([]);
  const [shippers, setShippers] = useState<Array<{ id: number; fullName: string; phoneNumber?: string; username: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [dispatchingBatch, setDispatchingBatch] = useState<boolean>(false);
  const [manualShipperMap, setManualShipperMap] = useState<Record<string, number>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const [tasks, shipperList] = await Promise.all([
        shipperApi.getMyTasks('PICKUP_PENDING'),
        shipperApi.getPostOfficeShippers(),
      ]);
      const unassigned = (tasks || []).filter((o) => !o.assignedShipperId);
      setUnassignedOrders(unassigned);
      setShippers(shipperList || []);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải dữ liệu điều phối!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  // Điều phối tự động toàn bộ
  const handleBatchDispatch = async () => {
    setDispatchingBatch(true);
    try {
      const res = await shipperApi.smartDispatchBatch(postOfficeId);
      message.success(res.message || `Đã điều phối thành công ${res.successCount} đơn hàng!`);
      loadData();
      onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi điều phối thông minh!');
    } finally {
      setDispatchingBatch(false);
    }
  };

  // Điều phối từng đơn
  const handleSingleDispatch = async (trackingCode: string) => {
    const manualShipperId = manualShipperMap[trackingCode];
    try {
      await shipperApi.smartDispatch(trackingCode, manualShipperId);
      message.success(`Đã điều phối đơn ${trackingCode} thành công!`);
      loadData();
      onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi điều phối đơn!');
    }
  };

  const columns = [
    {
      title: 'Mã bưu gửi',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      render: (code: string) => <span className="font-mono font-bold text-blue-700">{code}</span>,
    },
    {
      title: 'Địa chỉ lấy hàng (Shop)',
      dataIndex: 'senderAddress',
      key: 'senderAddress',
      render: (addr: string, record: Order) => (
        <div>
          <div className="font-medium text-xs text-gray-800">{record.senderName}</div>
          <div className="text-[11px] text-gray-500 truncate max-w-xs">{addr}</div>
        </div>
      ),
    },
    {
      title: 'Trọng lượng',
      dataIndex: 'billableWeightGram',
      key: 'billableWeightGram',
      render: (gram: number) => <span className="font-bold">{gram} g</span>,
    },
    {
      title: 'Chỉ định Bưu tá hoặc Smart AI',
      key: 'assignAction',
      render: (_: any, record: Order) => (
        <div className="flex items-center space-x-2">
          <Select
            placeholder="Tự động (Smart Dispatch)"
            className="w-48 text-xs"
            allowClear
            size="small"
            value={manualShipperMap[record.trackingCode]}
            onChange={(val) =>
              setManualShipperMap((prev) => ({ ...prev, [record.trackingCode]: val }))
            }
          >
            {shippers.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.fullName} ({s.phoneNumber || s.username})
              </Option>
            ))}
          </Select>
          <Button
            type="primary"
            size="small"
            icon={<Check size={14} />}
            onClick={() => handleSingleDispatch(record.trackingCode)}
            className="bg-blue-600 font-medium text-xs"
          >
            Gán
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={780}
      centered
      title={
        <div className="flex items-center space-x-2 text-indigo-700">
          <Cpu size={24} />
          <span className="font-bold text-lg">Hệ Thống Tự Động Điều Phối Bưu Tá (Smart Dispatch TMS)</span>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <Alert
          message="Thuật toán Tự động Cân bằng Tải trọng & Bán kính Tuyến đường"
          description="Hệ thống quét danh sách bưu tá đang hoạt động trong bưu cục, tính toán tổng tải trọng các đơn hàng hiện có của xe bưu tá, và tự động gán đơn lấy hàng theo phương thức tối ưu nhất."
          type="info"
          showIcon
          icon={<Sparkles size={20} className="text-indigo-600" />}
        />

        {/* Thanh trạng thái */}
        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
          <div>
            <div className="text-xs text-gray-500 font-medium">ĐƠN CHỜ ĐIỀU PHỐI</div>
            <div className="text-xl font-bold text-red-600">
              {unassignedOrders.length} đơn hàng
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">BƯU TÁ SẴN SÀNG</div>
            <div className="text-xl font-bold text-green-600">
              {shippers.length} nhân sự
            </div>
          </div>
          <Button
            type="primary"
            size="large"
            loading={dispatchingBatch}
            disabled={unassignedOrders.length === 0}
            onClick={handleBatchDispatch}
            icon={<Cpu size={18} />}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold px-6"
          >
            Tự Động Điều Phối Toàn Bộ ({unassignedOrders.length})
          </Button>
        </div>

        {/* Bảng đơn hàng chưa gán */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-gray-700">
              Danh sách đơn hàng chưa có bưu tá phụ trách:
            </span>
            <Button
              type="text"
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={loadData}
              className="text-xs text-gray-500"
            >
              Làm mới
            </Button>
          </div>
          <Table
            dataSource={unassignedOrders}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 6 }}
            loading={loading}
          />
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </Modal>
  );
};
