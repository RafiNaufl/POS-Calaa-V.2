'use client'

import React, { useState } from 'react'
import { PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline'
import ThermalPrinter from './ThermalPrinter'
import PrinterIntegration from './PrinterIntegration'

interface Transaction {
  id: string
  date: string
  time: string
  items: TransactionItem[]
  subtotal: number
  tax: number
  total: number
  paymentMethod: 'CASH' | 'CARD' | 'DIGITAL_WALLET'
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING'
  cashier: string
  customer?: string
  pointsUsed?: number
  voucherCode?: string
  voucherDiscount?: number
  promotionDiscount?: number
}

interface TransactionItem {
  id: string
  name: string
  quantity: number
  price: number
  total: number
}

interface ReceiptPreviewProps {
  transaction: Transaction
  isOpen: boolean
  onClose: () => void
  onPrint: () => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case 'CASH':
      return 'Tunai'
    case 'CARD':
      return 'Kartu'
    case 'DIGITAL_WALLET':
      return 'Dompet Digital'
    default:
      return method
  }
}

const formatDate = (dateString: string) => {
  const date = dateString ? new Date(dateString) : new Date()
  const isValidDate = date instanceof Date && !isNaN(date.getTime())
  const validDate = isValidDate ? date : new Date()
  return validDate.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export default function ReceiptPreview({ transaction, isOpen, onClose, onPrint }: ReceiptPreviewProps) {
  const [receiptHTML, setReceiptHTML] = useState('')
  const [showThermalPrinter, setShowThermalPrinter] = useState(false)
  const [showPrinterIntegration, setShowPrinterIntegration] = useState(false)
  
  if (!isOpen) return null

  const generateReceiptHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk - ${transaction.id}</title>
        <style>
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 5mm;
            }
          }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.2;
            max-width: 80mm;
            margin: 0 auto;
            padding: 10px;
            background: white;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .store-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .store-info {
            font-size: 10px;
            margin-bottom: 2px;
          }
          .transaction-info {
            margin-bottom: 10px;
            font-size: 11px;
          }
          .items {
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .item {
            margin-bottom: 5px;
          }
          .item-name {
            font-weight: bold;
          }
          .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
          }
          .totals {
            border-bottom: 1px dashed #000;
            padding-bottom: 10px;
            margin-bottom: 10px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .total-final {
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid #000;
            padding-top: 5px;
          }
          .payment-info {
            margin-bottom: 10px;
          }
          .footer {
            text-align: center;
            font-size: 10px;
            margin-top: 10px;
          }
          .dashed-line {
            border-bottom: 1px dashed #000;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store-name">TOKO SERBAGUNA</div>
          <div class="store-info">Jl. Contoh No. 123</div>
          <div class="store-info">Telp: (021) 1234-5678</div>
          <div class="store-info">Email: info@tokoserbaguna.com</div>
        </div>
        
        <div class="transaction-info">
          <div>No. Transaksi: ${transaction.id}</div>
          <div>Tanggal: ${formatDate(transaction.date)}</div>
          <div>Waktu: ${transaction.time}</div>
          <div>Kasir: ${transaction.cashier}</div>
          ${transaction.customer ? `<div>Pelanggan: ${transaction.customer}</div>` : ''}
        </div>
        
        <div class="items">
          ${transaction.items.map(item => `
            <div class="item">
              <div class="item-name">${item.name}</div>
              <div class="item-details">
                <span>${item.quantity} x ${formatCurrency(item.price)}</span>
                <span>${formatCurrency(item.total)}</span>
              </div>
            </div>
          `).join('')}
        </div>
        
        <div class="totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>${formatCurrency(transaction.subtotal)}</span>
          </div>
          <div class="total-line">
            <span>Pajak:</span>
            <span>${formatCurrency(transaction.tax)}</span>
          </div>
          ${(transaction.pointsUsed ?? 0) > 0 ? `
          <div class="total-line">
            <span>Diskon Poin (${transaction.pointsUsed} poin):</span>
            <span>-${formatCurrency((transaction.pointsUsed ?? 0) * 1000)}</span>
          </div>` : ''}
          ${transaction.voucherCode && (transaction.voucherDiscount ?? 0) > 0 ? `
          <div class="total-line">
            <span>Diskon Voucher (${transaction.voucherCode}):</span>
            <span>-${formatCurrency(transaction.voucherDiscount ?? 0)}</span>
          </div>` : ''}
          ${(transaction.promotionDiscount ?? 0) > 0 ? `
          <div class="total-line">
            <span>Diskon Promosi:</span>
            <span>-${formatCurrency(transaction.promotionDiscount ?? 0)}</span>
          </div>` : ''}
          <div class="total-line total-final">
            <span>TOTAL:</span>
            <span>${formatCurrency(transaction.total)}</span>
          </div>
        </div>
        
        <div class="payment-info">
          <div class="total-line">
            <span>Pembayaran:</span>
            <span>${getPaymentMethodLabel(transaction.paymentMethod)}</span>
          </div>
          <div class="total-line">
            <span>Status:</span>
            <span>${transaction.status}</span>
          </div>
        </div>
        
        <div class="footer">
          <div>Terima kasih atas kunjungan Anda!</div>
          <div>Barang yang sudah dibeli tidak dapat dikembalikan</div>
          <div class="dashed-line"></div>
          <div>Dicetak pada: ${new Date().toLocaleString('id-ID')}</div>
        </div>
      </body>
      </html>
    `
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup diblokir! Mohon izinkan popup untuk mencetak struk.')
      return
    }
      
    const html = generateReceiptHTML()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
      
    // Automatically print when the window loads
    printWindow.onload = () => {
      printWindow.print()
      printWindow.onafterprint = () => {
        printWindow.close()
        if (onPrint) onPrint()
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-hidden">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Preview Struk</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-180px)]" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-sm" style={{ width: '300px', margin: '0 auto' }}>
            {/* Store Header */}
            <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
              <div className="font-bold text-base mb-1">TOKO SERBAGUNA</div>
              <div className="text-xs text-gray-600">Jl. Contoh No. 123</div>
              <div className="text-xs text-gray-600">Telp: (021) 1234-5678</div>
              <div className="text-xs text-gray-600">Email: info@tokoserbaguna.com</div>
            </div>

            {/* Transaction Info */}
            <div className="mb-3 text-xs">
              <div>No. Transaksi: {transaction.id}</div>
              <div>Tanggal: {formatDate(transaction.date)}</div>
              <div>Waktu: {transaction.time}</div>
              <div>Kasir: {transaction.cashier}</div>
              {transaction.customer && <div>Pelanggan: {transaction.customer}</div>}
            </div>

            {/* Items */}
            <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
              {transaction.items.map((item) => (
                <div key={item.id} className="mb-2">
                  <div className="font-semibold text-xs">{item.name}</div>
                  <div className="flex justify-between text-xs">
                    <span>{item.quantity} x {formatCurrency(item.price)}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Subtotal:</span>
                <span>{formatCurrency(transaction.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs mb-1">
                <span>Pajak:</span>
                <span>{formatCurrency(transaction.tax)}</span>
              </div>
              {(transaction.pointsUsed ?? 0) > 0 && (
                <div className="flex justify-between text-xs mb-1 text-green-600">
                  <span>Diskon Poin ({transaction.pointsUsed} poin):</span>
                  <span>-{formatCurrency((transaction.pointsUsed ?? 0) * 1000)}</span>
                </div>
              )}
              {transaction.voucherCode && (transaction.voucherDiscount ?? 0) > 0 && (
                <div className="flex justify-between text-xs mb-1 text-purple-600">
                  <span>Diskon Voucher ({transaction.voucherCode}):</span>
                  <span>-{formatCurrency(transaction.voucherDiscount ?? 0)}</span>
                </div>
              )}
              {(transaction.promotionDiscount ?? 0) > 0 && (
                <div className="flex justify-between text-xs mb-1 text-green-600">
                  <span>Diskon Promosi:</span>
                  <span>-{formatCurrency(transaction.promotionDiscount ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm border-t border-gray-400 pt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(transaction.total)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span>Pembayaran:</span>
                <span>{getPaymentMethodLabel(transaction.paymentMethod)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Status:</span>
                <span>{transaction.status}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-600">
              <div className="mb-1">Terima kasih atas kunjungan Anda!</div>
              <div className="mb-2">Barang yang sudah dibeli tidak dapat dikembalikan</div>
              <div className="border-b border-dashed border-gray-400 mb-2"></div>
              <div>Dicetak pada: {new Date().toLocaleString('id-ID')}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 flex-shrink-0">
          <div className="flex justify-end space-x-3 mb-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center"
            >
              <PrinterIcon className="h-5 w-5 mr-2" />
              Cetak Struk (Browser)
            </button>
          </div>
          
          <div className="mt-2 flex space-x-3">
            <button
              onClick={() => {
                setReceiptHTML(generateReceiptHTML())
                setShowThermalPrinter(true)
                setShowPrinterIntegration(false)
              }}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center w-1/2"
            >
              <PrinterIcon className="h-5 w-5 mr-2" />
              Cetak ke Printer Thermal (Web Bluetooth)
            </button>
            

          </div>
          
          {showThermalPrinter && receiptHTML && (
            <ThermalPrinter 
              receiptHTML={receiptHTML} 
              onPrintSuccess={() => {
                onPrint()
                setShowThermalPrinter(false)
              }}
              onPrintError={(error) => {
                console.error('Print error:', error)
              }}
            />
          )}
          
          {showPrinterIntegration && receiptHTML && (
            <PrinterIntegration 
              receiptHTML={receiptHTML} 
              onClose={() => {
                setShowPrinterIntegration(false)
                onPrint()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}