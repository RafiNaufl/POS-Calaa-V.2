'use client'

import { useState, useEffect } from 'react'
import { addDays, format, subDays, parseISO } from 'date-fns'
import { id } from 'date-fns/locale'
import { BanknotesIcon, ShoppingCartIcon, ChartBarIcon, UserGroupIcon, DocumentArrowDownIcon, ArrowLeftIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, ReferenceLine } from 'recharts'

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

  // Fetch real-time data from API
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/reports?range=${dateRange}&analysisType=${analysisType}`)
        if (response.ok) {
          const data = await response.json()
          setSalesData(data.salesData || [])
          setCategoryData(data.categoryData || [])
          setTopProducts(data.topProducts || [])
          setSummary(data.summary || {
            totalSales: 0,
            totalTransactions: 0,
            averageTransaction: 0,
            growth: 0,
          })
          
          // Set advanced analytics data if available
          if (analysisType === 'advanced') {
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

            {/* Advanced Analytics Section */}
            {analysisType === 'advanced' && rfmAnalysis && (
              <div className="space-y-6">
                {/* RFM Analysis */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Analisis RFM (Recency, Frequency, Monetary)</h2>
                    <button 
                      className="h-8 w-8 p-0 rounded-full hover:bg-gray-100 flex items-center justify-center"
                      title="RFM menganalisis perilaku pelanggan berdasarkan 3 faktor: Recency (kapan terakhir bertransaksi), Frequency (seberapa sering bertransaksi), dan Monetary (berapa banyak uang yang dihabiskan)."
                    >
                      <InformationCircleIcon className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-md font-medium text-blue-800 mb-2">Recency (Kebaruan)</h3>
                      <p className="text-sm text-gray-600 mb-4">Rata-rata: {rfmAnalysis?.averages?.recency !== null && rfmAnalysis?.averages?.recency !== undefined ? rfmAnalysis.averages.recency.toFixed(1) : '0'} hari sejak pembelian terakhir</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Skor 4 (1-{rfmAnalysis?.thresholds?.recency?.[1] || 7} hari)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.recency?.[4] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 3 ({(rfmAnalysis?.thresholds?.recency?.[1] || 7) + 1}-{rfmAnalysis?.thresholds?.recency?.[2] || 14} hari)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.recency?.[3] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 2 ({(rfmAnalysis?.thresholds?.recency?.[2] || 14) + 1}-{rfmAnalysis?.thresholds?.recency?.[3] || 30} hari)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.recency?.[2] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 1 ({'>'}{ rfmAnalysis?.thresholds?.recency?.[3] || 30} hari)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.recency?.[1] || 0} pelanggan</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-purple-50 rounded-lg p-4">
                      <h3 className="text-md font-medium text-purple-800 mb-2">Frequency (Frekuensi)</h3>
                      <p className="text-sm text-gray-600 mb-4">Rata-rata: {rfmAnalysis?.averages?.frequency !== null && rfmAnalysis?.averages?.frequency !== undefined ? rfmAnalysis.averages.frequency.toFixed(1) : '0'} transaksi per pelanggan</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Skor 4 ({'>='}{rfmAnalysis?.thresholds?.frequency?.[3] || 5} transaksi)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.frequency?.[4] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 3 ({rfmAnalysis?.thresholds?.frequency?.[2] || 3}-{rfmAnalysis?.thresholds?.frequency?.[3] - 1 || 4} transaksi)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.frequency?.[3] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 2 ({rfmAnalysis?.thresholds?.frequency?.[1] || 2}-{rfmAnalysis?.thresholds?.frequency?.[2] - 1 || 2} transaksi)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.frequency?.[2] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 1 (1 transaksi)</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.frequency?.[1] || 0} pelanggan</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-4">
                      <h3 className="text-md font-medium text-green-800 mb-2">Monetary (Nilai)</h3>
                      <p className="text-sm text-gray-600 mb-4">Rata-rata: {rfmAnalysis?.averages?.monetary !== null && rfmAnalysis?.averages?.monetary !== undefined ? formatCurrency(rfmAnalysis.averages.monetary) : formatCurrency(0)} per pelanggan</p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Skor 4 ({'>'} {rfmAnalysis?.thresholds?.monetary?.[3] !== null && rfmAnalysis?.thresholds?.monetary?.[3] !== undefined ? formatCurrency(rfmAnalysis.thresholds.monetary[3]) : formatCurrency(0)})</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.monetary?.[4] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 3 ({rfmAnalysis?.thresholds?.monetary?.[2] !== null && rfmAnalysis?.thresholds?.monetary?.[2] !== undefined ? `${formatCurrency(rfmAnalysis.thresholds.monetary[2])} - ${formatCurrency(rfmAnalysis.thresholds.monetary[3] || 0)}` : formatCurrency(0)})</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.monetary?.[3] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 2 ({rfmAnalysis?.thresholds?.monetary?.[1] !== null && rfmAnalysis?.thresholds?.monetary?.[1] !== undefined ? `${formatCurrency(rfmAnalysis.thresholds.monetary[1])} - ${formatCurrency(rfmAnalysis.thresholds.monetary[2] || 0)}` : formatCurrency(0)})</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.monetary?.[2] || 0} pelanggan</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Skor 1 ({'<'} {rfmAnalysis?.thresholds?.monetary?.[1] !== null && rfmAnalysis?.thresholds?.monetary?.[1] !== undefined ? formatCurrency(rfmAnalysis.thresholds.monetary[1]) : formatCurrency(0)})</span>
                          <span className="font-medium">{rfmAnalysis?.distribution?.monetary?.[1] || 0} pelanggan</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
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
            <div className="bg-white rounded-lg shadow p-6">
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
          </div>
        )}
      </main>
    </div>
  )
}