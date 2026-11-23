import React, { useEffect, useState } from 'react';
import { Button, Spin, message, Card } from 'antd';
import { Printer, ArrowLeft, Eye } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderApi } from '../api/order';
import { Order } from '../types';
import { ThermalLabel } from '../components/ThermalLabel';

export const PrintLabelPage: React.FC = () => {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (trackingCode) {
      fetchOrder(trackingCode);
    }
  }, [trackingCode]);

  const fetchOrder = async (code: string) => {
    setLoading(true);
    try {
      const data = await orderApi.getOrderByTrackingCode(code);
      setOrder(data);
    } catch (err: any) {
      message.error('Không tìm thấy thông tin vận đơn: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Spin size="large" tip="Đang tải mẫu tem in nhiệt..." />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">Không tìm thấy thông tin đơn hàng này.</div>
        <Button onClick={() => navigate('/orders')}>Quay lại danh sách</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar (hidden on print) */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-xs print:hidden">
        <div className="flex items-center space-x-3">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/orders')}>
            Quay lại
          </Button>
          <span className="font-bold text-gray-800">
            Xem & In Tem Nhãn Nhiệt: <span className="font-mono text-red-600">{order.trackingCode}</span>
          </span>
        </div>

        <div className="flex space-x-3">
          <Button
            icon={<Eye size={16} />}
            onClick={() => navigate(`/track/${order.trackingCode}`)}
          >
            Tra cứu hành trình
          </Button>
          <Button
            type="primary"
            icon={<Printer size={16} />}
            onClick={handlePrint}
            className="bg-red-600 hover:bg-red-700 font-bold flex items-center shadow-md rounded-xl"
          >
            In tem ngay (A6 / 100x150mm)
          </Button>
        </div>
      </div>

      {/* Center Label Preview */}
      <div className="flex justify-center py-4 bg-gray-100 rounded-2xl print:bg-white print:p-0">
        <ThermalLabel order={order} />
      </div>
    </div>
  );
};
