"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { XCircleIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'

export default function PaymentErrorPage() {
  const router = useRouter()

  useEffect(() => {
    // You can add analytics tracking or other logic here
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pembayaran Gagal</h1>
        <p className="text-gray-600 mb-6">
          Maaf, terjadi kesalahan saat memproses pembayaran Anda. Silakan coba lagi atau pilih metode pembayaran lain.
        </p>
        <Button 
          onClick={() => router.push('/cashier')} 
          className="w-full bg-red-600 hover:bg-red-700"
        >
          Kembali ke Kasir
        </Button>
      </div>
    </div>
  )
}