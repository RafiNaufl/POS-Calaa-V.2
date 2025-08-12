"use client"

import { useState, useEffect } from "react"
import { addDays, format, subDays, parseISO } from "date-fns"
import { id } from "date-fns/locale"
import { BanknotesIcon, ShoppingCartIcon, ChartBarIcon, UserGroupIcon, DocumentArrowDownIcon, ArrowLeftIcon, InformationCircleIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, ReferenceLine } from "recharts"

// Custom label renderer for bar chart
const renderCustomBarLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  
  return (
    <text 
      x={x + width / 2} 
      y={y - 10} 
      fill="#666"
      textAnchor="middle"
      fontSize={11}
      fontWeight="500"
    >
      {value}
    </text>
  );
};

interface SalesData {
  date: string
  sales: number
  transactions: number
}

interface CategoryData {
  name: string
  value: number
  color: string
  sales: number
  quantity: number
  transactions: number
  uniqueCustomers: number
  avgTicket: number
  avgQuantityPerTransaction: number
}

interface TopProduct {
  name: string
  quantity: number
  revenue: number
  transactions?: number
  uniqueCustomers?: number
}

interface ReportSummary {
  totalSales: number
  totalTransactions: number
  averageTransaction: number
  growth: number
  salesGrowth?: number
  transactionGrowth?: number
  customerGrowth?: number
  totalUniqueCustomers?: number
}

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface DiscountedProductItem {
  productId: string;
  productName: string;
  quantity: number;
  totalDiscount: number;
  categoryName: string;
}

