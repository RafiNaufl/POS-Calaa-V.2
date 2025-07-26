'use client'

import { useState, useEffect, useCallback } from 'react'
import { XCircleIcon, QrCodeIcon, DevicePhoneMobileIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import Image from 'next/image'

interface XenditPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  transactionData: any
  onSuccess: (transaction: any) => void
  onError: (error: string) => void
}

interface PaymentCharge {
  charge_id: string
  reference_id: string
  status: string
  checkout_url?: string
  qr_code?: string
  deep_link?: string
  payment_method: string
  amount: number
}

const EWALLET_METHODS = [
  {
    id: 'ovo',
    name: 'OVO',
    logo: '🟠',
    description: 'Bayar dengan OVO'
  },
  {
    id: 'dana',
    name: 'DANA',
    logo: '🔵',
    description: 'Bayar dengan DANA'
  },
  {
    id: 'linkaja',
    name: 'LinkAja',
    logo: '🔴',
    description: 'Bayar dengan LinkAja'
  },
  {
    id: 'shopeepay',
    name: 'ShopeePay',
    logo: '🟠',
    description: 'Bayar dengan ShopeePay'
  },
  {
    id: 'gopay',
    name: 'GoPay',
    logo: '🟢',
    description: 'Bayar dengan GoPay'
  }
]

