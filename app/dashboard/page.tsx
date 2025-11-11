"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import useSWR from 'swr'
import Navbar from '@/components/Navbar'
import {
  ShoppingCartIcon,
  CubeIcon,
  ChartBarIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  TagIcon,
  UserGroupIcon,
  TicketIcon,
  ReceiptPercentIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface DashboardStats {
  todaySales: number
  totalProducts: number
  totalTransactions: number
  lowStockItems: number
  recentTransactions: any[]
  topProducts: any[]
  salesByCategory: any[]
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    totalProducts: 0,
    totalTransactions: 0,
    lowStockItems: 0,
    recentTransactions: [],
    topProducts: [],
    salesByCategory: [],
  })
  const [loading, setLoading] = useState(true)

  // Fetcher function for SWR
  const fetcher = async (url: string) => {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
    if (!response.ok) {
      throw new Error('Failed to fetch data')
    }
    return response.json()
  }

  // Fetch dashboard stats with SWR for real-time updates
  const { data: dashboardData, error: dashboardError, isLoading: dashboardLoading, mutate } = useSWR(
    '/api/dashboard/stats', 
    fetcher, 
    {
      refreshInterval: 2000, // Refresh every 2 seconds untuk data lebih real-time
      revalidateOnFocus: true,
      dedupingInterval: 0, // Tidak menggunakan deduping untuk memastikan data selalu baru
      revalidateOnReconnect: true, // Revalidasi saat koneksi terhubung kembali
      revalidateIfStale: true,
      revalidateOnMount: true,
      shouldRetryOnError: true,
      errorRetryInterval: 1000,
      focusThrottleInterval: 1000
    }
  )
  
  // Function to manually refresh dashboard data
  const refreshDashboardStats = () => {
    setLoading(true)
    mutate() // This triggers a revalidation of the SWR cache
    toast.success('Memperbarui data dashboard...')
  }
  
  // Function to reset transaction data
  const resetTransactionData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/reset', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      })
      
      if (response.ok) {
        toast.success('Data transaksi berhasil direset')
        // Force revalidation of the SWR cache
        await mutate({ 
          revalidate: true, 
          populateCache: true,
          rollbackOnError: false
        })
      } else {
        const error = await response.json()
        toast.error(error.message || 'Gagal mereset data transaksi')
      }
    } catch (error) {
      console.error('Error resetting transaction data:', error)
      toast.error('Gagal mereset data transaksi')
    } finally {
      setLoading(false)
    }
  }

  // Update stats when data is available
  useEffect(() => {
    if (dashboardData) {
      setStats(dashboardData)
      setLoading(false)
    }
  }, [dashboardData])

  // Set loading state
  useEffect(() => {
    setLoading(dashboardLoading)
  }, [dashboardLoading])

  // Handle errors with fallback data
  useEffect(() => {
    if (dashboardError) {
      console.error('Error fetching dashboard stats:', dashboardError)
      toast.error('Gagal memuat statistik dashboard')
      // Fallback to sample data
      setStats({
        todaySales: 0,
        totalProducts: 0,
        totalTransactions: 0,
        lowStockItems: 0,
        recentTransactions: [],
        topProducts: [],
        salesByCategory: [],
      })
      setLoading(false)
    }
  }, [dashboardError])

  const menuItems = [
    {
      title: 'Kasir',
      description: 'Proses transaksi penjualan',
      icon: ShoppingCartIcon,
      href: '/cashier',
      color: 'bg-blue-500',
      roles: ['ADMIN', 'CASHIER']
    },
    {
      title: 'Produk',
      description: 'Kelola menu dan produk',
      icon: CubeIcon,
      href: '/products',
      color: 'bg-green-500',
      roles: ['ADMIN', 'CASHIER']
    },
    {
      title: 'Kategori',
      description: 'Kelola kategori produk',
      icon: TagIcon,
      href: '/categories',
      color: 'bg-purple-500',
      roles: ['ADMIN']
    },
    {
      title: 'Laporan',
      description: 'Lihat laporan penjualan',
      icon: ChartBarIcon,
      href: '/reports',
      color: 'bg-yellow-500',
      roles: ['ADMIN', 'CASHIER']
    },
    {
      title: 'Transaksi',
      description: 'Riwayat transaksi',
      icon: ClipboardDocumentListIcon,
      href: '/transactions',
      color: 'bg-red-500',
      roles: ['ADMIN', 'CASHIER']
    },
    {
      title: 'Biaya Operasional',
      description: 'Kelola biaya operasional',
      icon: BanknotesIcon,
      href: '/operational-expenses',
      color: 'bg-amber-500',
      roles: ['ADMIN']
    },
    {
      title: 'Pengguna',
      description: 'Kelola pengguna sistem',
      icon: UsersIcon,
      href: '/users',
      color: 'bg-indigo-500',
      roles: ['ADMIN']
    },
    {
      title: 'Member',
      description: 'Kelola data member',
      icon: UserGroupIcon,
      href: '/members',
      color: 'bg-teal-500',
      roles: ['ADMIN']
    },
    {
      title: 'Voucher',
      description: 'Kelola voucher dan kupon',
      icon: TicketIcon,
      href: '/vouchers',
      color: 'bg-orange-500',
      roles: ['ADMIN']
    },
    {
      title: 'Promosi',
      description: 'Kelola diskon dan promosi',
      icon: ReceiptPercentIcon,
      href: '/promotions',
      color: 'bg-pink-500',
      roles: ['ADMIN']
    },
  ]

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount)
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const userRole = session.user.role
  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Selamat datang, {session.user.name}!
          </h1>
          <p className="text-gray-600 mt-2">
            Dashboard POS System - {userRole === 'ADMIN' ? 'Administrator' : 'Kasir'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BanknotesIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Penjualan Hari Ini</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
                  ) : (
                    formatCurrency(stats.todaySales)
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CubeIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Produk</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                  ) : (
                    stats.totalProducts
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClipboardDocumentListIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Transaksi Hari Ini</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                  ) : (
                    stats.totalTransactions
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-semibold text-sm">!</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Stok Menipis</p>
                <p className="text-2xl font-semibold text-red-600">
                  {loading ? (
                    <div className="animate-pulse bg-gray-200 h-8 w-16 rounded"></div>
                  ) : (
                    stats.lowStockItems
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMenuItems.map((item) => {
            const IconComponent = item.icon
            return (
              <Link
                key={item.title}
                href={item.href}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 p-6 group"
              >
                <div className="flex items-center">
                  <div className={`flex-shrink-0 p-3 rounded-lg ${item.color}`}>
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm">{item.description}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Recent Activity */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Transaksi Terbaru</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : stats.recentTransactions && stats.recentTransactions.length > 0 ? (
              <div className="space-y-3">
                {stats.recentTransactions.map((transaction: any) => (
                  <div key={transaction.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">
                        {transaction.member?.name || transaction.customerName || 'GUEST'}
                      </p>
                      {transaction.customerPhone && (
                        <p className="text-xs text-gray-500">
                          HP: {transaction.customerPhone}
                        </p>
                      )}
                      {transaction.customerEmail && (
                        <p className="text-xs text-gray-500">
                          Email: {transaction.customerEmail}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Kasir: {transaction.user?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const createdAt = transaction.createdAt ? new Date(transaction.createdAt) : new Date()
                          const isValidDate = createdAt instanceof Date && !isNaN(createdAt.getTime())
                          const validDate = isValidDate ? createdAt : new Date()
                          return validDate.toLocaleString('id-ID')
                        })()} 
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.items.length} item(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {formatCurrency(transaction.total)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {transaction.paymentMethod}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Belum ada transaksi hari ini</p>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Produk Terlaris</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : stats.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.topProducts.map((item: any, index: number) => (
                  <div key={item.product?.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.product?.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.product?.price || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-blue-600">
                        {item.totalSold} terjual
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">Belum ada data penjualan</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Aksi Cepat</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/cashier"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Mulai Transaksi
            </Link>
            {userRole === 'ADMIN' && (
              <Link
                href="/products/new"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Tambah Produk
              </Link>
            )}
            <Link
              href="/reports"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Lihat Laporan
            </Link>
            <button
              onClick={refreshDashboardStats}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Refresh Data
            </button>
            {userRole === 'ADMIN' && (
              <button
                onClick={resetTransactionData}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-5 w-5 mr-2 border-t-2 border-white rounded-full" />
                    Memuat...
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-5 w-5 mr-2" />
                    Reset Transaksi
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}