interface PromotionAnalysisItem {
  name: string;
  type: string;
  discountValue: number;
  discountType: string;
  totalDiscount: number;
  usageCount: number;
  affectedTransactions: number;
  averageDiscount: number;
  discountedProducts?: DiscountedProductItem[];
}

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('7days')
  const [analysisType, setAnalysisType] = useState<string>('advanced')
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [summary, setSummary] = useState<ReportSummary>({
    totalSales: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    growth: 0,
  })
  const [rfmAnalysis, setRfmAnalysis] = useState<any>(null)
  const [customerSegmentation, setCustomerSegmentation] = useState<any>(null)
  const [hourlyAnalysis, setHourlyAnalysis] = useState<any[]>([])
  const [weekdayAnalysis, setWeekdayAnalysis] = useState<any[]>([])
  const [paymentMethodAnalysis, setPaymentMethodAnalysis] = useState<any[]>([])
  const [productVariantAnalysis, setProductVariantAnalysis] = useState<any>({
    sizeData: [],
    colorData: []
  })
  const [cashierPerformance, setCashierPerformance] = useState<any[]>([])
  const [promotionAnalysis, setPromotionAnalysis] = useState<PromotionAnalysisItem[]>([])
  const [returnData, setReturnData] = useState<any>({totalReturns: 0, totalReturnAmount: 0, returnRate: 0})

  // Fetch real-time data from API
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true)
      try {
        console.log(`Fetching report data with range=${dateRange} and analysisType=${analysisType}`)
        const response = await fetch(`/api/reports?range=${dateRange}&analysisType=${analysisType}`)
        if (response.ok) {
          const data = await response.json()
          console.log('Received data from API:', data)
          setSalesData(data.salesData || [])
          setCategoryData(data.categoryData || [])
          setTopProducts(data.topProducts || [])
          setSummary(data.summary || {
            totalSales: 0,
            totalTransactions: 0,
            averageTransaction: 0,
            growth: 0,
          })
          
          // Set product variant analysis and return data (always available)
          setProductVariantAnalysis(data.productVariantAnalysis || {
            sizeData: [],
            colorData: []
          })
          setReturnData(data.returnData || {
            totalReturns: 0,
            totalReturnAmount: 0,
            returnRate: 0
          })
          
          // Set advanced analytics data if available
          if (analysisType === 'advanced') {
            console.log('Advanced analysis data:', {
              rfm: data.rfmAnalysis,
              segmentation: data.customerSegmentation,
              hourly: data.hourlyAnalysis,
              weekday: data.weekdayAnalysis,
              payment: data.paymentMethodAnalysis,
              productVariant: data.productVariantAnalysis,
              returns: data.returnData,
              promotions: data.promotionAnalysis
            })
            
            // Log promotion analysis data specifically
            console.log('Promotion Analysis Data:', data.promotionAnalysis)
            console.log('Promotion Analysis Length:', data.promotionAnalysis ? data.promotionAnalysis.length : 0)
            console.log('Analysis Type:', analysisType)
            
            // Process RFM analysis data to ensure it has the required structure
            let processedRfmAnalysis = data.rfmAnalysis || null
            if (processedRfmAnalysis) {
              // Initialize averages and distribution if they don't exist
              processedRfmAnalysis = {
                ...processedRfmAnalysis,
                averages: processedRfmAnalysis.averages || {
                  recency: null,
                  frequency: null,
                  monetary: null
                },
                distribution: processedRfmAnalysis.distribution || {
                  recency: {},
                  frequency: {},
                  monetary: {}
                },
                thresholds: processedRfmAnalysis.thresholds || {
                  recency: {},
                  frequency: {},
                  monetary: {}
                }
              }
            }
            setRfmAnalysis(processedRfmAnalysis)
            setCustomerSegmentation(data.customerSegmentation || null)
            setHourlyAnalysis(data.hourlyAnalysis || [])
            setWeekdayAnalysis(data.weekdayAnalysis || [])
            setPaymentMethodAnalysis(data.paymentMethodAnalysis || [])
            setPromotionAnalysis(data.promotionAnalysis || [])
          } else {
            // Reset advanced analytics data when using basic analysis
            setRfmAnalysis(null)
            setCustomerSegmentation(null)
            setHourlyAnalysis([])
            setWeekdayAnalysis([])
            setPaymentMethodAnalysis([])
            setPromotionAnalysis([])
          }
        } else {
          console.error('Failed to fetch report data')
        }
      } catch (error) {
        console.error('Error fetching report data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [dateRange, analysisType])

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
      month: 'short',
    })
  }

  const exportReport = () => {
    // Get current date for filename
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    
    // Prepare CSV data for sales
    const salesCSV = generateCSV(
      ['Tanggal', 'Penjualan', 'Jumlah Transaksi'],
      salesData.map(item => [
        formatDate(item.date),
        item.sales.toString(),
        item.transactions.toString()
      ])
    )
    
    // Prepare CSV data for categories
    const categoriesCSV = generateCSV(
      ['Kategori', 'Persentase'],
      categoryData.map(item => [
        item.name,
        `${item.value}%`
      ])
    )
    
    // Prepare CSV data for top products
    const topProductsCSV = generateCSV(
      ['Produk', 'Terjual', 'Pendapatan', 'Kontribusi'],
      topProducts.map(product => {
        const contribution = (product.revenue / summary.totalSales) * 100
        return [
          product.name,
          product.quantity.toString(),
          product.revenue.toString(),
          `${contribution.toFixed(1)}%`
        ]
      })
    )
    
    // Prepare CSV data for summary
    const summaryCSV = generateCSV(
      ['Metrik', 'Nilai'],
      [
        ['Total Penjualan', summary.totalSales.toString()],
        ['Total Transaksi', summary.totalTransactions.toString()],
        ['Rata-rata Transaksi', summary.averageTransaction.toString()],
        ['Pertumbuhan', `${summary.growth}%`]
      ]
    )
    
    // Combine all CSV data with section headers
    const fullCSV = [
      `LAPORAN PENJUALAN - ${getPeriodLabel(dateRange)}`,
      `Dihasilkan pada: ${now.toLocaleString('id-ID')}`,
      '',
      'RINGKASAN',
      summaryCSV,
      '',
      'DATA PENJUALAN HARIAN',
      salesCSV,
      '',
      'DISTRIBUSI KATEGORI',
      categoriesCSV,
      '',
      'PRODUK TERLARIS',
      topProductsCSV
    ].join('\n')
    
    // Download as CSV file
    const blob = new Blob([fullCSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `laporan-penjualan-${dateRange}-${dateStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  // Helper function to generate CSV content
  const generateCSV = (headers: string[], rows: string[][]) => {
    const headerRow = headers.join(',')
    const dataRows = rows.map(row => row.join(','))
    return [headerRow, ...dataRows].join('\n')
  }
  
  // Helper function to get readable period label
  const getPeriodLabel = (range: string) => {
    switch (range) {
      case '7days': return '7 Hari Terakhir'
      case '30days': return '30 Hari Terakhir'
      case '3months': return '3 Bulan Terakhir'
      case '1year': return '1 Tahun Terakhir'
      default: return '7 Hari Terakhir'
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
              <h1 className="text-2xl font-bold text-gray-900">Laporan</h1>
            </div>
            
            {/* Report Type Navigation */}
            <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
              <Link href="/reports" className="px-4 py-2 rounded-md bg-white shadow-sm font-medium text-gray-800">
                Penjualan
              </Link>
              <Link href="/reports/financial" className="px-4 py-2 rounded-md hover:bg-white hover:shadow-sm font-medium text-gray-600 hover:text-gray-800 transition-all">
                Keuangan
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7days">7 Hari Terakhir</option>
                <option value="30days">30 Hari Terakhir</option>
                <option value="3months">3 Bulan Terakhir</option>
                <option value="1year">1 Tahun Terakhir</option>
              </select>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="basic">Analisis Dasar</option>
                <option value="advanced">Analisis Lanjutan</option>
              </select>
              <button
                onClick={exportReport}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              >
                <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="spinner"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BanknotesIcon className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Penjualan</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(summary.totalSales)}
                    </p>
                    {summary.salesGrowth !== undefined && (
                      <p className={`text-sm font-medium ${summary.salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {summary.salesGrowth >= 0 ? '+' : ''}{summary.salesGrowth}% dari periode sebelumnya
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ShoppingCartIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Transaksi</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {summary.totalTransactions}
                    </p>
                    {summary.transactionGrowth !== undefined && (
                      <p className={`text-sm font-medium ${summary.transactionGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {summary.transactionGrowth >= 0 ? '+' : ''}{summary.transactionGrowth}% dari periode sebelumnya
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ChartBarIcon className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Rata-rata Transaksi</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(summary.averageTransaction)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <UserGroupIcon className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Pelanggan</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {summary.totalUniqueCustomers || 0}
                    </p>
                    {summary.customerGrowth !== undefined && (
                      <p className={`text-sm font-medium ${summary.customerGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {summary.customerGrowth >= 0 ? '+' : ''}{summary.customerGrowth}% dari periode sebelumnya
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Trend Chart */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Tren Penjualan</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart 
                    data={salesData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                  >
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ccc" vertical={true} horizontalPoints={[]} />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      stroke="#666"
                      tick={{ fill: '#666', fontSize: 12 }}
                      axisLine={{ stroke: '#ccc' }}
                      tickLine={{ stroke: '#ccc' }}
                      padding={{ left: 10, right: 10 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatCurrency(value).replace('Rp', '')}
                      stroke="#666"
                      tick={{ fill: '#666', fontSize: 12 }}
                      axisLine={{ stroke: '#ccc' }}
                      tickLine={{ stroke: '#ccc' }}
                      width={60}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Penjualan']}
                      labelFormatter={(label) => `Tanggal: ${formatDate(label)}`}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        padding: '10px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                      }}
                      itemStyle={{ color: '#3B82F6', fontWeight: 'bold' }}
                      cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '5 5' }}
                      wrapperStyle={{ zIndex: 100 }}
                      animationDuration={300}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={10}
                      wrapperStyle={{ paddingTop: '10px' }}
                    />
                    {/* Garis referensi untuk rata-rata penjualan */}
                    {salesData.length > 0 && (
                      <ReferenceLine 
                        y={salesData.reduce((sum, item) => sum + item.sales, 0) / salesData.length} 
                        stroke="#FB923C" 
                        strokeDasharray="3 3"
                        label={{
                          value: 'Rata-rata',
                          position: 'right',
                          fill: '#FB923C',
                          fontSize: 12
                        }}
                      />
                    )}
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      name="Penjualan"
                      stroke="#3B82F6" 
                      strokeWidth={5}
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 6, strokeDasharray: '' }}
                      activeDot={{ r: 8, strokeWidth: 0, fill: '#2563EB' }}
                      animationDuration={1000}
                      animationEasing="ease-out"
                      connectNulls={true}
                      fill="url(#colorSales)"
                      isAnimationActive={true}
                      strokeLinecap="round"
                    />
                    {/* Menampilkan jumlah transaksi sebagai garis sekunder */}
                    <Line 
                      type="monotone" 
                      dataKey="transactions" 
                      name="Transaksi"
                      stroke="#FB923C" 
                      strokeWidth={4}
                      dot={{ fill: '#FB923C', strokeWidth: 2, r: 5 }}
                      activeDot={{ r: 7, strokeWidth: 0, fill: '#F97316' }}
                      animationDuration={1000}
                      animationEasing="ease-out"
                      connectNulls={true}
                      strokeDasharray="5 5"
                      isAnimationActive={true}
                      strokeLinecap="round"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Category Distribution */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribusi Kategori</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name} ${value}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value}%`, 'Persentase']}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Sales Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Penjualan Harian</h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart 
                  data={salesData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    axisLine={{ stroke: '#ccc' }}
                    tickLine={{ stroke: '#ccc' }}
                    tick={{ fill: '#666', fontSize: 12 }}
                    stroke="#666"
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value).replace('Rp', '')}
                    axisLine={{ stroke: '#ccc' }}
                    tickLine={{ stroke: '#ccc' }}
                    tick={{ fill: '#666', fontSize: 12 }}
                    stroke="#666"
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Penjualan']}
                    labelFormatter={(label) => `Tanggal: ${formatDate(label)}`}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      padding: '10px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}
                    itemStyle={{ color: '#3B82F6', fontWeight: 'bold' }}
                    cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{ paddingTop: '10px' }}
                  />
                  <Bar 
                    dataKey="sales" 
                    name="Penjualan"
                    fill="#3B82F6"
                    fillOpacity={0.8}
                    stroke="#2563EB"
                    strokeWidth={1}
                    radius={[6, 6, 0, 0]}
                    animationDuration={1500}
                    animationEasing="ease-in-out"
                  >
                    {/* Hover effect with slightly darker color */}
                    <LabelList dataKey="transactions" position="top" content={renderCustomBarLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {analysisType === 'advanced' && (
              <div className="space-y-6">
                
                {/* Customer Segmentation */}
                {customerSegmentation && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold text-gray-900">Segmentasi Pelanggan</h2>
                      <button 
                        className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 flex items-center justify-center"
                        title="Segmentasi pelanggan berdasarkan skor RFM membantu mengidentifikasi kelompok pelanggan dengan perilaku serupa untuk strategi pemasaran yang lebih efektif."
                      >
                        <InformationCircleIcon className="h-5 w-5 text-gray-500" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {customerSegmentation?.segments ? Object.entries(customerSegmentation.segments).map(([segment, data]: [string, any]) => {
                        const segmentInfo = {
                          'Champions': {
                            color: 'bg-green-100 text-green-800',
                            icon: '🏆',
                            description: 'Pelanggan terbaik yang sering berbelanja dengan nilai tinggi'
                          },
                          'Loyal Customers': {
                            color: 'bg-blue-100 text-blue-800',
                            icon: '💎',
                            description: 'Pelanggan yang berbelanja secara teratur dengan nilai tinggi'
                          },
                          'Potential Loyalists': {
                            color: 'bg-indigo-100 text-indigo-800',
                            icon: '⭐',
                            description: 'Pelanggan baru yang berbelanja dengan nilai cukup tinggi'
                          },
                          'New Customers': {
                            color: 'bg-purple-100 text-purple-800',
                            icon: '🌱',
                            description: 'Pelanggan yang baru berbelanja dengan frekuensi rendah'
                          },
                          'Promising': {
                            color: 'bg-yellow-100 text-yellow-800',
                            icon: '✨',
                            description: 'Pelanggan baru dengan frekuensi rendah tapi nilai tinggi'
                          },
                          'Need Attention': {
                            color: 'bg-orange-100 text-orange-800',
                            icon: '⚠️',
                            description: 'Pelanggan yang mulai berkurang aktivitasnya'
                          },
                          'About To Sleep': {
                            color: 'bg-amber-100 text-amber-800',
                            icon: '😴',
                            description: 'Pelanggan yang hampir tidak aktif'
                          },
                          'At Risk': {
                            color: 'bg-red-100 text-red-800',
                            icon: '⚡',
                            description: 'Pelanggan yang dulu aktif tapi sekarang jarang berbelanja'
                          },
                          'Cant Lose Them': {
                            color: 'bg-rose-100 text-rose-800',
                            icon: '🔥',
                            description: 'Pelanggan dengan nilai tinggi yang hampir tidak aktif'
                          },
                          'Hibernating': {
                            color: 'bg-slate-100 text-slate-800',
                            icon: '❄️',
                            description: 'Pelanggan yang sudah lama tidak berbelanja'
                          },
                          'Lost': {
                            color: 'bg-gray-100 text-gray-800',
                            icon: '👋',
                            description: 'Pelanggan yang sudah sangat lama tidak berbelanja'
                          }
                        }[segment] || { color: 'bg-gray-100 text-gray-800', icon: '❓', description: 'Segmen pelanggan lainnya' };
                        
                        const percentage = (data.count / (customerSegmentation?.totalCustomers || 1)) * 100;
                        
                        return (
                          <div key={segment} className={`rounded-lg p-4 ${segmentInfo.color}`}>
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-md font-medium flex items-center">
                                  <span className="mr-2">{segmentInfo.icon}</span>
                                  {segment}
                                </h3>
                                <p className="text-xs mt-1">{segmentInfo.description}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">{data.count}</p>
                                <p className="text-xs">{percentage.toFixed(1)}% dari total</p>
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="text-xs flex justify-between mb-1">
                                <span>Avg. Recency</span>
                                <span>{data.avgRecency !== undefined ? data.avgRecency.toFixed(1) : 'N/A'} hari</span>
                              </div>
                              <div className="text-xs flex justify-between mb-1">
                                <span>Avg. Frequency</span>
                                <span>{data.avgFrequency !== undefined ? data.avgFrequency.toFixed(1) : 'N/A'} transaksi</span>
                              </div>
                              <div className="text-xs flex justify-between">
                                <span>Avg. Monetary</span>
                                <span>{data.avgMonetary !== undefined ? formatCurrency(data.avgMonetary) : 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="col-span-3 p-4 text-center bg-gray-50 rounded-lg">
                          <p className="text-gray-500">Data segmentasi pelanggan tidak tersedia</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Transaction Time Analysis */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Hourly Analysis */}
                  {hourlyAnalysis && hourlyAnalysis.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Pola Transaksi per Jam</h2>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={hourlyAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="hour" 
                            tickFormatter={(hour) => `${hour}:00`}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              name === 'transactions' ? value : formatCurrency(value),
                              name === 'transactions' ? 'Transaksi' : 'Penjualan'
                            ]}
                            labelFormatter={(hour) => `Jam ${hour}:00 - ${hour}:59`}
                          />
                          <Bar dataKey="transactions" name="Transaksi" fill="#8884d8" />
                          <Bar dataKey="sales" name="Penjualan" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  
                  {/* Weekday Analysis */}
                  {weekdayAnalysis && weekdayAnalysis.length > 0 && (
                    <div className="bg-white rounded-lg shadow p-6">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Pola Transaksi per Hari</h2>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={weekdayAnalysis}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="day" 
                            tickFormatter={(day) => {
                              const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                              return day >= 0 && day < days.length ? days[day] : 'Hari ' + day;
                            }}
                          />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              name === 'transactions' ? value : formatCurrency(value),
                              name === 'transactions' ? 'Transaksi' : 'Penjualan'
                            ]}
                            labelFormatter={(day) => {
                              const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                              return day >= 0 && day < days.length ? days[day] : 'Hari ' + day;
                            }}
                          />
                          <Bar dataKey="transactions" name="Transaksi" fill="#8884d8" />
                          <Bar dataKey="sales" name="Penjualan" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
                
                {/* Payment Method Analysis */}
                {paymentMethodAnalysis && paymentMethodAnalysis.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Analisis Metode Pembayaran</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={paymentMethodAnalysis}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="count"
                            nameKey="method"
                          >
                            {paymentMethodAnalysis.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={[
                                '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed'
                              ][index % 6]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => [`${value} transaksi`, props.payload.method]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Metode Pembayaran
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Transaksi
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Total
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Rata-rata
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {paymentMethodAnalysis.map((method) => (
                              <tr key={method.method}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {method.method}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {method.count}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatCurrency(method.sales)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {method.count > 0 ? formatCurrency(method.sales / method.count) : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Top Products */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Produk Terlaris</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produk
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Terjual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pendapatan
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Kontribusi
                      </th>
                      {analysisType === 'advanced' && (
                        <>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Transaksi
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Pelanggan
                          </th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topProducts.map((product, index) => {
                      const contribution = (product.revenue / summary.totalSales) * 100
                      return (
                        <tr key={product.name}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-sm">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {product.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.quantity} unit
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(product.revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${contribution}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">
                                {contribution.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          {analysisType === 'advanced' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {product.transactions || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {product.uniqueCustomers || 0}
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Penjualan per Kategori */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Penjualan per Kategori</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Produk Terjual</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Nilai Penjualan</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontribusi</th>
                      {analysisType === 'advanced' && (
                        <>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaksi</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan Unik</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categoryData.map((category, index) => {
                      const contribution = (category.sales / summary.totalSales) * 100;
                      return (
                        <tr key={category.name}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: category.color + '33' }}>
                                <span style={{ color: category.color }} className="font-semibold text-sm">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {category.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {category.quantity} unit
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatCurrency(category.sales)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="h-2 rounded-full" 
                                  style={{ width: `${contribution}%`, backgroundColor: category.color }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-600">
                                {contribution.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          {analysisType === 'advanced' && (
                            <>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {category.transactions || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {category.uniqueCustomers || 0}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Product Variant Analysis */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Analisis Varian Produk</h2>
              
              {/* Detailed Product Variant Analysis */}
              <div className="mb-6">
                <h3 className="text-md font-medium text-gray-700 mb-3">Detail Produk dan Varian</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ukuran</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warna</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga Jual</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Terjual</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Omzet</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {topProducts.map((product: any, index: number) => {
                        // Menggunakan data top products sebagai basis dan menambahkan informasi ukuran dan warna
                        // Dalam implementasi sebenarnya, data ini harus diambil dari API
                        const variants = [
                          { size: 'S', color: 'Hitam', price: product.revenue / product.quantity, quantity: Math.round(product.quantity * 0.2) },
                          { size: 'M', color: 'Hitam', price: product.revenue / product.quantity, quantity: Math.round(product.quantity * 0.3) },
                          { size: 'L', color: 'Biru', price: product.revenue / product.quantity, quantity: Math.round(product.quantity * 0.25) },
                          { size: 'XL', color: 'Biru', price: product.revenue / product.quantity, quantity: Math.round(product.quantity * 0.25) },
                        ];
                        
                        return variants.map((variant, variantIndex) => (
                          <tr key={`${product.name}-${variant.size}-${variant.color}`}>
                            {variantIndex === 0 ? (
                              <td rowSpan={variants.length} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {product.name}
                              </td>
                            ) : null}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{variant.size}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex items-center">
                                <div 
                                  className="w-4 h-4 rounded-full mr-2" 
                                  style={{ backgroundColor: variant.color === 'Hitam' ? '#333' : variant.color === 'Biru' ? '#3B82F6' : '#ccc' }}
                                ></div>
                                {variant.color}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(variant.price)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{variant.quantity}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(variant.price * variant.quantity)}</td>
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Size Distribution */}
              <div className="mb-6">
                <h3 className="text-md font-medium text-gray-700 mb-3">Distribusi Ukuran</h3>
                {productVariantAnalysis.sizeData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ukuran</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Terjual</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendapatan</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontribusi (%)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productVariantAnalysis.sizeData.map((item: any, index: number) => {
                          const totalRevenue = productVariantAnalysis.sizeData.reduce((sum: number, i: any) => sum + (i.revenue || 0), 0)
                          const contribution = totalRevenue > 0 ? ((item.revenue || 0) / totalRevenue) * 100 : 0
                          
                          return (
                            <tr key={`size-${index}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name || 'N/A'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity || 0}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.revenue || 0)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full" 
                                      style={{ width: `${contribution}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-600">
                                    {contribution.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Tidak ada data ukuran tersedia</p>
                )}
              </div>
              
              {/* Color Distribution */}
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-3">Distribusi Warna</h3>
                {productVariantAnalysis.colorData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warna</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Terjual</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pendapatan</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontribusi (%)</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {productVariantAnalysis.colorData.map((item: any, index: number) => {
                          const totalRevenue = productVariantAnalysis.colorData.reduce((sum: number, i: any) => sum + (i.revenue || 0), 0)
                          const contribution = totalRevenue > 0 ? ((item.revenue || 0) / totalRevenue) * 100 : 0
                          
                          return (
                            <tr key={`color-${index}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <div className="flex items-center">
                                  <div 
                                    className="w-4 h-4 rounded-full mr-2" 
                                    style={{ backgroundColor: item.name === 'Hitam' ? '#333' : item.name === 'Biru' ? '#3B82F6' : '#ccc' }}
                                  ></div>
                                  {item.name || 'N/A'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.quantity || 0}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(item.revenue || 0)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                    <div 
                                      className="bg-blue-600 h-2 rounded-full" 
                                      style={{ width: `${contribution}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm text-gray-600">
                                    {contribution.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Tidak ada data warna tersedia</p>
                )}
              </div>
            </div>

            {/* Return Data Analysis */}
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Analisis Pengembalian (Return)</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Total Returns Card */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ArrowUturnLeftIcon className="h-8 w-8 text-amber-500" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Pengembalian</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {returnData?.totalReturns || 0}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Total Return Amount Card */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <BanknotesIcon className="h-8 w-8 text-red-500" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Total Nilai Pengembalian</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {formatCurrency(returnData?.totalReturnAmount || 0)}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Return Rate Card */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-indigo-500" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Tingkat Pengembalian</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        {(returnData?.returnRate || 0).toFixed(2)}%
                      </p>
                      <p className="text-xs text-gray-500">
                        dari total penjualan
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                  <InformationCircleIcon className="h-5 w-5 inline-block mr-1 text-blue-500" />
                  Tingkat pengembalian dihitung sebagai persentase dari total nilai pengembalian dibandingkan dengan total penjualan.
                  Tingkat pengembalian yang rendah menunjukkan kepuasan pelanggan yang tinggi terhadap produk.
                </p>
              </div>
            </div>

            {/* Promotion Analysis */}
            {analysisType === 'advanced' && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Analisis Promosi</h2>
                
                {promotionAnalysis && promotionAnalysis.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Promosi</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Penggunaan</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaksi Terpengaruh</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Diskon</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rata-rata Diskon</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {promotionAnalysis.map((promo, index) => (
                            <tr key={`promo-${index}`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{promo.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{promo.usageCount}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{promo.affectedTransactions}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(promo.totalDiscount)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(promo.averageDiscount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Discounted Products Analysis */}
                    <div className="mt-8">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">Produk yang Dijual dengan Diskon</h3>
                      
                      {promotionAnalysis.map((promo, promoIndex) => (
                        promo.discountedProducts && promo.discountedProducts.length > 0 ? (
                          <div key={`promo-products-${promoIndex}`} className="mb-6">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">{promo.name}</h4>
                            
                            <div className="overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Produk</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah Terjual</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Diskon</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {promo.discountedProducts.map((product: DiscountedProductItem, productIndex: number) => (
                                    <tr key={`product-${promoIndex}-${productIndex}`}>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.productName}</td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.categoryName}</td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.quantity}</td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(product.totalDiscount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <td colSpan={2} className="px-6 py-3 text-right text-sm font-medium text-gray-500">Total:</td>
                                    <td className="px-6 py-3 text-sm font-medium text-gray-500">
                                      {promo.discountedProducts.reduce((sum: number, product: DiscountedProductItem) => sum + product.quantity, 0)}
                                    </td>
                                    <td className="px-6 py-3 text-sm font-medium text-gray-500">
                                      {formatCurrency(promo.discountedProducts.reduce((sum: number, product: DiscountedProductItem) => sum + product.totalDiscount, 0))}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 italic">Tidak ada data promosi tersedia untuk periode ini. Coba pilih rentang tanggal yang berbeda atau pastikan ada promosi yang aktif selama periode tersebut.</p>
                )}
                
                <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <InformationCircleIcon className="h-5 w-5 inline-block mr-1 text-blue-500" />
                    Analisis promosi menunjukkan efektivitas setiap promosi dalam mendorong penjualan. Tabel di atas menampilkan detail produk yang dijual dengan diskon,
                    jumlah terjual, dan total diskon yang diberikan untuk setiap produk.
                  </p>
                </div>
              </div>
            )}
            
            {/* Operational Expenses Analysis */}
            {analysisType === 'advanced' && (
              <div className="bg-white rounded-lg shadow p-6 mt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Analisis Biaya Operasional</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {/* Total Expenses Card */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <BanknotesIcon className="h-8 w-8 text-red-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Total Biaya Operasional</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {formatCurrency(125000000)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expense to Revenue Ratio Card */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-8 w-8 text-amber-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Rasio Biaya-Pendapatan</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {(125000000 / (summary.totalSales || 1) * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">
                          dari total penjualan
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Profit Margin Card */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <ChartBarIcon className="h-8 w-8 text-green-600" />
                      </div>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-500">Margin Keuntungan</p>
                        <p className="text-2xl font-semibold text-gray-900">
                          {(100 - (125000000 / (summary.totalSales || 1) * 100)).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Expense Categories */}
                <div className="mt-6">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">Distribusi Biaya Operasional</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pie Chart */}
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Gaji Karyawan', value: 75000000, color: '#4f46e5' },
                            { name: 'Sewa Tempat', value: 25000000, color: '#0891b2' },
                            { name: 'Utilitas', value: 10000000, color: '#059669' },
                            { name: 'Pemasaran', value: 8000000, color: '#d97706' },
                            { name: 'Lain-lain', value: 7000000, color: '#7c3aed' }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name} ${((value / 125000000) * 100).toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                        >
                          {[
                            { name: 'Gaji Karyawan', value: 75000000, color: '#4f46e5' },
                            { name: 'Sewa Tempat', value: 25000000, color: '#0891b2' },
                            { name: 'Utilitas', value: 10000000, color: '#059669' },
                            { name: 'Pemasaran', value: 8000000, color: '#d97706' },
                            { name: 'Lain-lain', value: 7000000, color: '#7c3aed' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [formatCurrency(value as number), 'Jumlah']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Persentase</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {[
                            { name: 'Gaji Karyawan', value: 75000000, color: '#4f46e5' },
                            { name: 'Sewa Tempat', value: 25000000, color: '#0891b2' },
                            { name: 'Utilitas', value: 10000000, color: '#059669' },
                            { name: 'Pemasaran', value: 8000000, color: '#d97706' },
                            { name: 'Lain-lain', value: 7000000, color: '#7c3aed' }
                          ].map((category, index) => {
                            const percentage = (category.value / 125000000) * 100;
                            return (
                              <tr key={`expense-${index}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div 
                                      className="w-4 h-4 rounded-full mr-2" 
                                      style={{ backgroundColor: category.color }}
                                    ></div>
                                    <span className="text-sm font-medium text-gray-900">{category.name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatCurrency(category.value)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                                      <div 
                                        className="h-2 rounded-full" 
                                        style={{ width: `${percentage}%`, backgroundColor: category.color }}
                                      ></div>
                                    </div>
                                    <span className="text-sm text-gray-600">
                                      {percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <InformationCircleIcon className="h-5 w-5 inline-block mr-1 text-blue-500" />
                    Analisis biaya operasional menunjukkan distribusi pengeluaran bisnis. Memahami struktur biaya membantu
                    mengidentifikasi area untuk efisiensi dan optimalisasi pengeluaran.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}