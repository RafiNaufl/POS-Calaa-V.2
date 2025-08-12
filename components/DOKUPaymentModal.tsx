"use client"

import { useState, useEffect, useCallback } from "react"
import { XCircleIcon, QrCodeIcon, DevicePhoneMobileIcon, GlobeAltIcon } from "@heroicons/react/24/outline"
import Image from "next/image"

interface DOKUPaymentModalProps {
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

const PAYMENT_METHODS = [
  {
    id: 'va',
    name: 'Virtual Account',
    logo: '🏦',
    description: 'Bayar dengan Virtual Account'
  },
  {
    id: 'cc',
    name: 'Kartu Kredit',
    logo: '💳',
    description: 'Bayar dengan Kartu Kredit'
  },
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

export default function DOKUPaymentModal({
  isOpen,
  onClose,
  transactionData,
  onSuccess,
  onError
}: DOKUPaymentModalProps) {
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
    if (paymentCharge && countdown > 0 && paymentStatus !== 'SUCCESS') {
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
      const response = await fetch(`/api/payments/doku?charge_id=${paymentCharge.charge_id}`)
      const data = await response.json()

      if (response.ok) {
        setPaymentStatus(data.status)
        
        if (data.status === 'SUCCESS') {
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
    if (paymentCharge && paymentStatus !== 'SUCCESS' && paymentStatus !== 'FAILED' && countdown > 0) {
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
          paymentMethod: 'DOKU',
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

      // Then create DOKU payment
      const response = await fetch('/api/payments/doku', {
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
        console.error('DOKU payment creation error:', data);
        throw new Error(data.message || data.error || 'Gagal membuat pembayaran')
      }

      // Update transaction with DOKU details
      try {
        const updateResponse = await fetch('/api/transactions', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: actualTransactionId,
            paymentStatus: 'PENDING',
            dokuReferenceId: data.reference_id, // Using dedicated DOKU reference ID field
            amount: amount,
            paymentMethod: selectedMethod,
            transactionId: actualTransactionId
          })
        })
        
        if (!updateResponse.ok) {
          console.warn('Failed to update transaction with DOKU details, but payment was created:', 
            await updateResponse.text().catch(() => 'Unknown error'));
          // Continue anyway since the payment was created
        }
      } catch (updateError) {
        console.warn('Error updating transaction with DOKU details:', updateError);
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
    if (paymentStatus === 'SUCCESS') {
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
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-medium">Pembayaran DOKU</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {!paymentCharge ? (
            <>
              <div className="mb-4">
                <p className="text-gray-700 mb-2">Total Pembayaran:</p>
                <p className="text-2xl font-bold">{formatCurrency(amount)}</p>
              </div>

              <div className="mb-4">
                <p className="text-gray-700 mb-2">Pilih Metode Pembayaran:</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setSelectedMethod(method.id)}
                      className={`p-3 border rounded-md flex flex-col items-center justify-center transition-colors ${selectedMethod === method.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <span className="text-2xl mb-1">{method.logo}</span>
                      <span className="text-sm font-medium">{method.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={createPayment}
                disabled={!selectedMethod || isCreatingPayment}
                className={`w-full py-2 px-4 rounded-md text-white font-medium ${!selectedMethod || isCreatingPayment ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isCreatingPayment ? 'Memproses...' : 'Bayar Sekarang'}
              </button>
            </>
          ) : (
            <>
              <div className="mb-4 text-center">
                <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
                  <p>Status: {paymentStatus || 'PENDING'}</p>
                  <p>Waktu tersisa: {formatTime(countdown)}</p>
                </div>

                {paymentCharge.qr_code && (
                  <div className="mb-4 flex flex-col items-center">
                    <p className="text-gray-700 mb-2">Scan QR Code:</p>
                    <div className="border p-2 inline-block">
                      <img src={paymentCharge.qr_code} alt="QR Code" width={200} height={200} />
                    </div>
                  </div>
                )}

                {paymentCharge.checkout_url && (
                  <button
                    onClick={openPaymentUrl}
                    className="w-full py-2 px-4 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium mb-2 flex items-center justify-center"
                  >
                    <GlobeAltIcon className="h-5 w-5 mr-2" />
                    Buka Halaman Pembayaran
                  </button>
                )}

                {paymentCharge.deep_link && (
                  <button
                    onClick={openPaymentUrl}
                    className="w-full py-2 px-4 rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium flex items-center justify-center"
                  >
                    <DevicePhoneMobileIcon className="h-5 w-5 mr-2" />
                    Buka Aplikasi
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}