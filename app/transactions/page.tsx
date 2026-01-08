"use client"

import { useState, useEffect } from 'react'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PrinterIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  QuestionMarkCircleIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'
import ReceiptPreview from '../../components/ReceiptPreview'
import Navbar from '@/components/Navbar'
import { toast } from 'react-hot-toast'
import { apiFetch } from '@/lib/api'

interface Transaction {
  id: string
  date: string
  time: string
  items: TransactionItem[]
  subtotal: number
  tax: number
  total: number
  voucherDiscount?: number
  promoDiscount?: number
  voucherCode?: string
  paymentMethod: 'CASH' | 'CARD' | 'QRIS' | 'VIRTUAL_ACCOUNT' | 'CONVENIENCE_STORE' | 'PAYLATER'
  status: 'COMPLETED' | 'CANCELLED' | 'PENDING' | 'REFUNDED'
  cashier: string
  customer?: string
  customerPhone?: string
  customerEmail?: string
  member?: {
    id: number
    name: string
    phone: string
    email: string
    points: number
  }
}

interface TransactionItem {
  id: string
  name: string
  quantity: number
  price: number
  total: number
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('ALL')
  const [customRange, setCustomRange] = useState<{ from: Date | null; to: Date | null }>({ from: null, to: null })
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [receiptTransaction, setReceiptTransaction] = useState<Transaction | null>(null)
  const [showRefundModal, setShowRefundModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [actionTransaction, setActionTransaction] = useState<Transaction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)

