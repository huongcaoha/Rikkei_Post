import React, { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { MasterBag } from '../types';

interface MasterBagThermalLabelProps {
  bag: MasterBag;
}

export const MasterBagThermalLabel: React.FC<MasterBagThermalLabelProps> = ({ bag }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const sealBarcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && bag.bagCode) {
      try {
        JsBarcode(barcodeRef.current, bag.bagCode, {
          format: 'CODE128',
          width: 2.2,
          height: 60,
          displayValue: true,
          fontSize: 16,
          font: 'monospace',
          textMargin: 5,
          margin: 4,
        });
      } catch (e) {
        console.error('Lỗi render barcode bao tải:', e);
      }
    }

    if (sealBarcodeRef.current && bag.sealNumber) {
      try {
        JsBarcode(sealBarcodeRef.current, bag.sealNumber, {
          format: 'CODE128',
          width: 1.6,
          height: 36,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          textMargin: 3,
          margin: 2,
        });
      } catch (e) {
        console.error('Lỗi render barcode kẹp chì:', e);
      }
    }
  }, [bag.bagCode, bag.sealNumber]);

  return (
    <div className="print-label-container bg-white border-2 border-black w-full max-w-[100mm] min-h-[145mm] p-3 text-black text-xs font-sans leading-tight mx-auto rounded-lg shadow-sm print:rounded-none print:shadow-none print:border-none print:w-[100mm]">
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-2">
        <div>
          <div className="text-xl font-black tracking-wider text-red-600">RIKKEI POST</div>
          <div className="text-[10px] font-bold text-gray-700 uppercase">Smart Express Logistics</div>
        </div>
        <div className="text-right">
          <div className="border-2 border-black px-2 py-0.5 font-black text-xs uppercase bg-black text-white">
            MASTER BAG
          </div>
          <div className="text-[10px] font-mono mt-0.5 font-bold">TEM DÁN BAO TẢI TỔNG</div>
        </div>
      </div>

      {/* Tuyến vận chuyển TỪ -> ĐẾN */}
      <div className="border-2 border-black p-2 mb-2 bg-gray-50 rounded">
        <div className="text-[11px] text-gray-600 font-semibold mb-0.5">
          TỪ (KHO ĐI): <span className="text-black font-bold">{bag.originWarehouseName}</span>
        </div>
        <div className="text-xs text-gray-600 font-semibold border-t border-dashed border-gray-400 pt-1 mt-1">
          ĐẾN (KHO ĐÍCH):{' '}
          <span className="text-red-700 font-black text-sm uppercase block">
            {bag.destWarehouseName}
          </span>
        </div>
      </div>

      {/* Thông tin tải trọng & số kiện */}
      <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-2 mb-2 text-xs">
        <div className="bg-gray-100 p-1.5 rounded border border-gray-300">
          <span className="text-gray-600 block text-[10px] uppercase font-bold">Số lượng kiện hàng:</span>
          <span className="font-black text-base text-blue-900">{bag.totalItems} KIỆN</span>
        </div>
        <div className="bg-gray-100 p-1.5 rounded border border-gray-300">
          <span className="text-gray-600 block text-[10px] uppercase font-bold">Tổng trọng lượng:</span>
          <span className="font-black text-base text-blue-900">
            {Number(bag.totalWeightKg).toFixed(2)} KG
          </span>
        </div>
      </div>

      {/* Kẹp chì niêm phong (Seal) */}
      <div className="border-2 border-black p-2 mb-3 bg-red-50/50 rounded">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-bold text-gray-700 uppercase">
            SỐ HIỆU KẸP CHÌ NIÊM PHONG (SEAL):
          </span>
          <span className="font-mono font-black text-sm text-red-600">
            {bag.sealNumber || 'CHƯA KẸP CHÌ'}
          </span>
        </div>
        {bag.sealNumber && (
          <div className="flex justify-center pt-1">
            <svg ref={sealBarcodeRef} className="max-w-[240px] w-full" />
          </div>
        )}
      </div>

      {/* KHỐI MÃ VẠCH 1D & QR CODE CHÍNH CỦA BAO TẢI (CAMERA QUÉT NGAY LẬP TỨC) */}
      <div className="border-2 border-black p-2.5 rounded bg-white text-center">
        <div className="text-[11px] font-black text-gray-900 uppercase tracking-wider mb-1">
          MÃ VẠCH VẬN HÀNH BAO TẢI TỔNG (QUÉT QUA CAMERA / MÁY QUÉT)
        </div>

        <div className="flex flex-row items-center justify-center gap-3 py-1">
          {/* Mã vạch 1D Barcode Code-128 */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <svg ref={barcodeRef} className="max-w-[220px] w-full" />
          </div>

          {/* Mã 2D QR Code để camera điện thoại nhận diện tức thì */}
          <div className="p-1.5 border-2 border-black rounded bg-white flex flex-col items-center justify-center shrink-0">
            <QRCodeSVG value={bag.bagCode} size={84} level="H" includeMargin={false} />
            <span className="text-[8px] font-black text-gray-800 mt-1 uppercase">QUÉT QR</span>
          </div>
        </div>

        <div className="text-[10px] font-bold text-blue-800 mt-1 bg-blue-50 py-1 px-2 rounded border border-blue-200">
          📱 Dùng Camera điện thoại hoặc Súng bắn mã vạch quét mã trên để nhận bao tải lên xe
        </div>
      </div>

      {/* Footer ghi chú */}
      <div className="mt-2 pt-1 border-t border-gray-300 flex justify-between items-center text-[9px] text-gray-500 font-mono">
        <span>Tạo lúc: {bag.createdAt ? new Date(bag.createdAt).toLocaleString('vi-VN') : '—'}</span>
        <span>Hệ thống Rikkei Post WMS Logistics</span>
      </div>
    </div>
  );
};

export default MasterBagThermalLabel;
