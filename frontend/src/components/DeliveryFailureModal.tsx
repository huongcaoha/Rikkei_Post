import React, { useState } from 'react';
import { Modal, Select, Input, DatePicker, Button, message, Alert } from 'antd';
import { AlertCircle, Calendar, Camera, UploadCloud, RotateCcw } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { Order, DeliveryFailureRequest } from '../types';
import { shipperApi } from '../api/shipper';

const { TextArea } = Input;
const { Option } = Select;

interface DeliveryFailureModalProps {
  visible: boolean;
  order: Order | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeliveryFailureModal: React.FC<DeliveryFailureModalProps> = ({
  visible,
  order,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<string>('Không liên lạc được với người nhận (thuê bao/tắt máy 3 lần)');
  const [notes, setNotes] = useState<string>('');
  const [rescheduledDate, setRescheduledDate] = useState<Dayjs | null>(dayjs().add(1, 'day'));
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!order) return null;

  const currentAttempts = order.deliveryAttempts || 0;
  const nextAttempts = currentAttempts + 1;
  const isExplicitReject = reason.toLowerCase().includes('từ chối') || reason.toLowerCase().includes('hủy đơn');
  const isAutoReturn = nextAttempts >= 3 || isExplicitReject;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        setProofPhotoUrl(uploadEvent.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: DeliveryFailureRequest = {
        trackingCode: order.trackingCode,
        reason,
        notes,
        failureProofPhotoUrl: proofPhotoUrl,
        rescheduledDate: rescheduledDate ? rescheduledDate.format('YYYY-MM-DD') : undefined,
      };

      await shipperApi.reportFailure(payload);
      message.success(`Đã ghi nhận báo phát thất bại cho đơn ${order.trackingCode}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.response?.data?.message || 'Lỗi khi gửi báo cáo phát thất bại!');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={500}
      centered
      title={
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle size={22} />
          <span className="font-bold text-lg">Báo Cáo Giao Hàng Không Thành Công</span>
        </div>
      }
    >
      <div className="space-y-4 py-2">
        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
          <div className="text-xs text-gray-600">Mã vận đơn: <b className="text-gray-900">{order.trackingCode}</b></div>
          <div className="text-xs text-gray-600">Khách nhận: <b className="text-gray-900">{order.receiverName}</b> ({order.receiverPhone})</div>
          <div className="text-xs text-red-600 font-bold mt-1">
            Số lần đã phát trước đó: {currentAttempts} lần (Lần này là lần thứ {nextAttempts}/3)
          </div>
        </div>

        {isAutoReturn ? (
          <Alert
            message="Kích hoạt Chuyển hoàn về Shop (RETURNING)"
            description={
              nextAttempts >= 3
                ? 'Đơn hàng đã phát không thành công đủ 3 lần theo quy định bưu chính. Hệ thống sẽ kích hoạt quy trình CHUYỂN HOÀN (RETURNING) về cho Shop/Người gửi.'
                : 'Lý do khách từ chối nhận hoặc hủy đơn sẽ kích hoạt ngay quy trình CHUYỂN HOÀN về cho người gửi/Shop.'
            }
            type="warning"
            showIcon
          />
        ) : (
          <Alert
            message={`Đơn hàng chuyển sang trạng thái GIAO THẤT BẠI (Lần ${nextAttempts}/3)`}
            description="Theo quy định, đơn giao không thành công (< 3 lần) sẽ được mang về kho bưu cục để nhân viên kho quét tiếp nhận nhập kho lưu trữ (AT_SORTING_HUB). Hôm sau bưu tá sẽ quét mã lấy đơn đi phát lại cho khách."
            type="info"
            showIcon
          />
        )}

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Lý do không giao được (*):
          </label>
          <Select
            className="w-full"
            value={reason}
            onChange={(val) => setReason(val)}
            size="large"
          >
            <Option value="Không liên lạc được với người nhận (thuê bao/tắt máy 3 lần)">
              Không liên lạc được với người nhận (thuê bao/tắt máy 3 lần)
            </Option>
            <Option value="Khách hẹn lại thời gian / ngày phát khác">
              Khách hẹn lại thời gian / ngày phát khác
            </Option>
            <Option value="Khách đổi địa chỉ giao hàng mới">
              Khách đổi địa chỉ giao hàng mới
            </Option>
            <Option value="Sai địa chỉ hoặc sai số điện thoại">
              Sai địa chỉ hoặc sai số điện thoại
            </Option>
            <Option value="Khách không đủ tiền thanh toán COD">
              Khách không đủ tiền thanh toán COD
            </Option>
            <Option value="Khách kiểm tra hàng và từ chối nhận (hàng lỗi/vỡ/không đúng)">
              Khách kiểm tra hàng và từ chối nhận (hàng lỗi/vỡ/không đúng)
            </Option>
            <Option value="Khách từ chối nhận hàng (không có nhu cầu nữa)">
              Khách từ chối nhận hàng (không có nhu cầu nữa)
            </Option>
          </Select>
        </div>

        {!isAutoReturn && (
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Hẹn ngày phát lại:
            </label>
            <DatePicker
              className="w-full"
              value={rescheduledDate}
              onChange={(date) => setRescheduledDate(date)}
              format="YYYY-MM-DD"
              size="large"
              disabledDate={(current) => current && current < dayjs().endOf('day')}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Ảnh chụp bằng chứng hiện trường (cổng nhà / lịch sử cuộc gọi):
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              id="failureProofPhoto"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="failureProofPhoto"
              className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-red-400 p-2.5 rounded-lg flex items-center space-x-2 text-xs text-gray-600 bg-gray-50 hover:bg-red-50"
            >
              <Camera size={16} className="text-red-600" />
              <span>Chụp ảnh / Chọn ảnh xác minh</span>
            </label>
            {proofPhotoUrl && (
              <span className="text-xs text-green-600 font-bold">✓ Đã đính kèm ảnh</span>
            )}
          </div>
          {proofPhotoUrl && (
            <div className="mt-2 text-center">
              <img src={proofPhotoUrl} alt="Bằng chứng" className="h-28 mx-auto rounded border" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Ghi chú chi tiết:
          </label>
          <TextArea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ví dụ: Gọi 3 cuộc lúc 9h, 11h, 14h đều không bắt máy..."
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t">
          <Button onClick={onClose}>Hủy bỏ</Button>
          <Button
            type="primary"
            danger
            loading={submitting}
            onClick={handleSubmit}
            className="font-bold"
          >
            Xác nhận Báo Thất Bại
          </Button>
        </div>
      </div>
    </Modal>
  );
};
