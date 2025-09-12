'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa'
import LoadingSpinner from '@/components/LoadingSpinner'

type Transaction = {
  id: string
  total: number
  paymentMethod: string
  status: string
  paymentStatus: string
  createdAt: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
}

export default function BankTransfersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard')
      toast.error('Hanya admin yang dapat mengakses halaman ini')
    } else if (status === 'authenticated') {
      fetchPendingTransactions()
    }
  }, [status, session, router])

  const fetchPendingTransactions = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/transactions?paymentMethod=BANK_TRANSFER&status=PENDING')
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }
      
      const data = await response.json()
      setTransactions(data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      toast.error('Gagal memuat data transaksi')
    } finally {
      setLoading(false)
    }
  }

  const confirmPayment = async (transactionId: string) => {
    try {
      setConfirming(transactionId)
      
      const response = await fetch('/api/payments/bank-transfer/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionId })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to confirm payment')
      }
      
      toast.success('Pembayaran berhasil dikonfirmasi')
      
      // Refresh the transaction list
      fetchPendingTransactions()
    } catch (error) {
      console.error('Error confirming payment:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal mengkonfirmasi pembayaran')
    } finally {
      setConfirming(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size={40} />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Konfirmasi Pembayaran Transfer Bank</h1>
      
      {transactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">Tidak ada transaksi pembayaran transfer bank yang menunggu konfirmasi.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Transaksi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{transaction.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(transaction.createdAt)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.customerName || 'Pelanggan Umum'}
                    {transaction.customerPhone && <div className="text-xs">{transaction.customerPhone}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(transaction.total)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Menunggu Konfirmasi
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => confirmPayment(transaction.id)}
                      disabled={confirming === transaction.id}
                      className="text-green-600 hover:text-green-900 mr-4 disabled:opacity-50"
                    >
                      {confirming === transaction.id ? (
                        <span className="flex items-center">
                          <LoadingSpinner size={16} />
                          <span className="ml-1">Memproses...</span>
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <FaCheckCircle className="mr-1" />
                          Konfirmasi
                        </span>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}