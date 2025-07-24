import React, { useState } from 'react';
import BluetoothPrinter from './BluetoothPrinter';

interface PrinterIntegrationProps {
  receiptHTML: string;
  onClose?: () => void;
}

const PrinterIntegration: React.FC<PrinterIntegrationProps> = ({ receiptHTML, onClose }) => {
  const [printStatus, setPrintStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  const handlePrintSuccess = () => {
    setPrintStatus('success');
    // Otomatis tutup setelah berhasil mencetak setelah 3 detik
    setTimeout(() => {
      if (onClose) onClose();
    }, 3000);
  };
  
  const handlePrintError = (error: string) => {
    setPrintStatus('error');
    setErrorMessage(error);
  };
  
  return (
    <div className="w-full max-w-lg mx-auto">
      <BluetoothPrinter
        receiptHTML={receiptHTML}
        onPrintSuccess={handlePrintSuccess}
        onPrintError={handlePrintError}
        onClose={onClose}
      />
      
      {printStatus === 'success' && (
        <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-md">
          <p className="font-medium">Struk berhasil dicetak!</p>
        </div>
      )}
      
      {printStatus === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-800 rounded-md">
          <p className="font-medium">Gagal mencetak struk:</p>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default PrinterIntegration;