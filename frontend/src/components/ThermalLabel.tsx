import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { Order } from '../types';

interface ThermalLabelProps {
  order: Order;
}

export const ThermalLabel: React.FC<ThermalLabelProps> = ({ order }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && order.trackingCode) {
      try {
        JsBarcode(barcodeRef.current, order.trackingCode, {
          format: 'CODE128',
          width: 1.8,
          height: 48,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
          margin: 4,
        });
      } catch (e) {
        console.error('Lỗi render barcode:', e);
      }
    }
  }, [order.trackingCode]);

  return (
    <div className="print-label-container bg-white border-2 border-black w-[100mm] min-h-[145mm] p-3 text-black text-xs font-sans leading-tight">
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
        <div>
          <div className="text-xl font-black tracking-wider text-red-600">RIKKEI_POST</div>
          <div className="text-[10px] font-bold">Chuyển phát nhanh Thông minh</div>
        </div>
        <div className="text-right">
          <div className="border-2 border-black px-2 py-0.5 font-black text-xs uppercase bg-black text-white">
            {order.serviceType}
          </div>
          <div className="text-[10px] font-mono mt-0.5">Hotline: 1900 6868</div>
        </div>
      </div>

      {/* Barcode & QR Code Section */}
      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
        <div className="flex-1 flex flex-col items-center">
          <svg ref={barcodeRef} className="max-w-[200px]"></svg>
        </div>
        <div className="pl-2 border-l border-black">
          <QRCodeSVG value={`https://rikkeipost.vn/track/${order.trackingCode}`} size={64} />
          <div className="text-[9px] text-center font-bold mt-1">QUÉT MÃ</div>
        </div>
      </div>

      {/* Routing Code & Date */}
      <div className="flex justify-between items-center bg-gray-100 border border-black px-2 py-1 mb-2">
        <div>
          <span className="text-[10px] font-bold">MÃ PHÂN LOẠI: </span>
          <span className="text-base font-black tracking-wider">{order.routingCode}</span>
        </div>
        <div className="text-[10px] font-mono">
          {new Date(order.createdAt).toLocaleDateString('vi-VN')}
        </div>
      </div>

      {/* Sender & Receiver Box */}
      <div className="grid grid-cols-2 gap-2 border border-black p-2 mb-2">
        <div className="border-r border-black pr-1">
          <div className="font-bold uppercase text-[10px] text-gray-700">TỪ (NGƯỜI GỬI):</div>
          <div className="font-bold text-xs mt-0.5">{order.senderName}</div>
          <div className="font-mono text-xs">{order.senderPhone}</div>
          <div className="text-[11px] text-gray-700 line-clamp-3 mt-0.5">{order.senderAddress}</div>
        </div>

        <div className="pl-1">
          <div className="font-bold uppercase text-[10px] text-red-700">ĐẾN (NGƯỜI NHẬN):</div>
          <div className="font-black text-xs mt-0.5">{order.receiverName}</div>
          <div className="font-mono font-bold text-xs">{order.receiverPhone}</div>
          <div className="text-[11px] font-medium line-clamp-3 mt-0.5">{order.receiverAddress}</div>
        </div>
      </div>

      {/* Package Content & Weight */}
      <div className="border border-black p-1.5 mb-2 text-[11px]">
        <div className="flex justify-between">
          <span><b>Nội dung hàng:</b> {order.itemName}</span>
          <span><b>TL thực:</b> {order.actualWeightGram}g</span>
        </div>
        <div className="flex justify-between text-gray-600 text-[10px] mt-0.5">
          <span><b>Ghi chú:</b> {order.notes || 'Cho xem hàng, không thử'}</span>
          <span><b>TL quy đổi:</b> {order.volumetricWeightGram}g</span>
        </div>
      </div>

      {/* COD & Payment Amount (Big Highlight) */}
      <div className="border-2 border-black p-2 mb-2 bg-yellow-50">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[10px] font-bold text-gray-700">TIỀN THU HỘ (COD):</div>
            <div className="text-lg font-black text-red-700">
              {Number(order.codAmount).toLocaleString('vi-VN')} đ
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-gray-700">NGƯỜI TRẢ CƯỚC:</div>
            <div className="font-black text-xs uppercase">
              {order.paymentParty === 'SENDER' ? 'Shop trả cước' : 'Khách trả cước'}
            </div>
            <div className="text-xs font-bold text-gray-800">
              {Number(order.totalFee).toLocaleString('vi-VN')} đ
            </div>
          </div>
        </div>
      </div>

      {/* Signature & Note Footer */}
      <div className="grid grid-cols-2 gap-2 text-center text-[10px] border-t border-black pt-2">
        <div>
          <div className="font-bold">Chữ ký người gửi</div>
          <div className="h-10 border-b border-dashed border-gray-400"></div>
        </div>
        <div>
          <div className="font-bold">Chữ ký người nhận</div>
          <div className="text-[9px] text-gray-500">(Xác nhận hàng nguyên vẹn)</div>
          <div className="h-7 border-b border-dashed border-gray-400"></div>
        </div>
      </div>
    </div>
  );
};
