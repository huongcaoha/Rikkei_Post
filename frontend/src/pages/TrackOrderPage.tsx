import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Timeline, Tag, Spin, message, Alert } from 'antd';
import { Search, Package, MapPin, Clock, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { orderApi } from '../api/order';
import { Order, OrderTrackingLog } from '../types';

export const TrackOrderPage: React.FC = () => {
  const { trackingCode: paramCode } = useParams<{ trackingCode?: string }>();
  const [searchInput, setSearchInput] = useState<string>(paramCode || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [timeline, setTimeline] = useState<OrderTrackingLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (paramCode) {
      setSearchInput(paramCode);
      handleSearch(paramCode);
    }
  }, [paramCode]);

  const handleSearch = async (codeToSearch?: string) => {
    const code = (codeToSearch || searchInput).trim();
    if (!code) {
      message.warning('Vui lòng nhập mã vận đơn để tra cứu');
      return;
    }

    setLoading(true);
    try {
      const data = await orderApi.trackOrderPublic(code);
      setOrder(data.order);
      setTimeline(data.timeline);
    } catch (err: any) {
      message.error('Không tìm thấy thông tin vận đơn hoặc mã không tồn tại');
      setOrder(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      CREATED: 'blue',
      PICKED_UP: 'cyan',
      IN_TRANSIT: 'purple',
      AT_SORTING_HUB: 'geekblue',
      DELIVERING: 'orange',
      DELIVERED: 'green',
      DELIVERY_FAILED: 'red',
      RETURNING: 'volcano',
    };
    return map[status] || 'default';
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      CREATED: 'Mới tạo đơn',
      PICKED_UP: 'Đã lấy hàng từ Shop',
      IN_TRANSIT: 'Đang vận chuyển luân chuyển',
      AT_SORTING_HUB: 'Đã nhập kho bưu cục',
      DELIVERING: 'Đang đi giao hàng',
      DELIVERED: 'Giao hàng thành công',
      DELIVERY_FAILED: 'Giao hàng thất bại',
      RETURNING: 'Đang chuyển hoàn',
    };
    return map[status] || status;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Search Banner */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 p-5 md:p-8 rounded-2xl md:rounded-3xl text-white shadow-xl">
        <h1 className="text-xl md:text-2xl font-black tracking-tight">Tra Cứu Hành Trình Bưu Gửi</h1>
        <p className="text-xs md:text-sm text-red-100 mt-1 mb-4">
          Cập nhật vị trí bưu kiện, lịch sử chia chọn tại các Hub trung chuyển theo thời gian thực.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            size="large"
            placeholder="Nhập mã vận đơn (VD: RKP261120000001)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={() => handleSearch()}
            className="rounded-xl md:rounded-2xl border-0 font-mono text-gray-900"
          />
          <Button
            size="large"
            onClick={() => handleSearch()}
            className="bg-gray-900 hover:bg-black text-white border-0 font-bold px-8 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg h-11"
          >
            <Search size={18} className="mr-1.5" /> Tra cứu
          </Button>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center">
          <Spin size="large" tip="Đang truy xuất hành trình thời gian thực..." />
        </div>
      )}

      {order && !loading && (
        <div className="space-y-6">
          {/* Order Summary Card */}
          <Card className="rounded-3xl border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-100 gap-3">
              <div>
                <span className="text-xs font-semibold text-gray-400 uppercase">Mã vận đơn bưu chính</span>
                <div className="text-2xl font-black font-mono text-red-600">{order.trackingCode}</div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">Trạng thái:</span>
                <Tag color={getStatusColor(order.currentStatus)} className="text-sm font-bold px-3 py-1 rounded-lg">
                  {order.currentStatus}
                </Tag>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs">
              <div>
                <div className="font-bold text-gray-700 uppercase mb-1">Gửi từ:</div>
                <div className="font-bold text-sm text-gray-900">{order.senderName}</div>
                <div className="text-gray-500 mt-0.5">{order.senderAddress}</div>
              </div>

              <div>
                <div className="font-bold text-red-700 uppercase mb-1">Giao đến:</div>
                <div className="font-bold text-sm text-gray-900">{order.receiverName}</div>
                <div className="text-gray-500 mt-0.5">{order.receiverAddress}</div>
              </div>

              <div className="bg-gray-50 p-3 rounded-2xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Nội dung:</span>
                  <span className="font-semibold text-gray-800">{order.itemName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Trọng lượng tính cước:</span>
                  <span className="font-semibold text-gray-800">{order.billableWeightGram}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tiền thu hộ COD:</span>
                  <span className="font-bold text-red-600">{Number(order.codAmount).toLocaleString('vi-VN')} đ</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Timeline Tracking History Card */}
          <Card
            title={
              <div className="flex items-center space-x-2 text-gray-900 font-bold text-base py-1">
                <Clock size={18} className="text-red-600" />
                <span>Nhật Ký Hành Trình Chi Tiết</span>
              </div>
            }
            className="rounded-3xl border-gray-200 shadow-sm"
          >
            {timeline.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                Đơn hàng mới tạo, chưa có dữ liệu luân chuyển tiếp theo.
              </div>
            ) : (
              <Timeline
                mode="left"
                className="mt-4"
                items={timeline.map((item, index) => ({
                  color: index === 0 ? 'red' : 'gray',
                  label: (
                    <span className="text-xs text-gray-500 font-mono font-medium">
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </span>
                  ),
                  children: (
                    <div className="pb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag color={getStatusColor(item.status)} className="font-bold text-xs px-2.5 py-0.5 rounded-md">
                          {getStatusLabel(item.status)} ({item.status})
                        </Tag>
                        <Tag color="default" className="text-[11px] font-medium text-gray-600 bg-gray-100 border-gray-200">
                          {item.locationName}
                        </Tag>
                      </div>
                      <div className="text-xs text-gray-800 mt-2 p-3 bg-red-50/40 rounded-xl border border-red-100/60 leading-relaxed font-normal">
                        {item.description}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1.5">
                        <span className="font-medium text-gray-500">Người thực hiện:</span>
                        <span className="font-semibold text-gray-700">{item.actorName}</span>
                        <span>• Thiết bị/Kênh: {item.deviceInfo || 'Hệ thống'}</span>
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