export default function XenditPaymentModal({
  isOpen,
  onClose,
  transactionData,
  onSuccess,
  onError
}: XenditPaymentModalProps) {
  const amount = transactionData?.total || 0
  const transactionId = transactionData?.id || Date.now().toString()
  const customerName = transactionData?.customerName
  const customerPhone = transactionData?.customerPhone
  const customerEmail = transactionData?.customerEmail
  const [selectedMethod, setSelectedMethod] = useState<string>('')
  const [isCreatingPayment, setIsCreatingPayment] = useState(false)
  const [paymentCharge, setPaymentCharge] = useState<PaymentCharge | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [countdown, setCountdown] = useState(300) // 5 minutes

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMethod('')
      setPaymentCharge(null)
      setPaymentStatus('')
      setError('')
      setCountdown(300)
    }
  }, [isOpen])

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (paymentCharge && countdown > 0 && paymentStatus !== 'SUCCEEDED') {
      interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            setError('Waktu pembayaran habis. Silakan coba lagi.')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [paymentCharge, countdown, paymentStatus])

  const checkPaymentStatus = useCallback(async () => {
    if (!paymentCharge || isCheckingStatus) return

    setIsCheckingStatus(true)

    try {
      const response = await fetch(`/api/payments/xendit?charge_id=${paymentCharge.charge_id}`)
      const data = await response.json()

      if (response.ok) {
        setPaymentStatus(data.status)
        
        if (data.status === 'SUCCEEDED') {
          onSuccess({ id: transactionId, total: amount, pointsEarned: 0 })
        } else if (data.status === 'FAILED') {
          setError('Pembayaran gagal. Silakan coba lagi.')
          onError('Payment failed')
        }
      }
    } catch (error) {
      console.error('Status check error:', error)
    } finally {
      setIsCheckingStatus(false)
    }
  }, [paymentCharge, isCheckingStatus, transactionId, amount, onSuccess, onError])

  // Check payment status periodically
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (paymentCharge && paymentStatus !== 'SUCCEEDED' && paymentStatus !== 'FAILED' && countdown > 0) {
      interval = setInterval(async () => {
        await checkPaymentStatus()
      }, 3000) // Check every 3 seconds
    }
    return () => clearInterval(interval)
  }, [paymentCharge, paymentStatus, countdown, checkPaymentStatus])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount)
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const createPayment = async () => {
    if (!selectedMethod) {
      setError('Pilih metode pembayaran terlebih dahulu')
      return
    }

    setIsCreatingPayment(true)
    setError('')

    try {
      // First, create the transaction in database
      const transactionResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...transactionData,
          paymentMethod: 'E_WALLET',
          // Ensure both fields are sent for compatibility
          promoDiscount: transactionData.promotionDiscount || transactionData.promoDiscount || 0,
          promotionDiscount: transactionData.promotionDiscount || transactionData.promoDiscount || 0
        })
      })

      if (!transactionResponse.ok) {
        const errorData = await transactionResponse.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || 'Gagal membuat transaksi';
        console.error('Transaction creation error:', errorData);
        
        // Jika error terkait sesi atau user tidak ditemukan, lempar error spesifik
        if (errorMessage.includes('Sesi pengguna tidak valid') || 
            errorMessage.includes('User not found in database') ||
            errorMessage.includes('No user in session') ||
            errorMessage.includes('Missing user ID')) {
          throw new Error('Sesi pengguna tidak valid. Silakan login ulang.');
        }
        
        throw new Error(errorMessage);
      }

      const transaction = await transactionResponse.json()
      const actualTransactionId = transaction.id

      // Then create Xendit payment
      const response = await fetch('/api/payments/xendit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          paymentMethod: selectedMethod,
          customerName,
          customerPhone,
          customerEmail,
          transactionId: actualTransactionId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('Xendit payment creation error:', data);
        throw new Error(data.message || data.error || 'Gagal membuat pembayaran')
      }

      // Update transaction with Xendit details
      try {
        const updateResponse = await fetch('/api/transactions', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: actualTransactionId,
            paymentStatus: 'PENDING',
            xenditChargeId: data.charge_id,
            xenditReferenceId: data.reference_id,
            amount: amount,
            paymentMethod: selectedMethod,
            transactionId: actualTransactionId
          })
        })
        
        if (!updateResponse.ok) {
          console.warn('Failed to update transaction with Xendit details, but payment was created:', 
            await updateResponse.text().catch(() => 'Unknown error'));
          // Continue anyway since the payment was created
        }
      } catch (updateError) {
        console.warn('Error updating transaction with Xendit details:', updateError);
        // Continue anyway since the payment was created
      }

      setPaymentCharge(data)
      setPaymentStatus(data.status)

    } catch (error: any) {
      console.error('Payment creation error:', error)
      
      // Provide more specific error messages based on the error
      if (error.message.includes('foreign key constraint')) {
        setError('Gagal membuat transaksi: Terdapat masalah dengan data pengguna. Silakan coba login ulang.')
      } else if (error.message.includes('session')) {
        setError('Gagal membuat transaksi: Sesi pengguna tidak valid. Silakan login ulang.')
      } else {
        setError(error.message || 'Gagal membuat pembayaran. Silakan coba lagi.')
      }
    } finally {
      setIsCreatingPayment(false)
    }
  }

  const openPaymentUrl = () => {
    if (paymentCharge?.checkout_url) {
      window.open(paymentCharge.checkout_url, '_blank')
    } else if (paymentCharge?.deep_link) {
      window.location.href = paymentCharge.deep_link
    }
  }

  const handleClose = () => {
    if (paymentStatus === 'SUCCEEDED') {
      onSuccess(paymentCharge)
    } else if (error) {
      // Jika error terkait sesi, pastikan pesan error yang dikirim sesuai
      if (error.includes('Sesi pengguna tidak valid') || 
          error.includes('User not found in database') ||
          error.includes('No user in session') ||
          error.includes('Missing user ID')) {
        onError('Sesi pengguna tidak valid. Silakan login ulang.')
      } else {
        onError(error)
      }
    } else {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 xl:w-1/3 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Pembayaran E-Wallet
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Amount */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-blue-600 mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-blue-800">{formatCurrency(amount)}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {!paymentCharge ? (
            // Payment method selection
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-4">Pilih Metode Pembayaran</h4>
              <div className="space-y-3 mb-6">
                {EWALLET_METHODS.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedMethod === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.id}
                      checked={selectedMethod === method.id}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-center flex-1">
                      <span className="text-2xl mr-3">{method.logo}</span>
                      <div>
                        <p className="font-medium text-gray-900">{method.name}</p>
                        <p className="text-sm text-gray-500">{method.description}</p>
                      </div>
                    </div>
                    {selectedMethod === method.id && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    )}
                  </label>
                ))}
              </div>

              <button
                onClick={createPayment}
                disabled={!selectedMethod || isCreatingPayment}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3 px-6 rounded-lg font-medium transition-colors"
              >
                {isCreatingPayment ? 'Membuat Pembayaran...' : 'Lanjutkan Pembayaran'}
              </button>
            </div>
          ) : (
            // Payment instructions
            <div>
              {countdown > 0 && paymentStatus !== 'SUCCEEDED' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-yellow-800 text-sm">Waktu tersisa:</p>
                    <p className="text-yellow-800 font-bold">{formatTime(countdown)}</p>
                  </div>
                </div>
              )}

              {paymentStatus === 'SUCCEEDED' ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-green-800">Pembayaran Berhasil!</p>
                      <p className="text-sm text-green-600">Transaksi telah dikonfirmasi</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-center mb-6">
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Menunggu Pembayaran {EWALLET_METHODS.find(m => m.id === selectedMethod)?.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Silakan selesaikan pembayaran melalui aplikasi atau scan QR code
                    </p>
                  </div>

                  {paymentCharge.qr_code && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4">
                      <div className="text-center">
                        <div className="bg-gray-100 p-4 rounded-lg inline-block mb-4">
                          <QrCodeIcon className="h-32 w-32 text-gray-400" />
                          {/* In a real implementation, you would use a QR code library to display the actual QR code */}
                          <p className="text-xs text-gray-500 mt-2">QR Code untuk pembayaran</p>
                        </div>
                        <p className="text-sm text-gray-600">Scan QR code dengan aplikasi {EWALLET_METHODS.find(m => m.id === selectedMethod)?.name}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {paymentCharge.checkout_url && (
                      <button
                        onClick={openPaymentUrl}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center"
                      >
                        <GlobeAltIcon className="h-5 w-5 mr-2" />
                        Buka di Browser
                      </button>
                    )}

                    {paymentCharge.deep_link && (
                      <button
                        onClick={openPaymentUrl}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center"
                      >
                        <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
                        Buka Aplikasi {EWALLET_METHODS.find(m => m.id === selectedMethod)?.name}
                      </button>
                    )}

                    <button
                      onClick={checkPaymentStatus}
                      disabled={isCheckingStatus}
                      className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                    >
                      {isCheckingStatus ? 'Mengecek Status...' : 'Cek Status Pembayaran'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}