import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Modal, Tabs, Tag, message, Alert, Row, Col, Space, Badge } from 'antd';
import {
  Scan,
  PackageCheck,
  Building2,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  XCircle,
  PackagePlus,
} from 'lucide-react';
import { shipperApi } from '../api/shipper';
import { Order, ShipperSummary } from '../types';
import { useAuth } from '../context/AuthContext';
import { ContinuousScannerModal } from '../components/ContinuousScannerModal';

export const ShipperPortalPage: React.FC = () => {
  const { user } = useAuth();
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');
  const isPostOfficeManager = userRoles.includes('ROLE_POST_OFFICE_MANAGER');
  const isWarehouseStaff = userRoles.includes('ROLE_WAREHOUSE_STAFF');
  const canInboundWarehouse = isAdmin || isBranchManager || isPostOfficeManager || isWarehouseStaff;

  const [tasks, setTasks] = useState<Order[]>([]);
  const [summary, setSummary] = useState<ShipperSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('PICKUP');

  // Continuous Scanner Modal states
  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [scanMode, setScanMode] = useState<'PICKUP' | 'INBOUND'>('PICKUP');

  const loadTasksAndSummary = async () => {
    setLoading(true);
    try {
      const [taskList, summaryData] = await Promise.all([
        shipperApi.getMyTasks(activeTab),
        shipperApi.getSummary(),
      ]);
      setTasks(taskList);
      setSummary(summaryData);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách nhiệm vụ!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasksAndSummary();

    const handleOrderUpdated = () => {
      loadTasksAndSummary();
    };
    window.addEventListener('rikkei-order-updated', handleOrderUpdated);
    return () => {
      window.removeEventListener('rikkei-order-updated', handleOrderUpdated);
    };
  }, [activeTab]);

  const handleOpenScanner = (mode: 'PICKUP' | 'INBOUND', prefillCode?: string) => {
    setScanMode(mode);
    setIsScanModalOpen(true);
  };

  const handleQuickUpdateStatus = async (trackingCode: string, status: string, note?: string) => {
    try {
      await shipperApi.updateStatus(trackingCode, status, note);
      message.success(`Đã cập nhật trạng thái đơn ${trackingCode} thành ${status}`);
      loadTasksAndSummary();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái!');
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'CREATED':
        return <Tag color="blue">Chờ shipper đến lấy</Tag>;
      case 'PICKED_UP':
        return <Tag color="gold">Đã lấy - Chờ về kho</Tag>;
      case 'AT_SORTING_HUB':
        return <Tag color="cyan">Đã nhập kho bưu cục</Tag>;
      case 'IN_TRANSIT':
        return <Tag color="purple">Đang vận chuyển</Tag>;
      case 'DELIVERING':
        return <Tag color="orange">Đang giao cho khách</Tag>;
      case 'DELIVERED':
        return <Tag color="green">Giao thành công</Tag>;
      case 'DELIVERY_FAILED':
        return <Tag color="red">Giao thất bại</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Scan */}
      <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-red-200 text-xs font-semibold uppercase tracking-wider">
            <Truck size={16} />
            <span>Cổng Tác Nghiệp Bưu Tá Chuyên Nghiệp</span>
          </div>
          <h1 className="text-2xl font-black mt-1">Xin chào, {user?.fullName || 'Bưu tá'}!</h1>
          <p className="text-red-100 text-sm mt-1 max-w-xl">
            Quản lý tuyến đường, nhận đơn lấy hàng tại Shop và quét mã chuyển đổi trạng thái tức thì.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            size="large"
            type="primary"
            icon={<Scan size={20} />}
            onClick={() => handleOpenScanner('PICKUP')}
            className="bg-white text-red-700 hover:bg-gray-100 font-bold border-none h-12 px-6 rounded-xl shadow-md flex items-center"
          >
            Quét mã lấy hàng tại Shop
          </Button>

          {canInboundWarehouse && (
            <Button
              size="large"
              icon={<Building2 size={20} />}
              onClick={() => handleOpenScanner('INBOUND')}
              className="bg-red-800 text-white hover:bg-red-900 border-red-500 font-semibold h-12 px-5 rounded-xl flex items-center"
            >
              Quét nhập kho bưu cục
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-l-4 border-l-blue-500 shadow-xs hover:shadow-md transition">
            <div className="text-gray-500 text-xs font-semibold uppercase">Cần lấy tại Shop</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{summary?.pickupPending ?? 0}</div>
            <div className="text-xs text-blue-600 mt-1 font-medium">Đơn mới gán tuyến</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-l-4 border-l-amber-500 shadow-xs hover:shadow-md transition">
            <div className="text-gray-500 text-xs font-semibold uppercase">Đã lấy chờ về kho</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{summary?.pickedUp ?? 0}</div>
            <div className="text-xs text-amber-600 mt-1 font-medium">Cần quét nhập kho</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-l-4 border-l-orange-500 shadow-xs hover:shadow-md transition">
            <div className="text-gray-500 text-xs font-semibold uppercase">Đang giao phát</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{summary?.delivering ?? 0}</div>
            <div className="text-xs text-orange-600 mt-1 font-medium">Chặng cuối đến khách</div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="rounded-xl border-l-4 border-l-emerald-500 shadow-xs hover:shadow-md transition">
            <div className="text-gray-500 text-xs font-semibold uppercase">Đã phát thành công</div>
            <div className="text-2xl font-black text-gray-900 mt-1">{summary?.delivered ?? 0}</div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">Hoàn tất giao nhận</div>
          </Card>
        </Col>
      </Row>

      {/* Tasks List */}
      <Card className="shadow-xs border-gray-200 rounded-2xl">
        <div className="flex items-center justify-between pb-4 border-b">
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            className="font-bold text-base"
            items={[
              {
                key: 'PICKUP',
                label: (
                  <span className="flex items-center space-x-2">
                    <PackagePlus size={18} />
                    <span>Đơn cần lấy tại Shop ({summary?.pickupPending ?? 0})</span>
                  </span>
                ),
              },
              {
                key: 'DELIVERY',
                label: (
                  <span className="flex items-center space-x-2">
                    <Truck size={18} />
                    <span>Đơn giao cho khách ({summary?.delivering ?? 0})</span>
                  </span>
                ),
              },
            ]}
          />
          <Button
            icon={<RefreshCw size={15} />}
            onClick={loadTasksAndSummary}
            loading={loading}
          >
            Làm mới
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {tasks.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <PackageCheck size={48} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium">Hiện không có đơn hàng nào trong mục này</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 rounded-xl border border-gray-200 hover:border-red-300 transition bg-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-red-600 text-base">{task.trackingCode}</span>
                    {getStatusTag(task.currentStatus)}
                    <Tag color="geekblue" className="font-semibold text-xs">
                      {task.pickupType === 'DOOR_PICKUP' ? 'Lấy tận nơi' : 'Gửi bưu cục'}
                    </Tag>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {/* Thông tin người gửi / Shop */}
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Shop / Người gửi:</div>
                      <div className="font-bold text-gray-800">{task.senderName}</div>
                      <div className="text-xs text-gray-600 flex items-center mt-1">
                        <Phone size={12} className="mr-1 text-blue-500" />
                        <a href={`tel:${task.senderPhone}`} className="text-blue-600 font-medium">
                          {task.senderPhone}
                        </a>
                      </div>
                      <div className="text-xs text-gray-600 flex items-start mt-1">
                        <MapPin size={12} className="mr-1 text-red-500 shrink-0 mt-0.5" />
                        <span>
                          {task.senderAddress}
                          {task.senderWardName ? `, ${task.senderWardName}` : ''}
                        </span>
                      </div>
                    </div>

                    {/* Thông tin người nhận */}
                    <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                      <div className="text-xs font-semibold text-gray-500 uppercase">Người nhận:</div>
                      <div className="font-bold text-gray-800">{task.receiverName}</div>
                      <div className="text-xs text-gray-600 flex items-center mt-1">
                        <Phone size={12} className="mr-1 text-blue-500" />
                        <a href={`tel:${task.receiverPhone}`} className="text-blue-600 font-medium">
                          {task.receiverPhone}
                        </a>
                      </div>
                      <div className="text-xs text-gray-600 flex items-start mt-1">
                        <MapPin size={12} className="mr-1 text-red-500 shrink-0 mt-0.5" />
                        <span>
                          {task.receiverAddress}
                          {task.receiverWardName ? `, ${task.receiverWardName}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 flex items-center space-x-4">
                    <span>Hàng hóa: <strong className="text-gray-700">{task.itemName}</strong></span>
                    <span>COD: <strong className="text-red-600">{(task.codAmount || 0).toLocaleString()} đ</strong></span>
                    <span>Cước: <strong className="text-gray-700">{(task.totalFee || 0).toLocaleString()} đ</strong></span>
                  </div>
                </div>

                {/* Actions per order */}
                <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                  {task.currentStatus === 'CREATED' && (
                    <Button
                      type="primary"
                      icon={<Scan size={16} />}
                      onClick={() => handleOpenScanner('PICKUP', task.trackingCode)}
                      className="bg-red-600 hover:bg-red-700 font-semibold"
                    >
                      Quét nhận tại Shop
                    </Button>
                  )}

                  {task.currentStatus === 'PICKED_UP' && canInboundWarehouse && (
                    <Button
                      type="primary"
                      icon={<Building2 size={16} />}
                      onClick={() => handleOpenScanner('INBOUND', task.trackingCode)}
                      className="bg-amber-600 hover:bg-amber-700 font-semibold"
                    >
                      Quét nhập kho bưu cục
                    </Button>
                  )}

                  {task.currentStatus === 'AT_SORTING_HUB' && (
                    <Button
                      type="primary"
                      icon={<Truck size={16} />}
                      onClick={() => handleQuickUpdateStatus(task.trackingCode, 'DELIVERING')}
                      className="bg-blue-600 hover:bg-blue-700 font-semibold"
                    >
                      Bắt đầu đi phát
                    </Button>
                  )}

                  {task.currentStatus === 'DELIVERING' && (
                    <div className="flex gap-2">
                      <Button
                        type="primary"
                        icon={<CheckCircle2 size={16} />}
                        onClick={() => handleQuickUpdateStatus(task.trackingCode, 'DELIVERED')}
                        className="bg-emerald-600 hover:bg-emerald-700 font-semibold"
                      >
                        Đã giao thành công
                      </Button>
                      <Button
                        danger
                        icon={<XCircle size={16} />}
                        onClick={() => handleQuickUpdateStatus(task.trackingCode, 'DELIVERY_FAILED', 'Khách không nghe máy')}
                      >
                        Thất bại
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Modal Quét Mã Tự Động Cho Bưu Tá & Kho */}
      <ContinuousScannerModal
        open={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        defaultMode={scanMode}
        canInbound={canInboundWarehouse}
        canPickup={true}
        onOrderUpdated={loadTasksAndSummary}
      />
    </div>
  );
};
