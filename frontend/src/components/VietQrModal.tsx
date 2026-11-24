import React, { useState } from 'react';
import { Modal, Button, Typography, Space, Tag, message } from 'antd';
import { QrCode, Copy, Check, Download, CreditCard, ShieldCheck } from 'lucide-react';
import { Order } from '../types';

const { Text, Title } = Typography;

interface VietQrModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onConfirmPaid?: () => void;
}

export const VietQrModal: React.FC<VietQrModalProps> = ({
  visible,
  order,
  onClose,
  onConfirmPaid,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!order) return null;

  // Tính số tiền cần thu:
  // Nếu người nhận trả cước: COD + TotalFee
  // Nếu người gửi đã trả cước: chỉ thu COD
  const codAmount = order.codAmount || 0;
  const isReceiverPay = order.paymentParty === 'RECEIVER';
  const totalFee = isReceiverPay ? (order.totalFee || 0) : 0;
  const totalAmountToCollect = codAmount + totalFee;

  // Cấu hình ngân hàng thụ hưởng Rikkei Post
  const bankBin = '970422'; // MBBank (Ngân hàng Quân Đội)
  const accountNumber = '0367508795';
  const accountName = 'CONG TY CP CHUYEN PHAT NHANH RIKKEI POST';
  const description = `${order.trackingCode}`;

  // Chuẩn VietQR API động NAPAS
  const qrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${totalAmountToCollect}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`Đã sao chép ${label}!`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={450}
      centered
      title={
        <div className="flex items-center space-x-2 text-blue-600">
          <QrCode size={22} />
          <span className="font-bold text-lg">Mã VietQR Thu Hộ COD & Cước Phí</span>
        </div>
      }
    >
      <div className="text-center p-2">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
          <div className="text-xs text-gray-500 font-medium">SỐ TIỀN CẦN THANH TOÁN</div>
          <div className="text-2xl font-black text-red-600 my-1">
            {totalAmountToCollect.toLocaleString('vi-VN')} đ
          </div>
          <div className="text-xs text-gray-600 flex justify-center space-x-2">
            <span>Tiền hàng COD: <b>{codAmount.toLocaleString('vi-VN')} đ</b></span>
            {isReceiverPay && (
              <span>• Cước: <b>{totalFee.toLocaleString('vi-VN')} đ</b></span>
            )}
          </div>
        </div>

        {/* Khung ảnh QR Code VietQR */}
        <div className="relative inline-block border-2 border-dashed border-blue-400 p-2 rounded-2xl bg-white shadow-sm mb-3">
          <img
            src={qrUrl}
            alt="VietQR Code"
            className="w-64 h-auto mx-auto rounded-lg object-contain"
          />
          <div className="mt-1 text-xs text-gray-500 font-medium flex items-center justify-center space-x-1">
            <ShieldCheck size={14} className="text-green-600" />
            <span>Chuẩn thanh toán liên ngân hàng NAPAS 24/7</span>
          </div>
        </div>

        {/* Thông tin tài khoản chi tiết */}
        <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1.5 text-xs border border-gray-200 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Ngân hàng:</span>
            <span className="font-bold text-gray-800">MBBank (Ngân hàng Quân Đội)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Số tài khoản:</span>
            <div className="flex items-center space-x-1">
              <span className="font-bold text-blue-700 font-mono text-sm">{accountNumber}</span>
              <Button
                type="text"
                size="small"
                icon={<Copy size={12} />}
                onClick={() => handleCopy(accountNumber, 'Số tài khoản')}
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Chủ tài khoản:</span>
            <span className="font-bold text-gray-800 uppercase">{accountName}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Nội dung chuyển khoản:</span>
            <div className="flex items-center space-x-1">
              <span className="font-bold text-red-600 font-mono text-sm">{description}</span>
              <Button
                type="text"
                size="small"
                icon={<Copy size={12} />}
                onClick={() => handleCopy(description, 'Nội dung CK')}
              />
            </div>
          </div>
        </div>

        <Space className="w-full justify-center">
          <Button
            type="primary"
            size="large"
            className="bg-green-600 hover:bg-green-700 font-bold px-6"
            icon={<Check size={18} />}
            onClick={() => {
              if (onConfirmPaid) onConfirmPaid();
              onClose();
            }}
          >
            Khách đã chuyển khoản thành công
          </Button>
          <Button size="large" onClick={onClose}>
            Đóng
          </Button>
        </Space>
      </div>
    </Modal>
  );
};
