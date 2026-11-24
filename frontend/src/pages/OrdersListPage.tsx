import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Input, Select, Space, message, Modal, Form } from 'antd';
import { Printer, Search, PlusCircle, RefreshCw, Eye, Edit3, Scan, Phone, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '../api/order';
import { shipperApi } from '../api/shipper';
import { Order } from '../types';
import { useAuth } from '../context/AuthContext';
import { ContinuousScannerModal } from '../components/ContinuousScannerModal';
import { useOrderWebSocket } from '../hooks/useOrderWebSocket';

export const OrdersListPage: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Trạng thái modal quét mã liên tục không cần xác nhận
  const [quickScannerOpen, setQuickScannerOpen] = useState<boolean>(false);

  // Trạng thái cập nhật trạng thái đơn hàng thủ công
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  const [statusForm] = Form.useForm();

  const navigate = useNavigate();

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('ROLE_ADMIN');
  const isBranchManager = userRoles.includes('ROLE_BRANCH_MANAGER');
  const isPostOfficeManager = userRoles.includes('ROLE_POST_OFFICE_MANAGER');
  const isWarehouseStaff = userRoles.includes('ROLE_WAREHOUSE_STAFF');
  const isShipper = userRoles.includes('ROLE_SHIPPER');
  const isStaffOrAdmin = userRoles.some((r) =>
    ['ROLE_ADMIN', 'ROLE_BRANCH_MANAGER', 'ROLE_POST_OFFICE_MANAGER', 'ROLE_SHIPPER', 'ROLE_WAREHOUSE_STAFF'].includes(r)
  );
  // Chỉ Shop / Khách hàng thuần túy mới được tạo đơn hàng theo chỉ đạo
  const canCreateOrder = userRoles.includes('ROLE_MERCHANT') && !isStaffOrAdmin;
  // Bưu tá và các cấp quản lý bưu cục/kho có quyền cập nhật trạng thái đơn hàng
  const canUpdateStatus = isStaffOrAdmin;
  // Chỉ nhân viên kho hoặc quản lý mới có quyền xác nhận đơn đã nhập kho (AT_SORTING_HUB)
  const canInboundWarehouse = isAdmin || isBranchManager || isPostOfficeManager || isWarehouseStaff;

  useEffect(() => {
    fetchOrders();

    const handleOrderUpdated = () => {
      fetchOrders();
    };
    window.addEventListener('rikkei-order-updated', handleOrderUpdated);
    return () => {
      window.removeEventListener('rikkei-order-updated', handleOrderUpdated);
    };
  }, [page, pageSize, statusFilter]);

  // Lắng nghe cập nhật đơn hàng realtime qua WebSocket
  useOrderWebSocket({
    showNotification: false,
    onEvent: () => {
      fetchOrders();
    },
  });

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getMyOrders(page, pageSize, statusFilter);
      setOrders(res.content);
      setTotal(res.totalElements);
    } catch (err: any) {
      message.error('Không thể tải danh sách đơn hàng: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStatusModal = (order: Order) => {
    setSelectedOrder(order);
    statusForm.resetFields();
    let nextStatus = 'PICKED_UP';
    if (order.currentStatus === 'CREATED') nextStatus = 'PICKED_UP';
    else if (order.currentStatus === 'PICKED_UP') nextStatus = canInboundWarehouse ? 'AT_SORTING_HUB' : 'DELIVERING';
    else if (order.currentStatus === 'AT_SORTING_HUB' || order.currentStatus === 'IN_TRANSIT') nextStatus = 'DELIVERING';
    else if (order.currentStatus === 'DELIVERING') nextStatus = 'DELIVERED';
    statusForm.setFieldsValue({ status: nextStatus, note: '' });
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async (values: any) => {
    if (!selectedOrder) return;
    setUpdatingStatus(true);
    try {
      await shipperApi.updateStatus(selectedOrder.trackingCode, values.status, values.note);
      message.success(`Đã cập nhật trạng thái đơn [${selectedOrder.trackingCode}] thành công!`);
      setStatusModalOpen(false);
      fetchOrders();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái đơn hàng!');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusTag = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      CREATED: { color: 'blue', label: 'Mới tạo' },
      PICKED_UP: { color: 'cyan', label: 'Đã lấy hàng' },
      IN_TRANSIT: { color: 'purple', label: 'Đang luân chuyển' },
      AT_SORTING_HUB: { color: 'geekblue', label: 'Tại Hub khai thác' },
      DELIVERING: { color: 'orange', label: 'Đang phát hàng' },
      DELIVERED: { color: 'green', label: 'Giao thành công' },
      DELIVERY_FAILED: { color: 'red', label: 'Giao thất bại' },
      RETURNING: { color: 'volcano', label: 'Đang hoàn hàng' },
    };
    const s = map[status] || { color: 'default', label: status };
    return <Tag color={s.color}>{s.label}</Tag>;
  };

  const columns = [
    {
      title: 'Mã vận đơn',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      render: (code: string) => (
        <span
          className="font-mono font-bold text-red-600 hover:underline cursor-pointer"
          onClick={() => navigate(`/track/${code}`)}
        >
          {code}
        </span>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('vi-VN'),
    },
    {
      title: 'Người nhận & Địa chỉ',
      key: 'receiver',
      render: (_: any, record: Order) => (
        <div className="max-w-xs">
          <div className="font-bold text-gray-900">{record.receiverName} - <span className="font-mono text-gray-600">{record.receiverPhone}</span></div>
          <div className="text-xs text-gray-500 truncate" title={record.receiverAddress}>
            {record.receiverAddress}
          </div>
        </div>
      ),
    },
    {
      title: 'Hàng hóa / Khối lượng',
      key: 'package',
      render: (_: any, record: Order) => (
        <div>
          <div className="font-medium text-gray-800">{record.itemName}</div>
          <div className="text-xs text-gray-400">
            Thực: {record.actualWeightGram}g | Tính cước: <b>{record.billableWeightGram}g</b>
          </div>
        </div>
      ),
    },
    {
      title: 'Tiền thu hộ (COD)',
      dataIndex: 'codAmount',
      key: 'codAmount',
      render: (val: number) => (
        <span className="font-bold text-red-600">
          {Number(val).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      title: 'Tổng cước',
      dataIndex: 'totalFee',
      key: 'totalFee',
      render: (val: number, record: Order) => (
        <div>
          <div className="font-semibold text-gray-800">{Number(val).toLocaleString('vi-VN')} đ</div>
          <div className="text-[11px] text-gray-400">
            {record.paymentParty === 'SENDER' ? 'Shop trả' : 'Khách trả'}
          </div>
        </div>
      ),
    },
    {
      title: 'Trạng thái & Bưu tá',
      key: 'status',
      render: (_: any, record: Order) => (
        <div className="space-y-1">
          <div>{getStatusTag(record.currentStatus)}</div>
          {record.assignedShipperName && (
            <div className="text-xs text-blue-700 font-semibold">
              Bưu tá: {record.assignedShipperName} ({record.assignedShipperPhone || ''})
            </div>
          )}
          <div className="text-[11px] text-gray-500">
            {record.pickupType === 'DOOR_PICKUP' ? '⚡ Bưu tá đến lấy tại Shop' : '🏢 Shop gửi tại bưu cục'}
          </div>
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Order) => (
        <Space size="small">
          {canUpdateStatus && (
            <Button
              size="small"
              type="primary"
              icon={<RefreshCw size={13} />}
              onClick={() => handleOpenStatusModal(record)}
              className="bg-amber-600 hover:bg-amber-700 border-amber-600 text-xs font-semibold flex items-center"
            >
              Cập nhật trạng thái
            </Button>
          )}
          <Button
            size="small"
            icon={<Printer size={14} />}
            onClick={() => navigate(`/orders/print/${record.trackingCode}`)}
            className="flex items-center text-xs"
          >
            In tem
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<Eye size={14} />}
            onClick={() => navigate(`/track/${record.trackingCode}`)}
            className="flex items-center text-xs"
          >
            Xem
          </Button>
        </Space>
      ),
    },
  ];

  const filteredOrders = orders.filter((o) => {
    if (!searchKeyword.trim()) return true;
    const kw = searchKeyword.toLowerCase();
    return (
      o.trackingCode.toLowerCase().includes(kw) ||
      o.receiverName.toLowerCase().includes(kw) ||
      o.receiverPhone.includes(kw) ||
      o.itemName.toLowerCase().includes(kw)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Quản lý Đơn hàng</h1>
          <p className="text-gray-500 text-sm mt-1">Danh sách bưu gửi, in tem nhãn nhiệt và theo dõi trạng thái.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canInboundWarehouse && (
            <Button
              type="primary"
              icon={<Scan size={16} />}
              onClick={() => setQuickScannerOpen(true)}
              className="bg-red-600 hover:bg-red-700 font-bold flex items-center shadow-xs"
            >
              Quét mã nhập kho
            </Button>
          )}
          {isShipper && !canInboundWarehouse && (
            <Button
              type="primary"
              icon={<Scan size={16} />}
              onClick={() => setQuickScannerOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 font-bold flex items-center shadow-xs"
            >
              Quét mã lấy hàng
            </Button>
          )}
          <Button
            icon={<RefreshCw size={16} />}
            onClick={fetchOrders}
            className="flex items-center"
          >
            Làm mới
          </Button>
          {canCreateOrder && (
            <Button
              type="primary"
              icon={<PlusCircle size={16} />}
              onClick={() => navigate('/orders/create')}
              className="bg-red-600 hover:bg-red-700 font-semibold flex items-center shadow-md rounded-xl"
            >
              Tạo đơn mới
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-2xl border-gray-200 shadow-xs">
        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <Input
            placeholder="Tìm theo mã vận đơn, người nhận, số điện thoại..."
            prefix={<Search size={16} className="text-gray-400 mr-1" />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full md:w-80 rounded-lg"
          />

          <Select
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(0);
            }}
            className="w-full md:w-56"
            options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'CREATED', label: 'Mới tạo' },
              { value: 'PICKED_UP', label: 'Đã lấy hàng' },
              { value: 'IN_TRANSIT', label: 'Đang luân chuyển' },
              { value: 'AT_SORTING_HUB', label: 'Tại Hub chia chọn' },
              { value: 'DELIVERING', label: 'Đang giao hàng' },
              { value: 'DELIVERED', label: 'Giao thành công' },
              { value: 'DELIVERY_FAILED', label: 'Giao thất bại' },
              { value: 'RETURNING', label: 'Đang hoàn hàng' },
            ]}
          />
        </div>

        {/* Desktop View (>= md): Ant Design Table */}
        <div className="hidden md:block">
          <Table
            dataSource={filteredOrders}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page + 1,
              pageSize: pageSize,
              total: total,
              showSizeChanger: true,
              onChange: (p, ps) => {
                setPage(p - 1);
                setPageSize(ps);
              },
            }}
            className="overflow-x-auto"
          />
        </div>

        {/* Mobile View (< md): Touch-Friendly Mobile Order Cards */}
        <div className="block md:hidden space-y-3">
          {loading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Đang tải danh sách đơn hàng...</div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">Không tìm thấy đơn hàng nào phù hợp.</div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div>
                    <span
                      className="font-mono font-bold text-base text-red-600 cursor-pointer"
                      onClick={() => navigate(`/track/${order.trackingCode}`)}
                    >
                      {order.trackingCode}
                    </span>
                    <div className="text-[11px] text-gray-400">
                      {new Date(order.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <div>{getStatusTag(order.currentStatus)}</div>
                </div>

                <div className="text-xs space-y-1.5 text-gray-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-900">{order.receiverName}</div>
                      <div className="text-gray-500 text-[11px] mt-0.5">{order.receiverAddress}</div>
                    </div>
                    {order.receiverPhone && (
                      <a
                        href={`tel:${order.receiverPhone}`}
                        className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 shrink-0 ml-2 shadow-xs"
                      >
                        <Phone size={13} />
                        <span>Gọi</span>
                      </a>
                    )}
                  </div>

                  <div className="bg-gray-50 p-2.5 rounded-xl space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Hàng hóa:</span>
                      <span className="font-semibold text-gray-800">{order.itemName} ({order.billableWeightGram}g)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tiền thu hộ COD:</span>
                      <span className="font-bold text-red-600">{Number(order.codAmount).toLocaleString('vi-VN')} đ</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tổng cước:</span>
                      <span className="font-semibold text-gray-700">{Number(order.totalFee).toLocaleString('vi-VN')} đ ({order.paymentParty === 'SENDER' ? 'Shop trả' : 'Khách trả'})</span>
                    </div>
                  </div>

                  {order.assignedShipperName && (
                    <div className="text-[11px] text-blue-700 font-semibold bg-blue-50/70 p-1.5 rounded-lg">
                      Bưu tá: {order.assignedShipperName} ({order.assignedShipperPhone || ''})
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                  {canUpdateStatus && (
                    <Button
                      size="small"
                      type="primary"
                      onClick={() => handleOpenStatusModal(order)}
                      className="bg-amber-600 hover:bg-amber-700 text-xs font-semibold"
                    >
                      Cập nhật
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => navigate(`/orders/print/${order.trackingCode}`)}
                    className="text-xs"
                  >
                    In tem
                  </Button>
                  <Button
                    size="small"
                    type="default"
                    onClick={() => navigate(`/track/${order.trackingCode}`)}
                    className="text-xs font-semibold text-red-600"
                  >
                    Hành trình
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Phân trang mobile */}
          <div className="flex items-center justify-between pt-3 px-1">
            <span className="text-xs text-gray-500">Tổng: {total} đơn</span>
            <div className="flex space-x-2">
              <Button
                size="small"
                disabled={page <= 0}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </Button>
              <Button
                size="small"
                disabled={(page + 1) * pageSize >= total}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal Cập Nhật Trạng Thái Đơn Hàng Thủ Công Cho Bưu Tá / Quản Lý */}
      <Modal
        title={
          <div className="flex items-center space-x-2 text-base font-bold text-gray-800 border-b pb-3">
            <RefreshCw className="text-red-600" size={18} />
            <span>Cập nhật trạng thái bưu gửi: {selectedOrder?.trackingCode}</span>
          </div>
        }
        open={statusModalOpen}
        onCancel={() => setStatusModalOpen(false)}
        footer={null}
        destroyOnClose
        width={500}
      >
        {selectedOrder && (
          <div className="pt-2 space-y-4">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1">
              <div>Người nhận: <b>{selectedOrder.receiverName}</b> - {selectedOrder.receiverPhone}</div>
              <div>Địa chỉ: {selectedOrder.receiverAddress}{selectedOrder.receiverWardName ? `, ${selectedOrder.receiverWardName}` : ''}</div>
              <div className="flex items-center space-x-2 pt-1">
                <span>Trạng thái hiện tại:</span>
                {getStatusTag(selectedOrder.currentStatus)}
              </div>
            </div>

            <Form form={statusForm} layout="vertical" onFinish={handleSaveStatus}>
              <Form.Item
                name="status"
                label="Trạng thái chuyển tiếp"
                rules={[{ required: true, message: 'Vui lòng chọn trạng thái mới' }]}
              >
                <Select
                  options={[
                    { label: 'Đã lấy hàng từ Shop (PICKED_UP)', value: 'PICKED_UP' },
                    ...(canInboundWarehouse
                      ? [{ label: 'Đã nhập kho bưu cục (AT_SORTING_HUB)', value: 'AT_SORTING_HUB' }]
                      : []),
                    { label: 'Đang trên đường đi phát (DELIVERING)', value: 'DELIVERING' },
                    { label: 'Giao hàng thành công (DELIVERED)', value: 'DELIVERED' },
                    { label: 'Giao hàng thất bại (DELIVERY_FAILED)', value: 'DELIVERY_FAILED' },
                    { label: 'Đang chuyển hoàn về shop (RETURNING)', value: 'RETURNING' },
                  ]}
                />
                {!canInboundWarehouse && (
                  <div className="text-[11px] text-amber-600 mt-1 italic">
                    * Quyền hạn bưu tá: Trạng thái [Đã nhập kho bưu cục] chỉ do Nhân viên kho hoặc Quản lý kho tiếp nhận và xác nhận khi bạn mang hàng về bưu cục.
                  </div>
                )}
              </Form.Item>

              <Form.Item name="note" label="Ghi chú tác nghiệp / Lý do (nếu giao thất bại hoặc hẹn lại)">
                <Input.TextArea rows={3} placeholder="Ví dụ: Đã nhận hàng từ chủ shop / Khách hẹn phát lại buổi chiều..." />
              </Form.Item>

              <div className="flex justify-end space-x-2 pt-3 border-t">
                <Button onClick={() => setStatusModalOpen(false)}>Hủy</Button>
                <Button type="primary" htmlType="submit" loading={updatingStatus} className="bg-red-600 hover:bg-red-700">
                  Xác nhận cập nhật
                </Button>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      {/* Modal Quét Mã Tự Động Cho Kho / Bưu Tá */}
      <ContinuousScannerModal
        open={quickScannerOpen}
        onClose={() => setQuickScannerOpen(false)}
        defaultMode={canInboundWarehouse ? 'INBOUND' : 'PICKUP'}
        canInbound={canInboundWarehouse}
        canPickup={isShipper || isAdmin}
        onOrderUpdated={fetchOrders}
      />
    </div>
  );
};