  // Fetch transactions from API using SWR for real-time updates
  const fetcher = async (url: string) => {
    const response = await apiFetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch transactions')
    }
    return response.json()
  }

  const { data, error, isLoading, mutate } = useSWR('/api/v1/transactions', fetcher, {
    refreshInterval: 5000, // Refresh every 5 seconds
    revalidateOnFocus: true,
    dedupingInterval: 2000
  })

  // Transform API data to match component interface
  const transformTransactions = (data: any): Transaction[] => {
    if (!data || !data.transactions) return []
    
    return data.transactions.map((transaction: any) => {
      const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : new Date()
      const isValidDate = createdAt instanceof Date && !isNaN(createdAt.getTime())
      const validDate = isValidDate ? createdAt : new Date()
      
      // Get voucher code from voucher usages
      const voucherUsage = transaction.voucherUsages && transaction.voucherUsages.length > 0 
        ? transaction.voucherUsages[0] 
        : null
      
      return {
        id: transaction.id,
        date: validDate.toISOString(),
        time: validDate.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Jakarta'
        }),
        items: transaction.items.map((item: any) => ({
          id: item.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          total: item.subtotal
        })),
        subtotal: transaction.total,
        tax: transaction.tax,
        total: transaction.finalTotal,
        voucherDiscount: transaction.voucherDiscount || 0,
        promoDiscount: transaction.promoDiscount || 0,
        voucherCode: voucherUsage?.voucher?.code || null,
        paymentMethod: transaction.paymentMethod,
        status: transaction.status,
        cashier: transaction.user?.name || 'Unknown',
        customer: transaction.customerName || transaction.member?.name,
        customerPhone: transaction.customerPhone || transaction.member?.phone,
        customerEmail: transaction.customerEmail || transaction.member?.email,
        member: transaction.member ? {
          id: transaction.member.id,
          name: transaction.member.name,
          phone: transaction.member.phone,
          email: transaction.member.email,
          points: transaction.member.points
        } : undefined
      }
    })
  }

  // Set transactions data from SWR
  useEffect(() => {
    if (data) {
      const transformedTransactions = transformTransactions(data)
      setTransactions(transformedTransactions)
      setLoading(false)
    }
  }, [data])

  // Set loading state based on SWR loading state
  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading])

  // Handle errors without using fallback data
  useEffect(() => {
    if (error) {
      console.error('Error fetching transactions:', error)
      // Don't use sample data, just show empty state
      setTransactions([])
      setLoading(false)
    }
  }, [error])

  // No sample data needed anymore

  // Filter transactions based on search and filters
  useEffect(() => {
    let filtered = transactions

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (transaction) =>
          transaction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transaction.cashier.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transaction.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          transaction.items.some((item) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((transaction) => transaction.status === statusFilter)
    }

    // Payment method filter
    if (paymentFilter !== 'ALL') {
      // Ensure we're comparing the same format of payment method
      filtered = filtered.filter((transaction) => {
        // Normalize payment method names for comparison
        const normalizedTransactionPayment = transaction.paymentMethod.toUpperCase();
        const normalizedFilterPayment = paymentFilter.toUpperCase();
        return normalizedTransactionPayment === normalizedFilterPayment;
      })
    }

    // Date filter
    const getJakartaKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
    if (dateFilter !== 'ALL') {
      const todayKey = getJakartaKey(new Date())
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayKey = getJakartaKey(yesterday)
      filtered = filtered.filter((transaction) => {
        const tKey = getJakartaKey(new Date(transaction.date))
        if (dateFilter === 'TODAY') return tKey === todayKey
        if (dateFilter === 'YESTERDAY') return tKey === yesterdayKey
        if (dateFilter === 'CUSTOM' && customRange.from && customRange.to) {
          const fromKey = getJakartaKey(customRange.from)
          const toKey = getJakartaKey(customRange.to)
          return tKey >= fromKey && tKey <= toKey
        }
        return true
      })
    }

    setFilteredTransactions(filtered)
  }, [transactions, searchTerm, statusFilter, paymentFilter, dateFilter])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    const date = dateString ? new Date(dateString) : new Date()
    const isValidDate = date instanceof Date && !isNaN(date.getTime())
    const validDate = isValidDate ? date : new Date()
    return validDate.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />
      case 'CANCELLED':
        return <XCircleIcon className="h-5 w-5 text-red-500" />
      case 'PENDING':
        return (
          <div className="flex items-center">
            <ClockIcon className="h-5 w-5 text-yellow-500" />
            <Link href="/cashier/help" className="ml-1">
              <QuestionMarkCircleIcon className="h-4 w-4 text-blue-500 hover:text-blue-700" title="Bantuan status pending" />
            </Link>
          </div>
        )
      case 'REFUNDED':
        return <ArrowUturnLeftIcon className="h-5 w-5 text-orange-500" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'REFUNDED':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH':
        return 'Tunai'
      case 'CARD':
        return 'Kartu'
      case 'QRIS':
        return 'QRIS'
      case 'VIRTUAL_ACCOUNT':
        return 'Virtual Account'
      default:
        return method
    }
  }

  const viewTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setShowModal(true)
  }

  const printReceipt = (transaction: Transaction) => {
    setReceiptTransaction(transaction)
    setShowReceiptPreview(true)
  }

  const sendReceiptWhatsApp = async (transaction: Transaction) => {
    try {
      if (sendingWhatsApp) {
        toast('Sedang mengirim...', { icon: '⏳' })
        return
      }
      setSendingWhatsApp(true)
      let phone = transaction.customerPhone || ''
      if (!phone) {
        const input = window.prompt('Masukkan nomor WhatsApp pelanggan (contoh: 62812xxxxxxxx)')
        if (!input) {
          toast('Nomor WhatsApp tidak diisi', { icon: '⚠️' })
          return
        }
        phone = input
      }
  
      const res = await apiFetch('/api/v1/whatsapp/send-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: transaction.id, phoneNumber: phone, receiptType: 'detailed' }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mengirim struk via WhatsApp')
      }
      toast.success('Struk berhasil dikirim via WhatsApp')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengirim struk via WhatsApp')
    } finally {
      setSendingWhatsApp(false)
    }
  }
  const handlePrintComplete = () => {
    setShowReceiptPreview(false)
    setReceiptTransaction(null)
    console.log('Receipt printed successfully')
  }

  const handleRefund = (transaction: Transaction) => {
    setActionTransaction(transaction)
    setShowRefundModal(true)
  }

  const handleCancel = (transaction: Transaction) => {
    setActionTransaction(transaction)
    setShowCancelModal(true)
  }

  const confirmRefund = async () => {
    if (!actionTransaction) return
    
    setActionLoading(true)
    try {
      const response = await apiFetch(`/api/v1/transactions/${actionTransaction.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        mutate() // Refresh data
        setShowRefundModal(false)
        setActionTransaction(null)
        alert('Transaksi berhasil di-refund')
      } else {
        alert('Gagal melakukan refund')
      }
    } catch (error) {
      console.error('Error refunding transaction:', error)
      alert('Terjadi kesalahan saat melakukan refund')
    } finally {
      setActionLoading(false)
    }
  }

  const confirmCancel = async () => {
    if (!actionTransaction) return
    
    setActionLoading(true)
    try {
      const response = await apiFetch(`/api/v1/transactions/${actionTransaction.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        mutate() // Refresh data
        setShowCancelModal(false)
        setActionTransaction(null)
        alert('Transaksi berhasil dibatalkan')
      } else {
        alert('Gagal membatalkan transaksi')
      }
    } catch (error) {
      console.error('Error cancelling transaction:', error)
      alert('Terjadi kesalahan saat membatalkan transaksi')
    } finally {
      setActionLoading(false)
    }
  }

  const handleConfirmCardPayment = async (transaction: Transaction) => {
    setActionTransaction(transaction)
    setActionLoading(true)
    try {
      const response = await apiFetch('/api/v1/payments/card/confirm', {
        method: 'POST',
        body: JSON.stringify({ transactionId: transaction.id })
      })
      if (response.ok) {
        mutate()
        alert('Pembayaran Kartu dikonfirmasi dan stok dikurangi')
      } else {
        const data = await response.json().catch(() => ({}))
        alert(data?.message || 'Gagal mengkonfirmasi pembayaran Kartu')
      }
    } catch (error) {
      console.error('Error confirming card payment:', error)
      alert('Terjadi kesalahan saat mengkonfirmasi pembayaran Kartu')
    } finally {
      setActionLoading(false)
      setActionTransaction(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/" className="mr-4">
                <ArrowLeftIcon className="h-6 w-6 text-gray-600 hover:text-gray-900" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Riwayat Transaksi</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Cari transaksi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Semua Status</option>
              <option value="COMPLETED">Selesai</option>
              <option value="PENDING">Pending</option>
              <option value="CANCELLED">Dibatalkan</option>
              <option value="REFUNDED">Dikembalikan</option>
            </select>

            {/* Payment Method Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">Semua Pembayaran</option>
              <option value="CASH">Tunai</option>
              <option value="CARD">Kartu</option>
              <option value="QRIS">QRIS</option>
              <option value="VIRTUAL_ACCOUNT">Virtual Account</option>
            </select>

            {/* Date Filter */}
            <div className="flex flex-col gap-2">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="ALL">Semua Tanggal</option>
                <option value="TODAY">Hari Ini</option>
                <option value="YESTERDAY">Kemarin</option>
                <option value="CUSTOM">Rentang Khusus</option>
              </select>
              {dateFilter === 'CUSTOM' && (
                <DateRangePicker
                  dateRange={{ from: customRange.from || new Date(), to: customRange.to || new Date() }}
                  onDateRangeChange={(range) => {
                    if (range?.from && range?.to) {
                      setCustomRange({ from: range.from, to: range.to })
                    }
                  }}
                />
              )}
            </div>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('ALL')
                setPaymentFilter('ALL')
                setDateFilter('ALL')
              }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset Filter
            </button>
          </div>
        </div>

        {/* Active Filter Feedback */}
        <div className="mb-2 text-sm text-gray-600">
          {dateFilter === 'TODAY' && 'Filter tanggal: Hari ini'}
          {dateFilter === 'YESTERDAY' && 'Filter tanggal: Kemarin'}
          {dateFilter === 'CUSTOM' && customRange.from && customRange.to && `Filter tanggal: ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta' }).format(customRange.from)} - ${new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta' }).format(customRange.to)}`}
          {dateFilter === 'ALL' && 'Filter tanggal: Semua'}
        </div>
        {/* Transactions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID Transaksi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tanggal & Waktu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pembayaran
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kasir
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[160px] sm:max-w-none">
                          {transaction.id}
                        </div>
                        {transaction.customer && (
                          <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[180px] sm:max-w-none break-words">
                            {transaction.customer}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(transaction.date)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {transaction.time}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs sm:text-sm text-gray-900">
                          {transaction.items.length} item(s)
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 line-clamp-2 break-words">
                          {transaction.items.slice(0, 2).map((item, index) => (
                            <div key={index} className="truncate">
                              {item.name} x{item.quantity}
                            </div>
                          ))}
                          {transaction.items.length > 2 && (
                            <div className="text-xs text-gray-400">
                              +{transaction.items.length - 2} lainnya
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(transaction.total)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {getPaymentMethodLabel(transaction.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                          {getStatusIcon(transaction.status)}
                          <span className="ml-1">
                            {transaction.status === 'COMPLETED' ? 'Selesai' :
                             transaction.status === 'PENDING' ? 'Pending' :
                             transaction.status === 'REFUNDED' ? 'Dikembalikan' : 'Dibatalkan'}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900 truncate max-w-[160px] sm:max-w-none">
                        {transaction.cashier}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => viewTransaction(transaction)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Lihat Detail"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => printReceipt(transaction)}
                            className="text-green-600 hover:text-green-900"
                            title="Cetak Struk"
                          >
                            <PrinterIcon className="h-5 w-5" />
                          </button>
                          {transaction.status === 'COMPLETED' && (
                            <button
                              onClick={() => handleRefund(transaction)}
                              className="text-orange-600 hover:text-orange-900"
                              title="Refund/Retur"
                            >
                              <ArrowUturnLeftIcon className="h-5 w-5" />
                            </button>
                          )}
                          {(transaction.status === 'COMPLETED' || transaction.status === 'PENDING') && (
                            <button
                              onClick={() => handleCancel(transaction)}
                              className="text-red-600 hover:text-red-900"
                              title="Batalkan Transaksi"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          )}
                          {transaction.paymentMethod === 'CARD' && transaction.status === 'PENDING' && (
                            <button
                              onClick={() => handleConfirmCardPayment(transaction)}
                              className="text-teal-600 hover:text-teal-900"
                              title="Konfirmasi Pembayaran"
                            >
                              {/* Check icon */}
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                                <path fillRule="evenodd" d="M2.25 12a9.75 9.75 0 1119.5 0 9.75 9.75 0 01-19.5 0zm14.03-2.28a.75.75 0 00-1.06-1.06l-4.72 4.72-2.22-2.22a.75.75 0 10-1.06 1.06l2.75 2.75c.3.3.78.3 1.06 0l5.25-5.25z" clipRule="evenodd" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Tidak ada transaksi yang ditemukan</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Transaction Detail Modal */}
      {showModal && selectedTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Detail Transaksi {selectedTransaction.id}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Transaction Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tanggal & Waktu</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(selectedTransaction.date)} {selectedTransaction.time}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Kasir</p>
                    <p className="text-sm text-gray-900">{selectedTransaction.cashier}</p>
                  </div>
                  {selectedTransaction.customer && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Pelanggan</p>
                      <p className="text-sm text-gray-900">{selectedTransaction.customer}</p>
                      {selectedTransaction.customerPhone && (
                        <p className="text-sm text-gray-600">No. HP: {selectedTransaction.customerPhone}</p>
                      )}
                      {selectedTransaction.customerEmail && (
                        <p className="text-sm text-gray-600">Email: {selectedTransaction.customerEmail}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTransaction.status)}`}>
                      {getStatusIcon(selectedTransaction.status)}
                      <span className="ml-1">
                        {selectedTransaction.status === 'COMPLETED' ? 'Selesai' :
                         selectedTransaction.status === 'PENDING' ? 'Pending' :
                         selectedTransaction.status === 'REFUNDED' ? 'Dikembalikan' : 'Dibatalkan'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Item Pembelian</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Produk
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Harga
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedTransaction.items.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatCurrency(item.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Subtotal:</span>
                      <span className="text-sm text-gray-900">
                        {formatCurrency(selectedTransaction.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Pajak:</span>
                      <span className="text-sm text-gray-900">
                        {formatCurrency(selectedTransaction.tax)}
                      </span>
                    </div>
                    {selectedTransaction.voucherDiscount && selectedTransaction.voucherDiscount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-green-600">
                          Diskon Voucher {selectedTransaction.voucherCode ? `(${selectedTransaction.voucherCode})` : ''}:
                        </span>
                        <span className="text-sm text-green-600">
                          -{formatCurrency(selectedTransaction.voucherDiscount)}
                        </span>
                      </div>
                    )}
                    {selectedTransaction.promoDiscount && selectedTransaction.promoDiscount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-blue-600">Diskon Promosi:</span>
                        <span className="text-sm text-blue-600">
                          -{formatCurrency(selectedTransaction.promoDiscount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span className="text-base text-gray-900">Total:</span>
                      <span className="text-base text-gray-900">
                        {formatCurrency(selectedTransaction.total)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Metode Pembayaran:</span>
                      <span className="text-sm text-gray-900">
                        {getPaymentMethodLabel(selectedTransaction.paymentMethod)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => printReceipt(selectedTransaction)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <PrinterIcon className="h-5 w-5 mr-2" />
                    Cetak Struk
                  </button>
                  <button
                    onClick={() => sendReceiptWhatsApp(selectedTransaction)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                    Kirim ulang ke WhatsApp
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {showReceiptPreview && receiptTransaction && (
        <ReceiptPreview
          transaction={receiptTransaction}
          isOpen={showReceiptPreview}
          onClose={() => setShowReceiptPreview(false)}
          onPrint={handlePrintComplete}
        />
      )}

      {/* Refund Confirmation Modal */}
      {showRefundModal && actionTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Konfirmasi Refund
            </h3>
            <p className="text-gray-600 mb-6">
              Apakah Anda yakin ingin melakukan refund untuk transaksi <strong>{actionTransaction.id}</strong>?
              <br /><br />
              Total yang akan di-refund: <strong>{formatCurrency(actionTransaction.total)}</strong>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRefundModal(false)
                  setActionTransaction(null)
                }}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={actionLoading}
              >
                Batal
              </button>
              <button
                onClick={confirmRefund}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? 'Memproses...' : 'Ya, Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && actionTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Konfirmasi Batalkan Transaksi
            </h3>
            <p className="text-gray-600 mb-6">
              Apakah Anda yakin ingin membatalkan transaksi <strong>{actionTransaction.id}</strong>?
              <br /><br />
              <span className="text-red-600 font-medium">Peringatan: Tindakan ini tidak dapat dibatalkan!</span>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setActionTransaction(null)
                }}
                className="px-4 py-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                disabled={actionLoading}
              >
                Batal
              </button>
              <button
                onClick={confirmCancel}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                disabled={actionLoading}
              >
                {actionLoading ? 'Memproses...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
