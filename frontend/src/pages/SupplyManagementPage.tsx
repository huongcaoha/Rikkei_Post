import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Row,
  Col,
  Statistic,
  message,
  Tabs,
  Badge,
  Typography,
  Tooltip,
  Popconfirm,
  Alert,
  Divider
} from 'antd';
import {
  Boxes,
  Package,
  Wrench,
  FileText,
  AlertTriangle,
  Plus,
  RefreshCw,
  MapPin,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Building2,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  ShieldCheck,
  Search
} from 'lucide-react';
import { supplyApi } from '../api/supply';
import { locationApi } from '../api/location';
import { useAuth } from '../context/AuthContext';
import {
  SupplyWarehouse,
  SupplyItem,
  SupplyInventoryDetail,
  SupplyTicket,
  EquipmentRecallTicket,
  SupplyDashboardStats,
  Warehouse
} from '../types';

const { Title, Text } = Typography;

export const SupplyManagementPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN');
  const isInventoryManager = user?.roles?.some(r => ['ROLE_ADMIN', 'ROLE_INVENTORY_MANAGER'].includes(r));
  const isPostOfficeManager = user?.roles?.some(r => ['ROLE_POST_OFFICE_MANAGER', 'ROLE_WAREHOUSE_STAFF'].includes(r));
  const userWarehouseId = user?.assignedPostOfficeId || (user as any)?.warehouseId;
  const userPostOfficeName = user?.postOfficeName || (userWarehouseId ? `Bưu cục ID ${userWarehouseId}` : '');

  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [loading, setLoading] = useState<boolean>(false);

  // Data states
  const [stats, setStats] = useState<SupplyDashboardStats | null>(null);
  const [warehouses, setWarehouses] = useState<SupplyWarehouse[]>([]);
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [inventories, setInventories] = useState<SupplyInventoryDetail[]>([]);
  const [tickets, setTickets] = useState<SupplyTicket[]>([]);
  const [recalls, setRecalls] = useState<EquipmentRecallTicket[]>([]);
  const [postOffices, setPostOffices] = useState<Warehouse[]>([]);

  // Filters
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<number | undefined>(undefined);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedTicketTypeFilter, setSelectedTicketTypeFilter] = useState<string>('ALL');
  const [selectedRecallStatusFilter, setSelectedRecallStatusFilter] = useState<string>('ALL');
  const [keyword, setKeyword] = useState<string>('');

  // Modals
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<SupplyWarehouse | null>(null);
  const [warehouseForm] = Form.useForm();

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplyItem | null>(null);
  const [itemForm] = Form.useForm();

  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<SupplyInventoryDetail | null>(null);
  const [stockForm] = Form.useForm();

  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [ticketForm] = Form.useForm();
  const [ticketTypeVal, setTicketTypeVal] = useState<string>('IMPORT');

  const [isRecallModalOpen, setIsRecallModalOpen] = useState(false);
  const [recallForm] = Form.useForm();

  const [isResolveRecallModalOpen, setIsResolveRecallModalOpen] = useState(false);
  const [resolvingRecall, setResolvingRecall] = useState<EquipmentRecallTicket | null>(null);
  const [resolveForm] = Form.useForm();

  const [selectedTicketDetail, setSelectedTicketDetail] = useState<SupplyTicket | null>(null);
  const [isTicketDetailOpen, setIsTicketDetailOpen] = useState(false);

  // ================= LOAD DATA =================

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [statsRes, whRes, itemsRes, invRes, ticketsRes, recallsRes, poList] = await Promise.all([
        supplyApi.getDashboardStats(),
        supplyApi.getWarehouses(),
        supplyApi.getItems(),
        supplyApi.getInventories({
          warehouseId: selectedWarehouseFilter,
          category: selectedCategoryFilter !== 'ALL' ? selectedCategoryFilter : undefined
        }),
        supplyApi.getTickets({
          ticketType: selectedTicketTypeFilter !== 'ALL' ? selectedTicketTypeFilter : undefined,
          warehouseId: selectedWarehouseFilter
        }),
        supplyApi.getRecalls({
          status: selectedRecallStatusFilter !== 'ALL' ? selectedRecallStatusFilter : undefined,
          postOfficeId: !isAdmin && !isInventoryManager && userWarehouseId ? userWarehouseId : undefined
        }),
        locationApi.getWarehouses()
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (whRes.success) setWarehouses(whRes.data);
      if (itemsRes.success) setItems(itemsRes.data);
      if (invRes.success) setInventories(invRes.data);
      if (ticketsRes.success) setTickets(ticketsRes.data);
      if (recallsRes.success) setRecalls(recallsRes.data);
      if (Array.isArray(poList)) setPostOffices(poList);
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi tải dữ liệu vật tư thiết bị!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [selectedWarehouseFilter, selectedCategoryFilter, selectedTicketTypeFilter, selectedRecallStatusFilter]);

  // ================= KHO VẬT TƯ =================

  const handleOpenCreateWarehouse = () => {
    setEditingWarehouse(null);
    warehouseForm.resetFields();
    warehouseForm.setFieldsValue({
      status: 'ACTIVE',
      code: `KVT_${Date.now().toString().slice(-4)}`,
      managerName: user?.fullName || 'Quản lý kho'
    });
    setIsWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (record: SupplyWarehouse) => {
    setEditingWarehouse(record);
    warehouseForm.setFieldsValue({
      code: record.code,
      name: record.name,
      address: record.address,
      googleMapsUrl: record.googleMapsUrl,
      latitude: record.latitude,
      longitude: record.longitude,
      managerName: record.managerName,
      managerPhone: record.managerPhone,
      status: record.status,
      notes: record.notes
    });
    setIsWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (values: any) => {
    try {
      if (editingWarehouse) {
        await supplyApi.updateWarehouse(editingWarehouse.id, values);
        message.success('Cập nhật kho vật tư thành công!');
      } else {
        await supplyApi.createWarehouse(values);
        message.success('Tạo mới kho vật tư thành công!');
      }
      setIsWarehouseModalOpen(false);
      loadAllData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác không thành công');
    }
  };

  const handleDeleteWarehouse = async (id: number) => {
    try {
      await supplyApi.deleteWarehouse(id);
      message.success('Đã xóa kho vật tư!');
      loadAllData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Không thể xóa kho vật tư');
    }
  };

  // ================= DANH MỤC VẬT TƯ =================

  const handleOpenCreateItem = () => {
    setEditingItem(null);
    itemForm.resetFields();
    itemForm.setFieldsValue({
      category: 'THIET_BI_MAY_MOC',
      unit: 'Chiếc',
      minStockAlert: 5,
      isActive: true,
      itemCode: `VT_${Date.now().toString().slice(-5)}`
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (record: SupplyItem) => {
    setEditingItem(record);
    itemForm.setFieldsValue({
      itemCode: record.itemCode,
      itemName: record.itemName,
      category: record.category,
      unit: record.unit,
      specifications: record.specifications,
      standardPrice: record.standardPrice,
      minStockAlert: record.minStockAlert,
      isActive: record.isActive
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (values: any) => {
    try {
      if (editingItem) {
        await supplyApi.updateItem(editingItem.id, values);
        message.success('Cập nhật danh mục vật tư thành công!');
      } else {
        await supplyApi.createItem(values);
        message.success('Tạo danh mục vật tư mới thành công!');
      }
      setIsItemModalOpen(false);
      loadAllData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Thao tác không thành công');
    }
  };

  // ================= TỒN KHO =================

  const handleOpenUpdateStock = (record: SupplyInventoryDetail) => {
    setEditingStock(record);
    stockForm.setFieldsValue({
      quantity: record.quantity,
      damagedQuantity: record.damagedQuantity
    });
    setIsStockModalOpen(true);
  };

  const handleSaveStock = async (values: any) => {
    if (!editingStock || !editingStock.warehouseId || !editingStock.itemId) return;
    try {
      await supplyApi.updateStock({
        warehouseId: editingStock.warehouseId,
        itemId: editingStock.itemId,
        quantity: values.quantity,
        damagedQuantity: values.damagedQuantity || 0
      });
      message.success('Đã cập nhật số lượng tồn kho thành công!');
      setIsStockModalOpen(false);
      loadAllData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Cập nhật tồn kho thất bại');
    }
  };

  // ================= PHIẾU XUẤT NHẬP =================

  const handleOpenCreateTicket = () => {
    ticketForm.resetFields();
    setTicketTypeVal('IMPORT');
    ticketForm.setFieldsValue({
      ticketType: 'IMPORT',
      warehouseId: warehouses[0]?.id,
      items: [{ itemId: items[0]?.id, quantity: 10 }]
    });
    setIsTicketModalOpen(true);
  };

  const handleSaveTicket = async (values: any) => {
    try {
      const payload = {
        ...values,
        targetPostOfficeName: values.targetPostOfficeId 
          ? postOffices.find(p => p.id === values.targetPostOfficeId)?.name 
          : undefined
      };
      await supplyApi.createTicket(payload);
      message.success('Khởi tạo phiếu thành công! Số lượng tồn kho đã được cập nhật.');
      setIsTicketModalOpen(false);
      loadAllData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Tạo phiếu thất bại');
    }
  };

  // ================= PHIẾU THU HỒI ĐỒ HỎNG =================

  const handleOpenCreateRecall = () => {
    recallForm.resetFields();
    recallForm.setFieldsValue({
      postOfficeId: userWarehouseId || postOffices[0]?.id,
      postOfficeName: userPostOfficeName || undefined,
      quantity: 1,
      requesterPhone: user?.phoneNumber || ''
    });
    setIsRecallModalOpen(true);
  };

  const handleSaveRecall = async (values: any) => {
    try {
      const selectedPo = postOffices.find(p => p.id === values.postOfficeId);
      const payload = {
        ...values,
        postOfficeName: selectedPo ? selectedPo.name : userPostOfficeName
      };
      const res = await supplyApi.createRecall(payload);
      message.success(`Đã viết phiếu thu hồi [${res.data.ticketCode}] thành công! Trạng thái: Chờ thu hồi.`);
      setIsRecallModalOpen(false);
      loadAllData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Tạo phiếu thu hồi thất bại');
    }
  };

  const handleOpenResolveRecall = (record: EquipmentRecallTicket) => {
    setResolvingRecall(record);
    resolveForm.resetFields();
    resolveForm.setFieldsValue({
      resolutionNotes: 'Đã cử tài xế xe tải đến tiếp nhận thu hồi máy móc về kho tổng để bảo hành/sửa chữa.'
    });
    setIsResolveRecallModalOpen(true);
  };

  const handleSaveResolveRecall = async (values: any) => {
    if (!resolvingRecall) return;
    try {
      await supplyApi.resolveRecall(resolvingRecall.id, values);
      message.success(`Phiếu thu hồi [${resolvingRecall.ticketCode}] đã được chuyển sang trạng thái: ĐÃ THU HỒI.`);
      setIsResolveRecallModalOpen(false);
      loadAllData();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Xử lý thu hồi thất bại');
    }
  };

  // ================= RENDER HELPERS =================

  const renderCategoryTag = (cat: string) => {
    switch (cat) {
      case 'THIET_BI_MAY_MOC':
        return <Tag color="blue" className="font-semibold">🖥️ Thiết bị máy móc</Tag>;
      case 'DUNG_CU_KHO':
        return <Tag color="orange" className="font-semibold">🚜 Dụng cụ kho</Tag>;
      case 'VAT_TU_DONG_GOI':
        return <Tag color="green" className="font-semibold">📦 Vật tư đóng gói</Tag>;
      case 'DONG_PHUC':
        return <Tag color="purple" className="font-semibold">👔 Đồng phục & bảo hộ</Tag>;
      default:
        return <Tag>{cat}</Tag>;
    }
  };

  // ================= COLUMNS =================

  const warehouseColumns = [
    {
      title: 'Mã & Tên Kho Vật Tư',
      key: 'name',
      render: (_: any, r: SupplyWarehouse) => (
        <div>
          <div className="font-bold text-gray-900 flex items-center gap-1.5">
            <Building2 size={16} className="text-purple-600" />
            {r.name}
          </div>
          <div className="text-xs font-mono font-semibold text-purple-700">{r.code}</div>
          {r.notes && <div className="text-xs text-gray-400 mt-0.5">{r.notes}</div>}
        </div>
      )
    },
    {
      title: 'Địa chỉ & Vị trí Google Maps',
      key: 'address',
      render: (_: any, r: SupplyWarehouse) => (
        <div className="text-xs space-y-1">
          <div className="text-gray-700 flex items-center">
            <MapPin size={13} className="mr-1 text-red-500 shrink-0" />
            <span>{r.address}</span>
          </div>
          {r.googleMapsUrl && (
            <a
              href={r.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold"
            >
              <ExternalLink size={12} className="mr-1" /> Mở trên Google Maps
            </a>
          )}
        </div>
      )
    },
    {
      title: 'Người quản lý kho',
      key: 'manager',
      render: (_: any, r: SupplyWarehouse) => (
        <div className="text-sm">
          <div className="font-medium text-gray-800">{r.managerName || 'Chưa gán'}</div>
          <div className="text-xs text-gray-500">{r.managerPhone || 'N/A'}</div>
        </div>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => (
        <Tag color={st === 'ACTIVE' ? 'success' : 'warning'}>
          {st === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng / Bảo dưỡng'}
        </Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, r: SupplyWarehouse) => (
        <Space>
          {isInventoryManager && (
            <Button
              type="text"
              size="small"
              icon={<Edit2 size={14} />}
              onClick={() => handleOpenEditWarehouse(r)}
              className="text-blue-600"
            />
          )}
          {isAdmin && (
            <Popconfirm
              title="Xóa kho vật tư?"
              description="Chỉ được xóa khi tồn kho của kho này bằng 0."
              onConfirm={() => handleDeleteWarehouse(r.id)}
            >
              <Button type="text" size="small" icon={<Trash2 size={14} />} danger />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const itemColumns = [
    {
      title: 'Mã & Tên Vật Tư Thiết Bị',
      key: 'item',
      render: (_: any, r: SupplyItem) => (
        <div>
          <div className="font-bold text-gray-900">{r.itemName}</div>
          <div className="text-xs font-mono font-semibold text-blue-600">{r.itemCode}</div>
          {r.specifications && <div className="text-xs text-gray-400 mt-0.5">{r.specifications}</div>}
        </div>
      )
    },
    {
      title: 'Phân loại',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => renderCategoryTag(cat)
    },
    {
      title: 'Đơn vị tính',
      dataIndex: 'unit',
      key: 'unit',
      render: (u: string) => <Tag color="geekblue">{u}</Tag>
    },
    {
      title: 'Đơn giá chuẩn',
      dataIndex: 'standardPrice',
      key: 'standardPrice',
      render: (p: number) => (
        <span className="font-semibold text-gray-800">
          {p ? Number(p).toLocaleString('vi-VN') + ' đ' : '0 đ'}
        </span>
      )
    },
    {
      title: 'Mức tồn tối thiểu',
      dataIndex: 'minStockAlert',
      key: 'minStockAlert',
      render: (min: number) => <span className="text-xs text-amber-700 font-bold">{min} (Cảnh báo)</span>
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, r: SupplyItem) => (
        isInventoryManager && (
          <Button
            type="link"
            size="small"
            icon={<Edit2 size={14} />}
            onClick={() => handleOpenEditItem(r)}
          >
            Sửa
          </Button>
        )
      )
    }
  ];

  const inventoryColumns = [
    {
      title: 'Vật tư / Trang thiết bị',
      key: 'item',
      render: (_: any, r: SupplyInventoryDetail) => (
        <div>
          <div className="font-bold text-gray-900">{r.itemName}</div>
          <div className="text-xs font-mono text-gray-500">{r.itemCode}</div>
        </div>
      )
    },
    {
      title: 'Kho Lưu Trữ',
      key: 'warehouse',
      render: (_: any, r: SupplyInventoryDetail) => (
        <span className="font-medium text-gray-700">{r.warehouseName || 'Kho Tổng'}</span>
      )
    },
    {
      title: 'Phân loại',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => renderCategoryTag(cat || '')
    },
    {
      title: 'Số lượng Sẵn Sàng',
      key: 'quantity',
      render: (_: any, r: SupplyInventoryDetail) => (
        <div className="flex items-center gap-2">
          <span className={`text-base font-black ${r.isLowStock ? 'text-red-600' : 'text-green-700'}`}>
            {r.quantity} {r.unit}
          </span>
          {r.isLowStock && (
            <Tag color="error" className="text-[11px] font-bold">
              ⚠️ Sắp hết (Tồn &le; {r.minStockAlert})
            </Tag>
          )}
        </div>
      )
    },
    {
      title: 'Thiết bị hỏng/thu hồi',
      dataIndex: 'damagedQuantity',
      key: 'damagedQuantity',
      render: (dq: number, r: SupplyInventoryDetail) => (
        <span className={`font-semibold ${dq > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
          {dq || 0} {r.unit}
        </span>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, r: SupplyInventoryDetail) => (
        isInventoryManager && (
          <Button
            type="primary"
            ghost
            size="small"
            onClick={() => handleOpenUpdateStock(r)}
            className="rounded-lg text-xs"
          >
            Cập nhật tồn
          </Button>
        )
      )
    }
  ];

  const ticketColumns = [
    {
      title: 'Mã Phiếu',
      key: 'ticketCode',
      render: (_: any, r: SupplyTicket) => (
        <div>
          <div className="font-mono font-bold text-blue-700">{r.ticketCode}</div>
          <div className="text-xs text-gray-400">
            {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : ''}
          </div>
        </div>
      )
    },
    {
      title: 'Loại Phiếu',
      dataIndex: 'ticketType',
      key: 'ticketType',
      render: (tp: string) => (
        tp === 'IMPORT' ? (
          <Tag color="green" className="font-bold flex items-center gap-1 w-max">
            <ArrowDownLeft size={13} /> Nhập kho NCC
          </Tag>
        ) : (
          <Tag color="orange" className="font-bold flex items-center gap-1 w-max">
            <ArrowUpRight size={13} /> Xuất cấp phát Bưu cục
          </Tag>
        )
      )
    },
    {
      title: 'Kho Vật Tư',
      key: 'wh',
      render: (_: any, r: SupplyTicket) => r.warehouse?.name || 'Kho Tổng'
    },
    {
      title: 'Đối tác / Bưu cục nhận',
      key: 'target',
      render: (_: any, r: SupplyTicket) => (
        r.ticketType === 'EXPORT' ? (
          <span className="font-semibold text-purple-700">🏢 {r.targetPostOfficeName || `Bưu cục #${r.targetPostOfficeId}`}</span>
        ) : (
          <span className="text-gray-700">🏭 {r.partnerOrSupplier || 'Nhà cung cấp'}</span>
        )
      )
    },
    {
      title: 'Tổng số lượng',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      render: (tq: number) => <span className="font-bold text-gray-900">{tq} cái/bộ</span>
    },
    {
      title: 'Người lập phiếu',
      dataIndex: 'creatorName',
      key: 'creatorName',
      render: (name: string) => <span className="text-xs text-gray-600">{name || 'Quản lý kho'}</span>
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, r: SupplyTicket) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            setSelectedTicketDetail(r);
            setIsTicketDetailOpen(true);
          }}
        >
          Xem chi tiết
        </Button>
      )
    }
  ];

  const recallColumns = [
    {
      title: 'Mã Phiếu',
      key: 'ticketCode',
      render: (_: any, r: EquipmentRecallTicket) => (
        <div>
          <div className="font-mono font-bold text-red-600">{r.ticketCode}</div>
          <div className="text-xs text-gray-400">
            {r.createdAt ? new Date(r.createdAt).toLocaleString('vi-VN') : ''}
          </div>
        </div>
      )
    },
    {
      title: 'Bưu cục báo hỏng',
      key: 'po',
      render: (_: any, r: EquipmentRecallTicket) => (
        <div className="font-semibold text-gray-800 flex items-center gap-1">
          <Building2 size={13} className="text-blue-500" />
          {r.postOfficeName}
        </div>
      )
    },
    {
      title: 'Đồ dùng / Máy móc hỏng',
      key: 'equipment',
      render: (_: any, r: EquipmentRecallTicket) => (
        <div>
          <div className="font-bold text-gray-900">{r.equipmentName}</div>
          {r.serialNumber && (
            <div className="text-xs text-gray-500 font-mono">Seri: {r.serialNumber}</div>
          )}
          <div className="text-xs text-red-700 bg-red-50 p-1.5 rounded mt-1 border border-red-100">
            <span className="font-semibold">Tình trạng:</span> {r.damageDescription}
          </div>
        </div>
      )
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (q: number) => <span className="font-black text-gray-800">{q} chiếc</span>
    },
    {
      title: 'Trạng thái thu hồi',
      dataIndex: 'status',
      key: 'status',
      render: (st: string) => (
        st === 'CHO_THU_HOI' ? (
          <Tag color="warning" className="font-bold flex items-center gap-1 text-xs py-0.5 px-2">
            <Clock size={13} /> Chờ thu hồi
          </Tag>
        ) : (
          <Tag color="success" className="font-bold flex items-center gap-1 text-xs py-0.5 px-2">
            <CheckCircle2 size={13} /> Đã thu hồi
          </Tag>
        )
      )
    },
    {
      title: 'Xử lý thu hồi',
      key: 'resolution',
      render: (_: any, r: EquipmentRecallTicket) => (
        r.status === 'DA_THU_HOI' ? (
          <div className="text-xs text-gray-600">
            <div><span className="font-semibold">Người thu hồi:</span> {r.resolvedByName || 'Quản lý kho'}</div>
            {r.resolvedAt && <div>{new Date(r.resolvedAt).toLocaleString('vi-VN')}</div>}
            {r.resolutionNotes && (
              <div className="text-green-700 italic mt-0.5">&ldquo;{r.resolutionNotes}&rdquo;</div>
            )}
          </div>
        ) : (
          isInventoryManager ? (
            <Button
              type="primary"
              size="small"
              onClick={() => handleOpenResolveRecall(r)}
              className="bg-green-600 hover:bg-green-700 font-semibold text-xs rounded-lg"
            >
              Xác nhận đã thu hồi
            </Button>
          ) : (
            <span className="text-xs text-amber-600 italic">Đang chờ quản lý kho thu hồi</span>
          )
        )
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Boxes className="text-purple-600" size={28} />
            Quản Lý Vật Tư & Trang Thiết Bị Doanh Nghiệp
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Quản lý kho vật tư, kiểm soát tồn kho thiết bị, phiếu xuất/nhập cấp phát và quy trình thu hồi đồ hỏng từ các bưu cục.
          </p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={15} />} onClick={loadAllData} loading={loading}>
            Làm mới
          </Button>

          {/* Nút viết phiếu thu hồi dành cho cả Quản lý bưu cục và Quản lý kho */}
          <Button
            type="primary"
            danger
            icon={<Wrench size={15} />}
            onClick={handleOpenCreateRecall}
            className="font-bold rounded-xl h-10 px-4 shadow-sm"
          >
            + Viết Phiếu Thu Hồi Đồ Hỏng
          </Button>

          {isInventoryManager && (
            <>
              <Button
                type="primary"
                icon={<FileText size={15} />}
                onClick={handleOpenCreateTicket}
                className="bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-10 px-4 shadow-sm"
              >
                + Lập Phiếu Xuất/Nhập
              </Button>
              <Button
                icon={<Plus size={15} />}
                onClick={handleOpenCreateWarehouse}
                className="font-semibold rounded-xl h-10 px-4 border-purple-200 text-purple-700"
              >
                + Thêm Kho Vật Tư
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* KPI Dashboard Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-white p-2">
            <div className="text-gray-500 text-xs font-semibold uppercase">Kho vật tư</div>
            <div className="text-2xl font-black text-purple-700 mt-1">{stats?.totalWarehouses || 0}</div>
            <div className="text-[11px] text-gray-400">Kho tổng & trung chuyển</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-blue-100 shadow-xs bg-blue-50/50 p-2 border">
            <div className="text-blue-700 text-xs font-semibold uppercase">Danh mục vật tư</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{stats?.totalItems || 0}</div>
            <div className="text-[11px] text-blue-600">Loại thiết bị & vật tư</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-green-100 shadow-xs bg-green-50/50 p-2 border">
            <div className="text-green-700 text-xs font-semibold uppercase">Tồn kho sẵn sàng</div>
            <div className="text-2xl font-black text-green-700 mt-1">{stats?.totalInStock || 0}</div>
            <div className="text-[11px] text-green-600">Sẵn sàng cấp phát</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-amber-100 shadow-xs bg-amber-50/50 p-2 border">
            <div className="text-amber-700 text-xs font-semibold uppercase">Phiếu chờ thu hồi</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats?.pendingRecallTickets || 0}</div>
            <div className="text-[11px] text-amber-600">Trạng thái CHO_THU_HOI</div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Card className="rounded-2xl border-gray-100 shadow-xs bg-gray-50/50 p-2 border">
            <div className="text-gray-700 text-xs font-semibold uppercase">Đã thu hồi xong</div>
            <div className="text-2xl font-black text-gray-700 mt-1">{stats?.resolvedRecallTickets || 0}</div>
            <div className="text-[11px] text-gray-500">Đã về kho chờ thanh lý</div>
          </Card>
        </Col>
      </Row>

      {/* Cảnh báo tồn kho thấp nếu có */}
      {stats && stats.lowStockAlerts && stats.lowStockAlerts.length > 0 && (
        <Alert
          message={
            <div className="text-xs text-amber-900">
              <span className="font-bold">Cảnh báo tồn kho thấp ({stats.lowStockAlerts.length} mặt hàng):</span>{' '}
              {stats.lowStockAlerts.map(i => `${i.itemName} (còn ${i.quantity} ${i.unit})`).join(', ')}. Quản lý kho nên lập phiếu nhập hàng bổ sung!
            </div>
          }
          type="warning"
          showIcon
          className="rounded-2xl border-amber-200 bg-amber-50/70"
        />
      )}

      {/* Main Tabs Card */}
      <Card className="shadow-xs border-gray-200 rounded-2xl">
        <Tabs
          activeKey={activeTab}
          onChange={k => setActiveTab(k)}
          items={[
            {
              key: 'DASHBOARD',
              label: <span className="font-bold flex items-center gap-1.5"><Boxes size={16} /> 📊 Tồn Kho & Cảnh Báo</span>,
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        placeholder="Lọc theo Kho vật tư"
                        allowClear
                        value={selectedWarehouseFilter}
                        onChange={setSelectedWarehouseFilter}
                        className="w-64"
                        options={warehouses.map(w => ({ label: `🏢 ${w.name}`, value: w.id }))}
                      />
                      <Select
                        value={selectedCategoryFilter}
                        onChange={setSelectedCategoryFilter}
                        className="w-56"
                        options={[
                          { label: 'Tất cả phân loại', value: 'ALL' },
                          { label: '🖥️ Thiết bị máy móc', value: 'THIET_BI_MAY_MOC' },
                          { label: '🚜 Dụng cụ kho bãi', value: 'DUNG_CU_KHO' },
                          { label: '📦 Vật tư đóng gói', value: 'VAT_TU_DONG_GOI' },
                          { label: '👔 Đồng phục & bảo hộ', value: 'DONG_PHUC' }
                        ]}
                      />
                    </div>
                  </div>

                  <Table
                    dataSource={inventories}
                    columns={inventoryColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    className="rounded-xl overflow-hidden"
                  />
                </div>
              )
            },
            {
              key: 'RECALL_TICKETS',
              label: (
                <span className="font-bold flex items-center gap-1.5 text-amber-700">
                  <Wrench size={16} /> 
                  ⚠️ Phiếu Thu Hồi Đồ Hỏng
                  {stats && stats.pendingRecallTickets > 0 && (
                    <Badge count={stats.pendingRecallTickets} className="ml-1" />
                  )}
                </span>
              ),
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={selectedRecallStatusFilter}
                        onChange={setSelectedRecallStatusFilter}
                        className="w-56"
                        options={[
                          { label: 'Tất cả trạng thái', value: 'ALL' },
                          { label: '⏳ Chờ thu hồi (CHO_THU_HOI)', value: 'CHO_THU_HOI' },
                          { label: '✅ Đã thu hồi (DA_THU_HOI)', value: 'DA_THU_HOI' }
                        ]}
                      />
                    </div>
                    <Button
                      type="primary"
                      danger
                      icon={<Plus size={15} />}
                      onClick={handleOpenCreateRecall}
                      className="rounded-xl font-bold"
                    >
                      + Viết Phiếu Báo Hỏng Cần Thu Hồi
                    </Button>
                  </div>

                  <Table
                    dataSource={recalls}
                    columns={recallColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    className="rounded-xl overflow-hidden"
                  />
                </div>
              )
            },
            {
              key: 'TICKETS',
              label: <span className="font-bold flex items-center gap-1.5"><FileText size={16} /> 📄 Phiếu Xuất - Nhập Kho</span>,
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={selectedTicketTypeFilter}
                        onChange={setSelectedTicketTypeFilter}
                        className="w-48"
                        options={[
                          { label: 'Tất cả loại phiếu', value: 'ALL' },
                          { label: '📥 Nhập kho NCC', value: 'IMPORT' },
                          { label: '📤 Xuất cấp phát Bưu cục', value: 'EXPORT' }
                        ]}
                      />
                      <Select
                        placeholder="Lọc theo Kho"
                        allowClear
                        value={selectedWarehouseFilter}
                        onChange={setSelectedWarehouseFilter}
                        className="w-60"
                        options={warehouses.map(w => ({ label: w.name, value: w.id }))}
                      />
                    </div>
                    {isInventoryManager && (
                      <Button
                        type="primary"
                        icon={<Plus size={15} />}
                        onClick={handleOpenCreateTicket}
                        className="bg-purple-600 hover:bg-purple-700 font-bold rounded-xl"
                      >
                        + Tạo Phiếu Xuất/Nhập
                      </Button>
                    )}
                  </div>

                  <Table
                    dataSource={tickets}
                    columns={ticketColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8, showSizeChanger: true }}
                    className="rounded-xl overflow-hidden"
                  />
                </div>
              )
            },
            {
              key: 'WAREHOUSES',
              label: <span className="font-bold flex items-center gap-1.5"><Building2 size={16} /> 🏢 Danh Sách Kho Vật Tư</span>,
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-500">
                      Mỗi kho vật tư gồm tên kho, địa chỉ, vị trí Google Maps và thông tin người phụ trách kho.
                    </div>
                    {isInventoryManager && (
                      <Button
                        type="primary"
                        icon={<Plus size={15} />}
                        onClick={handleOpenCreateWarehouse}
                        className="bg-purple-600 hover:bg-purple-700 font-bold rounded-xl"
                      >
                        + Thêm Kho Vật Tư Mới
                      </Button>
                    )}
                  </div>

                  <Table
                    dataSource={warehouses}
                    columns={warehouseColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    className="rounded-xl overflow-hidden"
                  />
                </div>
              )
            },
            {
              key: 'ITEMS',
              label: <span className="font-bold flex items-center gap-1.5"><Package size={16} /> 📋 Danh Mục Vật Tư Chuẩn</span>,
              children: (
                <div className="space-y-4 pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-500">
                      Quy chuẩn danh mục thiết bị, máy in đơn, máy quét mã vạch, cân điện tử, bao tải, băng dính và đồng phục.
                    </div>
                    {isInventoryManager && (
                      <Button
                        type="primary"
                        icon={<Plus size={15} />}
                        onClick={handleOpenCreateItem}
                        className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl"
                      >
                        + Thêm Vật Tư Mới
                      </Button>
                    )}
                  </div>

                  <Table
                    dataSource={items}
                    columns={itemColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    className="rounded-xl overflow-hidden"
                  />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* ================= MODAL KHO VẬT TƯ ================= */}
      <Modal
        title={editingWarehouse ? 'Chỉnh sửa Kho Vật Tư' : 'Thêm mới Kho Vật Tư'}
        open={isWarehouseModalOpen}
        onCancel={() => setIsWarehouseModalOpen(false)}
        footer={null}
        destroyOnClose
        width={650}
      >
        <Form form={warehouseForm} layout="vertical" onFinish={handleSaveWarehouse} className="mt-4">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="code" label="Mã kho vật tư" rules={[{ required: true, message: 'Nhập mã kho' }]}>
                <Input placeholder="KVT_HN_01" className="font-mono font-bold" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="name" label="Tên kho vật tư" rules={[{ required: true, message: 'Nhập tên kho' }]}>
                <Input placeholder="Kho Vật Tư & Thiết Bị Tổng Miền Bắc" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="Địa chỉ chi tiết kho" rules={[{ required: true, message: 'Nhập địa chỉ' }]}>
            <Input.TextArea rows={2} placeholder="Số 21 Phố Duy Tân, Dịch Vọng Hậu, Cầu Giấy, Hà Nội" />
          </Form.Item>

          <Form.Item
            name="googleMapsUrl"
            label="Đường dẫn vị trí Google Maps"
            extra="Dán link Google Maps hoặc tọa độ để nhân viên và xe tải dễ dàng định vị khi đến lấy hàng/bàn giao."
          >
            <Input placeholder="https://maps.google.com/?q=21.0313,105.7831" prefix={<MapPin size={15} className="text-red-500" />} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="latitude" label="Tọa độ Vĩ độ (Latitude)">
                <InputNumber className="w-full" placeholder="21.0313" step={0.0001} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="longitude" label="Tọa độ Kinh độ (Longitude)">
                <InputNumber className="w-full" placeholder="105.7831" step={0.0001} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="managerName" label="Họ tên Người quản lý kho" rules={[{ required: true, message: 'Nhập tên quản lý' }]}>
                <Input placeholder="Trần Văn Quản Kho" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="managerPhone" label="SĐT Người quản lý">
                <Input placeholder="0988776655" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Ghi chú thêm">
            <Input.TextArea rows={2} placeholder="Ghi chú về phân vùng phụ trách hoặc giờ nhận thiết bị..." />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={() => setIsWarehouseModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-purple-600 hover:bg-purple-700">
              {editingWarehouse ? 'Lưu thay đổi' : 'Tạo kho vật tư'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ================= MODAL DANH MỤC VẬT TƯ ================= */}
      <Modal
        title={editingItem ? 'Chỉnh sửa Danh Mục Vật Tư' : 'Thêm mới Vật Tư & Thiết Bị'}
        open={isItemModalOpen}
        onCancel={() => setIsItemModalOpen(false)}
        footer={null}
        destroyOnClose
        width={650}
      >
        <Form form={itemForm} layout="vertical" onFinish={handleSaveItem} className="mt-4">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="itemCode" label="Mã vật tư" rules={[{ required: true, message: 'Nhập mã vật tư' }]}>
                <Input placeholder="VT_PRINT_01" className="font-mono font-bold" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="itemName" label="Tên vật tư / Thiết bị" rules={[{ required: true, message: 'Nhập tên vật tư' }]}>
                <Input placeholder="Máy in đơn nhiệt Xprinter XP-420B" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="Phân loại" rules={[{ required: true, message: 'Chọn phân loại' }]}>
                <Select
                  options={[
                    { label: '🖥️ Thiết bị máy móc (Máy in, máy quét, cân điện tử)', value: 'THIET_BI_MAY_MOC' },
                    { label: '🚜 Dụng cụ kho bãi (Xe đẩy, kệ giá, kìm chì)', value: 'DUNG_CU_KHO' },
                    { label: '📦 Vật tư đóng gói (Bao tải dứa, băng dính, nhãn)', value: 'VAT_TU_DONG_GOI' },
                    { label: '👔 Đồng phục & bảo hộ bưu tá', value: 'DONG_PHUC' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Đơn vị tính" rules={[{ required: true, message: 'Nhập đơn vị tính' }]}>
                <Select
                  options={[
                    { label: 'Chiếc / Cái', value: 'Chiếc' },
                    { label: 'Bộ', value: 'Bộ' },
                    { label: 'Bao (Bao tải dứa)', value: 'Bao' },
                    { label: 'Cuộn (Băng dính)', value: 'Cuộn' },
                    { label: 'Hộp / Thùng', value: 'Hộp' }
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="standardPrice" label="Đơn giá định mức (VNĐ)">
                <InputNumber className="w-full" step={1000} placeholder="1850000" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="minStockAlert"
                label="Mức tồn kho tối thiểu cảnh báo"
                rules={[{ required: true, message: 'Nhập mức cảnh báo' }]}
              >
                <InputNumber className="w-full" min={1} placeholder="5" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="specifications" label="Thông số kỹ thuật / Quy cách">
            <Input.TextArea rows={2} placeholder="Kích thước, model, cổng kết nối, công suất..." />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={() => setIsItemModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-blue-600 hover:bg-blue-700">
              {editingItem ? 'Lưu thay đổi' : 'Tạo vật tư'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ================= MODAL CẬP NHẬT TỒN KHO ================= */}
      <Modal
        title={`Cập nhật số lượng tồn kho: ${editingStock?.itemName}`}
        open={isStockModalOpen}
        onCancel={() => setIsStockModalOpen(false)}
        footer={null}
        destroyOnClose
        width={450}
      >
        <div className="mb-4 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-lg border">
          <div><span className="font-semibold text-gray-700">Kho lưu trữ:</span> {editingStock?.warehouseName}</div>
          <div><span className="font-semibold text-gray-700">Đơn vị tính:</span> {editingStock?.unit}</div>
        </div>
        <Form form={stockForm} layout="vertical" onFinish={handleSaveStock}>
          <Form.Item
            name="quantity"
            label="Số lượng tồn kho thực tế sẵn sàng cấp phát"
            rules={[{ required: true, message: 'Nhập số lượng' }]}
          >
            <InputNumber className="w-full" min={0} />
          </Form.Item>

          <Form.Item
            name="damagedQuantity"
            label="Số lượng thiết bị hỏng/lỗi đang lưu giữ tại kho"
          >
            <InputNumber className="w-full" min={0} />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={() => setIsStockModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit">
              Xác nhận cập nhật
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ================= MODAL TẠO PHIẾU XUẤT NHẬP KHO ================= */}
      <Modal
        title="Lập Phiếu Xuất / Nhập Kho Vật Tư"
        open={isTicketModalOpen}
        onCancel={() => setIsTicketModalOpen(false)}
        footer={null}
        destroyOnClose
        width={750}
      >
        <Form form={ticketForm} layout="vertical" onFinish={handleSaveTicket} className="mt-3">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ticketType" label="Loại phiếu" rules={[{ required: true }]}>
                <Select
                  onChange={v => setTicketTypeVal(v)}
                  options={[
                    { label: '📥 Nhập kho (Tăng số lượng tồn từ Nhà cung cấp)', value: 'IMPORT' },
                    { label: '📤 Xuất kho cấp phát (Trừ tồn kho để gửi cho Bưu cục)', value: 'EXPORT' }
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouseId" label="Kho vật tư thực hiện" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select
                  options={warehouses.map(w => ({ label: `🏢 ${w.name}`, value: w.id }))}
                />
              </Form.Item>
            </Col>
          </Row>

          {ticketTypeVal === 'EXPORT' ? (
            <Form.Item
              name="targetPostOfficeId"
              label="Bưu cục / Kho nhận cấp phát vật tư"
              rules={[{ required: true, message: 'Vui lòng chọn bưu cục nhận' }]}
            >
              <Select
                showSearch
                placeholder="Chọn Bưu cục tiếp nhận vật tư"
                filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                options={postOffices.map(p => ({ label: `🏢 ${p.name} (${p.code})`, value: p.id }))}
              />
            </Form.Item>
          ) : (
            <Form.Item name="partnerOrSupplier" label="Đơn vị cung cấp / Nhà sản xuất">
              <Input placeholder="e.g. Công ty TNHH Thiết Bị Rikkei Tech, Nhà phân phối Xprinter" />
            </Form.Item>
          )}

          <Form.Item name="reason" label="Lý do xuất / nhập">
            <Input placeholder="e.g. Nhập lô máy in nhiệt phục vụ mở rộng bưu cục, hoặc Cấp phát 10 bao tải cho Bưu cục Cầu Giấy" />
          </Form.Item>

          <Divider className="my-3 font-semibold text-gray-700 text-xs">
            Danh sách vật tư xuất/nhập
          </Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <div className="space-y-3">
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={12} align="middle">
                    <Col span={12}>
                      <Form.Item
                        {...restField}
                        name={[name, 'itemId']}
                        rules={[{ required: true, message: 'Chọn vật tư' }]}
                        className="mb-0"
                      >
                        <Select
                          showSearch
                          placeholder="Chọn loại vật tư"
                          filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                          options={items.map(i => ({ label: `${i.itemName} (${i.itemCode})`, value: i.id }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        rules={[{ required: true, message: 'Nhập số lượng' }]}
                        className="mb-0"
                      >
                        <InputNumber min={1} placeholder="Số lượng" className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={4}>
                      {fields.length > 1 && (
                        <Button type="text" danger onClick={() => remove(name)}>
                          Xóa
                        </Button>
                      )}
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<Plus size={14} />}>
                  + Thêm mặt hàng vật tư
                </Button>
              </div>
            )}
          </Form.List>

          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button onClick={() => setIsTicketModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-purple-600 hover:bg-purple-700">
              Hoàn tất & Cập nhật tồn kho
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ================= MODAL VIẾT PHIẾU THU HỒI ĐỒ HỎNG ================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-red-600">
            <Wrench size={18} />
            Viết Phiếu Thu Hồi Đồ Dùng, Máy Móc Hỏng
          </div>
        }
        open={isRecallModalOpen}
        onCancel={() => setIsRecallModalOpen(false)}
        footer={null}
        destroyOnClose
        width={650}
      >
        <div className="mb-3 text-xs text-gray-500 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
          ⚠️ Phiếu này sẽ được gửi lên Quản lý kho vật tư với trạng thái <span className="font-bold text-amber-800">CHỜ THU HỒI (CHO_THU_HOI)</span>. Sau khi xe tải hoặc quản lý kho đến nhận đồ hỏng, phiếu sẽ được chuyển sang <span className="font-bold text-green-700">ĐÃ THU HỒI (DA_THU_HOI)</span>.
        </div>

        <Form form={recallForm} layout="vertical" onFinish={handleSaveRecall} className="mt-2">
          <Form.Item
            name="postOfficeId"
            label="Kho / Bưu cục báo hỏng thiết bị"
            rules={[{ required: true, message: 'Vui lòng chọn bưu cục' }]}
          >
            <Select
              disabled={!isAdmin && !isInventoryManager && !!userWarehouseId}
              showSearch
              placeholder="Chọn Bưu cục báo hỏng"
              options={postOffices.map(p => ({ label: `🏢 ${p.name} (${p.code})`, value: p.id }))}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="equipmentName"
                label="Tên đồ dùng / Máy móc hỏng"
                rules={[{ required: true, message: 'Vui lòng nhập tên đồ dùng bị hỏng' }]}
              >
                <Input placeholder="e.g. Máy in đơn nhiệt Xprinter XP-420B bị cháy nguồn" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serialNumber" label="Số seri máy (nếu có)">
                <Input placeholder="e.g. XP420B-CG-9988" font-mono />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="requesterPhone" label="SĐT người báo hỏng">
                <Input placeholder="0987654321" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="damageDescription"
            label="Mô tả chi tiết tình trạng hư hỏng & nguyên nhân"
            rules={[{ required: true, message: 'Vui lòng mô tả chi tiết hư hỏng' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="Mô tả hiện tượng: Cắm nguồn không lên, đầu in bị xước vệt đen, cân bị nhảy số, xe đẩy bị gãy bánh..."
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={() => setIsRecallModalOpen(false)}>Hủy</Button>
            <Button type="primary" danger htmlType="submit">
              Gửi Phiếu Yêu Cầu Thu Hồi
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ================= MODAL XÁC NHẬN ĐÃ THU HỒI ================= */}
      <Modal
        title={`Xác nhận thu hồi: ${resolvingRecall?.ticketCode}`}
        open={isResolveRecallModalOpen}
        onCancel={() => setIsResolveRecallModalOpen(false)}
        footer={null}
        destroyOnClose
        width={500}
      >
        <div className="mb-4 text-xs bg-gray-50 p-3 rounded-lg border space-y-1">
          <div><span className="font-semibold text-gray-700">Thiết bị:</span> {resolvingRecall?.equipmentName}</div>
          <div><span className="font-semibold text-gray-700">Bưu cục gửi:</span> {resolvingRecall?.postOfficeName}</div>
          <div><span className="font-semibold text-gray-700">Mô tả hỏng:</span> {resolvingRecall?.damageDescription}</div>
        </div>

        <Form form={resolveForm} layout="vertical" onFinish={handleSaveResolveRecall}>
          <Form.Item
            name="resolutionNotes"
            label="Hướng xử lý sau khi thu hồi về kho"
            rules={[{ required: true, message: 'Nhập hướng xử lý' }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="e.g. Đã cử xe tải mang về kho tổng, gửi trung tâm bảo hành hãng Xprinter hoặc nhập kho phế liệu chờ thanh lý."
            />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={() => setIsResolveRecallModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" className="bg-green-600 hover:bg-green-700">
              Xác nhận ĐÃ THU HỒI
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ================= MODAL CHI TIẾT PHIẾU XUẤT NHẬP ================= */}
      <Modal
        title={`Chi tiết phiếu: ${selectedTicketDetail?.ticketCode}`}
        open={isTicketDetailOpen}
        onCancel={() => setIsTicketDetailOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsTicketDetailOpen(false)}>
            Đóng
          </Button>
        ]}
        width={650}
      >
        {selectedTicketDetail && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border text-xs">
              <div><span className="font-semibold text-gray-600">Loại phiếu:</span> {selectedTicketDetail.ticketType === 'IMPORT' ? 'Nhập kho NCC' : 'Xuất cấp phát bưu cục'}</div>
              <div><span className="font-semibold text-gray-600">Kho thực hiện:</span> {selectedTicketDetail.warehouse?.name}</div>
              <div><span className="font-semibold text-gray-600">Nơi nhận/NCC:</span> {selectedTicketDetail.targetPostOfficeName || selectedTicketDetail.partnerOrSupplier || 'N/A'}</div>
              <div><span className="font-semibold text-gray-600">Người lập:</span> {selectedTicketDetail.creatorName}</div>
              <div className="col-span-2"><span className="font-semibold text-gray-600">Lý do:</span> {selectedTicketDetail.reason || 'N/A'}</div>
            </div>

            <Table
              dataSource={selectedTicketDetail.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Tên vật tư', dataIndex: 'itemName', key: 'itemName' },
                { title: 'Mã VT', dataIndex: 'itemCode', key: 'itemCode', render: (c: string) => <span className="font-mono">{c}</span> },
                { title: 'ĐVT', dataIndex: 'unit', key: 'unit' },
                { title: 'Số lượng', dataIndex: 'quantity', key: 'quantity', render: (q: number) => <span className="font-bold">{q}</span> },
                { title: 'Đơn giá', dataIndex: 'unitPrice', key: 'unitPrice', render: (p: number) => p ? Number(p).toLocaleString('vi-VN') + ' đ' : '—' }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SupplyManagementPage;
