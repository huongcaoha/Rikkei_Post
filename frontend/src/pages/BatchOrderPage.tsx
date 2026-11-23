import React, { useState } from 'react';
import { Card, Button, Table, Upload, message, Alert, Modal, Tag } from 'antd';
import { UploadCloud, Download, CheckCircle, AlertTriangle, ArrowLeft, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { orderApi } from '../api/order';
import { CreateOrderRequest } from '../types';

export const BatchOrderPage: React.FC = () => {
  const [parsedOrders, setParsedOrders] = useState<CreateOrderRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [resultModalVisible, setResultModalVisible] = useState<boolean>(false);
  const navigate = useNavigate();

  // Tải file mẫu CSV / Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Tên người gửi': 'Shop Thời Trang Trẻ',
        'SĐT gửi': '0912345678',
        'Địa chỉ gửi': 'Số 10 Phố Chùa Bộc, Đống Đa, Hà Nội',
        'Mã tỉnh gửi': 1,
        'Mã huyện gửi': 6,
        'Mã xã gửi': 35,
        'Tên người nhận': 'Trần Văn Nam',
        'SĐT nhận': '0987654321',
        'Địa chỉ nhận': 'Số 25 Phố Nguyễn Huệ, Quận 1, TP.HCM',
        'Mã tỉnh nhận': 79,
        'Mã huyện nhận': 760,
        'Mã xã nhận': 26734,
        'Tên hàng hóa': 'Quần Jean nam',
        'Giá trị hàng': 350000,
        'Trọng lượng (gram)': 600,
        'Dài (cm)': 30,
        'Rộng (cm)': 20,
        'Cao (cm)': 5,
        'Tiền COD': 350000,
        'Bên trả cước (RECEIVER/SENDER)': 'RECEIVER',
        'Gói cước (STANDARD/EXPRESS)': 'STANDARD',
        'Ghi chú': 'Cho xem hàng',
      },
      {
        'Tên người gửi': 'Shop Thời Trang Trẻ',
        'SĐT gửi': '0912345678',
        'Địa chỉ gửi': 'Số 10 Phố Chùa Bộc, Đống Đa, Hà Nội',
        'Mã tỉnh gửi': 1,
        'Mã huyện gửi': 6,
        'Mã xã gửi': 35,
        'Tên người nhận': 'Lê Thị Hoa',
        'SĐT nhận': '0977112233',
        'Địa chỉ nhận': 'Số 12 Đường Hùng Vương, Hải Châu, Đà Nẵng',
        'Mã tỉnh nhận': 48,
        'Mã huyện nhận': 490,
        'Mã xã nhận': 20194,
        'Tên hàng hóa': 'Váy dạ hội nữ',
        'Giá trị hàng': 850000,
        'Trọng lượng (gram)': 400,
        'Dài (cm)': 25,
        'Rộng (cm)': 15,
        'Cao (cm)': 5,
        'Tiền COD': 850000,
        'Bên trả cước (RECEIVER/SENDER)': 'RECEIVER',
        'Gói cước (STANDARD/EXPRESS)': 'EXPRESS',
        'Ghi chú': 'Giao giờ hành chính',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Don_Hang');
    XLSX.writeFile(wb, 'Rikkei_Post_Mau_Tao_Don_Hang_Lo.xlsx');
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        if (!json || json.length === 0) {
          message.warning('File rỗng hoặc không có dữ liệu');
          return;
        }

        const mapped: CreateOrderRequest[] = json.map((row) => ({
          senderName: row['Tên người gửi'] || 'Shop',
          senderPhone: String(row['SĐT gửi'] || ''),
          senderAddress: row['Địa chỉ gửi'] || '',
          senderProvinceId: Number(row['Mã tỉnh gửi']) || 1,
          senderDistrictId: Number(row['Mã huyện gửi']) || 0,
          senderWardId: Number(row['Mã xã gửi']) || 0,
          senderWardName: row['Xã/Phường gửi'] || 'Phường Dịch Vọng Hậu',
          receiverName: row['Tên người nhận'] || '',
          receiverPhone: String(row['SĐT nhận'] || ''),
          receiverAddress: row['Địa chỉ nhận'] || '',
          receiverProvinceId: Number(row['Mã tỉnh nhận']) || 79,
          receiverDistrictId: Number(row['Mã huyện nhận']) || 0,
          receiverWardId: Number(row['Mã xã nhận']) || 0,
          receiverWardName: row['Xã/Phường nhận'] || 'Phường Bến Nghé',
          itemName: row['Tên hàng hóa'] || 'Hàng hóa',
          itemValue: Number(row['Giá trị hàng']) || 0,
          actualWeightGram: Number(row['Trọng lượng (gram)']) || 500,
          lengthCm: Number(row['Dài (cm)']) || 10,
          widthCm: Number(row['Rộng (cm)']) || 10,
          heightCm: Number(row['Cao (cm)']) || 10,
          codAmount: Number(row['Tiền COD']) || 0,
          paymentParty: (row['Bên trả cước (RECEIVER/SENDER)'] || 'RECEIVER').toUpperCase() as any,
          serviceType: (row['Gói cước (STANDARD/EXPRESS)'] || 'STANDARD').toUpperCase() as any,
          notes: row['Ghi chú'] || '',
        }));

        setParsedOrders(mapped);
        message.success(`Đã đọc thành công ${mapped.length} đơn hàng từ file!`);
      } catch (err: any) {
        message.error('Lỗi khi đọc file Excel/CSV: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Ngăn chặn tự động upload HTTP
  };

  const handleBatchSubmit = async () => {
    if (parsedOrders.length === 0) {
      message.warning('Chưa có dữ liệu đơn hàng để tạo');
      return;
    }
    setLoading(true);
    try {
      const res = await orderApi.createBatchOrders(parsedOrders);
      setBatchResult(res);
      setResultModalVisible(true);
      message.success(`Đã tạo thành công ${res.successCount}/${res.totalSubmitted} đơn hàng!`);
    } catch (err: any) {
      message.error('Lỗi khi tạo lô đơn hàng: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'STT',
      render: (_: any, __: any, index: number) => index + 1,
      width: 60,
    },
    {
      title: 'Người nhận',
      dataIndex: 'receiverName',
      key: 'receiverName',
      render: (text: string, record: CreateOrderRequest) => (
        <div>
          <div className="font-bold text-gray-900">{text}</div>
          <div className="text-xs text-gray-500 font-mono">{record.receiverPhone}</div>
        </div>
      ),
    },
    {
      title: 'Địa chỉ nhận',
      dataIndex: 'receiverAddress',
      key: 'receiverAddress',
      ellipsis: true,
    },
    {
      title: 'Hàng hóa',
      dataIndex: 'itemName',
      key: 'itemName',
      render: (text: string, record: CreateOrderRequest) => (
        <div>
          <div>{text}</div>
          <div className="text-xs text-gray-400">{record.actualWeightGram}g</div>
        </div>
      ),
    },
    {
      title: 'Tiền COD',
      dataIndex: 'codAmount',
      key: 'codAmount',
      render: (val: number) => <b>{Number(val).toLocaleString('vi-VN')} đ</b>,
    },
    {
      title: 'Gói cước',
      dataIndex: 'serviceType',
      key: 'serviceType',
      render: (type: string) => <Tag color={type === 'EXPRESS' ? 'orange' : 'blue'}>{type}</Tag>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate('/orders')}>
            Quay lại
          </Button>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tạo Đơn Hàng Theo Lô (Excel / CSV)</h1>
            <p className="text-gray-500 text-sm mt-0.5">Tải lên hàng trăm đơn hàng cùng lúc chỉ với 1 file Excel.</p>
          </div>
        </div>
        <Button
          icon={<Download size={16} />}
          onClick={handleDownloadTemplate}
          className="flex items-center font-semibold"
        >
          Tải file mẫu Excel
        </Button>
      </div>

      <Card className="rounded-2xl border-gray-200 shadow-xs">
        <Upload.Dragger
          name="file"
          accept=".xlsx,.xls,.csv"
          beforeUpload={handleFileUpload}
          showUploadList={false}
          className="p-6 bg-gray-50 rounded-xl"
        >
          <p className="ant-upload-drag-icon flex justify-center text-red-600 mb-2">
            <UploadCloud size={48} />
          </p>
          <p className="text-base font-bold text-gray-800">
            Kéo thả file Excel (.xlsx) hoặc bấm để chọn file từ máy tính
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Hỗ trợ định dạng chuẩn Excel/CSV với đầy đủ cột người gửi, người nhận, tiền COD và trọng lượng.
          </p>
        </Upload.Dragger>

        {parsedOrders.length > 0 && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 text-base">
                Xem trước danh sách ({parsedOrders.length} đơn hàng)
              </span>
              <Button
                type="primary"
                size="large"
                loading={loading}
                icon={<Send size={16} />}
                onClick={handleBatchSubmit}
                className="bg-red-600 hover:bg-red-700 font-bold rounded-xl shadow-md flex items-center"
              >
                Xác nhận tạo {parsedOrders.length} đơn
              </Button>
            </div>

            <Table
              dataSource={parsedOrders}
              columns={columns}
              rowKey={(_, idx) => String(idx)}
              pagination={{ pageSize: 10 }}
              className="overflow-x-auto"
            />
          </div>
        )}
      </Card>

      {/* Result Modal */}
      <Modal
        title="Kết quả Xử lý Lô Đơn hàng"
        open={resultModalVisible}
        onOk={() => {
          setResultModalVisible(false);
          navigate('/orders');
        }}
        onCancel={() => setResultModalVisible(false)}
        okText="Xem danh sách đơn"
        cancelText="Đóng"
        width={650}
      >
        {batchResult && (
          <div className="space-y-4 py-2">
            <Alert
              type={batchResult.failureCount === 0 ? 'success' : 'warning'}
              message={
                <span className="font-bold">
                  Đã tạo thành công {batchResult.successCount} / {batchResult.totalSubmitted} đơn hàng!
                </span>
              }
              showIcon
            />

            {batchResult.errors?.length > 0 && (
              <div>
                <div className="font-bold text-red-600 text-sm mb-1">Các lỗi phát sinh:</div>
                <div className="bg-red-50 p-3 rounded-lg text-xs space-y-1 max-h-40 overflow-y-auto">
                  {batchResult.errors.map((err: string, i: number) => (
                    <div key={i} className="text-red-700 font-mono">{err}</div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="font-bold text-gray-800 text-sm mb-1">Mã vận đơn đã sinh:</div>
              <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                {batchResult.createdOrders?.map((o: any) => (
                  <Tag color="green" key={o.trackingCode} className="font-mono font-bold">
                    {o.trackingCode}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
