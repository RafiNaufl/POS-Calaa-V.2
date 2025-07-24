import React from 'react';
import { InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface BluetoothPrinterProps {
  receiptHTML: string;
  onPrintSuccess?: () => void;
  onPrintError?: (error: string) => void;
  onClose?: () => void;
}
      
const BluetoothPrinter: React.FC<BluetoothPrinterProps> = ({
  receiptHTML,
  onPrintSuccess,
  onPrintError,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Cetak ke Printer</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-800">
            <InformationCircleIcon className="h-5 w-5 inline-block mr-1" />
            Fitur JSPrintManager dan defuj/printer-js telah dihapus dari aplikasi. Silakan gunakan metode pencetakan browser atau Web Bluetooth API sebagai alternatif.
          </p>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

export default BluetoothPrinter;