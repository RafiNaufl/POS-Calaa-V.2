"use client"

import { useState, useEffect, useCallback } from "react"
import { apiFetch } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw } from "lucide-react"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js"
import { Bar, Pie, Line } from "react-chartjs-2"

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
)

export default function FinancialReportPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [financialData, setFinancialData] = useState<any>(null)
  const [selectedRange, setSelectedRange] = useState('30days')

  // Normalize incoming financial data to ensure categoryAnalysis shape is safe
  const normalizeFinancialData = (data: any) => {
    if (!data) return data
    const ca = data.categoryAnalysis || {}
    const revenue = ca.revenue || {}
    const cogs = ca.cogs || {}
    const profit = ca.profit || {}
    const margin = ca.margin || {}

    // If cogs missing, fallback to costs.cogsByCategory
    const cogsSource = Object.keys(cogs).length ? cogs : (data.costs?.cogsByCategory || {})

    const categories = Array.from(new Set([
      ...Object.keys(revenue),
      ...Object.keys(cogsSource),
      ...Object.keys(profit),
      ...Object.keys(margin),
    ]))

    const normalized = {
      revenue: { ...revenue },
      cogs: { ...cogsSource },
      profit: { ...profit },
      margin: { ...margin },
    }

    categories.forEach((cat) => {
      const rev = normalized.revenue[cat] ?? 0
      const cg = normalized.cogs[cat] ?? 0
      if (normalized.revenue[cat] == null) normalized.revenue[cat] = 0
      if (normalized.cogs[cat] == null) normalized.cogs[cat] = 0
      if (normalized.profit[cat] == null) normalized.profit[cat] = rev - cg
      if (normalized.margin[cat] == null) normalized.margin[cat] = rev > 0 ? (normalized.profit[cat] / rev) : 0
    })

    data.categoryAnalysis = normalized
    return data
  }

  const fetchFinancialData = useCallback(async () => {
    setLoading(true)
    try {
  const response = await apiFetch(`/api/v1/reports/financial?range=${selectedRange}`)
      if (!response.ok) {
        throw new Error('Failed to fetch financial data')
      }
      const data = await response.json()
      setFinancialData(normalizeFinancialData(data))
    } catch (error) {
      console.error('Error fetching financial data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load financial report data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedRange, toast])

  useEffect(() => {
    fetchFinancialData()
  }, [selectedRange, fetchFinancialData])

  const handleRangeChange = (value: string) => {
    setSelectedRange(value)
  }

  const handleRefresh = () => {
    fetchFinancialData()
  }

  const exportReport = () => {
    if (!financialData) return

    // Format date for filename
    const dateStr = format(new Date(), 'yyyy-MM-dd', { locale: id })
    const filename = `laporan-keuangan-${dateStr}.csv`

    // Create CSV content
    let csvContent = 'LAPORAN LABA RUGI\n'
    csvContent += `Periode: ${format(new Date(financialData.period.startDate), 'dd MMM yyyy', { locale: id })} - ${format(new Date(financialData.period.endDate), 'dd MMM yyyy', { locale: id })}\n\n`

    // Revenue section
    csvContent += 'PENDAPATAN\n'
    csvContent += `Penjualan Kotor,${financialData.revenue.grossSales}\n`
    csvContent += `Diskon Reguler,${financialData.revenue.discounts.regular}\n`
    csvContent += `Diskon Voucher,${financialData.revenue.discounts.voucher}\n`
    csvContent += `Diskon Promo,${financialData.revenue.discounts.promo}\n`
    csvContent += `Total Diskon,${financialData.revenue.discounts.total}\n`
    csvContent += `Penjualan Bersih,${financialData.revenue.netSales}\n`
    csvContent += `Pajak,${financialData.revenue.taxes}\n`
    csvContent += `Total Pendapatan,${financialData.revenue.totalRevenue}\n\n`

    // COGS section
    csvContent += 'HARGA POKOK PENJUALAN\n'
    csvContent += `Total HPP,${financialData.costs.costOfGoodsSold}\n\n`

    // HPP by category
    csvContent += 'HPP BERDASARKAN KATEGORI\n'
    Object.entries(financialData.costs.cogsByCategory).forEach(([category, cost]) => {
      csvContent += `${category},${cost}\n`
    })
    csvContent += '\n'

    // Profitability section
    csvContent += 'PROFITABILITAS\n'
    csvContent += `Laba Kotor,${financialData.profitability.grossProfit}\n`
    csvContent += `Margin Laba Kotor,${financialData.profitability.grossProfitMargin?.toFixed(2) || '0.00'}%\n\n`

    // Operating expenses
    csvContent += 'BIAYA OPERASIONAL\n'
    Object.entries(financialData.profitability.operatingExpenses).forEach(([expense, amount]) => {
      csvContent += `${expense},${amount}\n`
    })
    csvContent += `Total Biaya Operasional,${financialData.profitability.totalOperatingExpenses}\n\n`

    // Final profitability
    csvContent += 'HASIL AKHIR\n'
    csvContent += `Laba Operasional,${financialData.profitability.operatingProfit}\n`
    csvContent += `Margin Laba Operasional,${financialData.profitability.operatingProfitMargin?.toFixed(2) || '0.00'}%\n`
    csvContent += `Laba Bersih,${financialData.profitability.netProfit}\n`
    csvContent += `Margin Laba Bersih,${financialData.profitability.profitMargin?.toFixed(2) || '0.00'}%\n\n`

    // Growth metrics
    csvContent += 'PERTUMBUHAN (vs periode sebelumnya)\n'
    csvContent += `Pertumbuhan Penjualan,${financialData.growth.sales?.toFixed(2) || '0.00'}%\n`
    csvContent += `Pertumbuhan Laba,${financialData.growth.profit?.toFixed(2) || '0.00'}%\n`

    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Prepare chart data for category analysis
  const prepareCategoryChartData = () => {
    if (!financialData) return null

    const ca = financialData.categoryAnalysis || { revenue: {}, cogs: {}, profit: {}, margin: {} }
    const categories = Array.from(new Set([
      ...Object.keys(ca.revenue || {}),
      ...Object.keys(ca.profit || {}),
      ...Object.keys(ca.cogs || {}),
    ]))
    const revenues = categories.map((cat) => (ca.revenue?.[cat] ?? 0))
    const profits = categories.map((cat) => (ca.profit?.[cat] ?? 0))

    // Generate random colors for each category
    const backgroundColors = categories.map(() => {
      const r = Math.floor(Math.random() * 255)
      const g = Math.floor(Math.random() * 255)
      const b = Math.floor(Math.random() * 255)
      return `rgba(${r}, ${g}, ${b}, 0.6)`
    })

    return {
      labels: categories,
      datasets: [
        {
          label: 'Pendapatan',
          data: revenues,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
          borderWidth: 1,
        },
        {
          label: 'Laba',
          data: profits,
          backgroundColor: backgroundColors.map(color => color.replace('0.6', '0.8')),
          borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
          borderWidth: 1,
        },
      ],
    }
  }

  // Prepare chart data for expense breakdown
  const prepareExpenseChartData = () => {
    if (!financialData) return null

    const expenses = Object.keys(financialData.profitability.operatingExpenses)
    const amounts = Object.values(financialData.profitability.operatingExpenses)

    // Generate random colors for each expense category
    const backgroundColors = expenses.map(() => {
      const r = Math.floor(Math.random() * 255)
      const g = Math.floor(Math.random() * 255)
      const b = Math.floor(Math.random() * 255)
      return `rgba(${r}, ${g}, ${b}, 0.6)`
    })

    return {
      labels: expenses,
      datasets: [
        {
          data: amounts,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
          borderWidth: 1,
        },
      ],
    }
  }

  // Prepare daily chart data (Net Sales & Operating Profit per day)
  const prepareDailyChartData = () => {
    if (!financialData || !Array.isArray(financialData.daily)) return null
    const labels = financialData.daily.map((d: any) => format(new Date(d.date), 'dd MMM', { locale: id }))
    const netSales = financialData.daily.map((d: any) => Number(d.netSales || 0))
    const operatingProfit = financialData.daily.map((d: any) => Number(d.operatingProfit || 0))
    return {
      labels,
      datasets: [
        {
          label: 'Penjualan Bersih',
          data: netSales,
          borderColor: 'rgba(99, 102, 241, 1)',
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          tension: 0.3,
        },
        {
          label: 'Laba Operasional',
          data: operatingProfit,
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.3,
        },
      ],
    }
  }

  return (
    <div>
      <Navbar />
      <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <header className="bg-white shadow-sm border-b -mx-6 -mt-6 mb-6">
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
              <Link href="/reports" className="px-4 py-2 rounded-md hover:bg-white hover:shadow-sm font-medium text-gray-600 hover:text-gray-800 transition-all">
                Penjualan
              </Link>
              <Link href="/reports/financial" className="px-4 py-2 rounded-md bg-white shadow-sm font-medium text-gray-800">
                Keuangan
              </Link>
              <Link href="/reports/daily" className="px-4 py-2 rounded-md hover:bg-white hover:shadow-sm font-medium text-gray-600 hover:text-gray-800 transition-all">
                Harian
              </Link>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportReport} disabled={loading || !financialData}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="30days" onValueChange={handleRangeChange}>
        <TabsList className="grid w-full grid-cols-4 md:w-auto">
          <TabsTrigger value="7days">7 Hari</TabsTrigger>
          <TabsTrigger value="30days">30 Hari</TabsTrigger>
          <TabsTrigger value="3months">3 Bulan</TabsTrigger>
          <TabsTrigger value="1year">1 Tahun</TabsTrigger>
        </TabsList>

        {['7days', '30days', '3months', '1year'].map((range) => (
          <TabsContent key={range} value={range} className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-4 w-16 mt-2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : financialData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Penjualan Kotor</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(financialData.revenue.grossSales)}
                      </div>
                      <p className={`text-xs ${financialData.growth.sales >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {financialData.growth.sales >= 0 ? '↑' : '↓'} {Math.abs(financialData.growth.sales)?.toFixed(2) || '0.00'}% dari periode sebelumnya
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Penjualan Bersih</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(financialData.revenue.netSales)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Setelah diskon {formatCurrency(financialData.revenue.discounts.total)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Laba Kotor</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(financialData.profitability.grossProfit)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Margin {financialData.profitability.grossProfitMargin?.toFixed(2) || '0.00'}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(financialData.profitability.netProfit)}
                      </div>
                      <p className={`text-xs ${financialData.growth.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {financialData.growth.profit >= 0 ? '↑' : '↓'} {Math.abs(financialData.growth.profit)?.toFixed(2) || '0.00'}% dari periode sebelumnya
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Financial Report */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Revenue and Expenses */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Laporan Laba Rugi</CardTitle>
                      <CardDescription>
                        {format(new Date(financialData.period.startDate), 'dd MMM yyyy', { locale: id })} - {format(new Date(financialData.period.endDate), 'dd MMM yyyy', { locale: id })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-auto">
                      <table className="w-full table-fixed">
                        <tbody>
                          {/* Revenue Section */}
                          <tr className="font-bold">
                            <td colSpan={2} className="py-2">PENDAPATAN</td>
                          </tr>
                          <tr>
                            <td className="py-1 pl-4">Penjualan Kotor</td>
                            <td className="text-right">{formatCurrency(financialData.revenue.grossSales)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 pl-4">Diskon Reguler</td>
                            <td className="text-right text-red-500">-{formatCurrency(financialData.revenue.discounts.regular)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 pl-4">Diskon Voucher</td>
                            <td className="text-right text-red-500">-{formatCurrency(financialData.revenue.discounts.voucher)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 pl-4">Diskon Promo</td>
                            <td className="text-right text-red-500">-{formatCurrency(financialData.revenue.discounts.promo)}</td>
                          </tr>
                          <tr className="border-t">
                            <td className="py-1 pl-4 font-medium">Penjualan Bersih</td>
                            <td className="text-right font-medium">{formatCurrency(financialData.revenue.netSales)}</td>
                          </tr>

                          {/* COGS Section */}
                          <tr className="font-bold">
                            <td colSpan={2} className="py-2 pt-4">HARGA POKOK PENJUALAN</td>
                          </tr>
                          <tr>
                            <td className="py-1 pl-4">Total HPP</td>
                            <td className="text-right text-red-500">-{formatCurrency(financialData.costs.costOfGoodsSold)}</td>
                          </tr>

                          {/* Gross Profit */}
                          <tr className="border-t">
                            <td className="py-1 pl-4 font-medium">Laba Kotor</td>
                            <td className="text-right font-medium">{formatCurrency(financialData.profitability.grossProfit)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 pl-4">Margin Laba Kotor</td>
                            <td className="text-right">{financialData.profitability.grossProfitMargin?.toFixed(2) || '0.00'}%</td>
                          </tr>

                          {/* Operating Expenses */}
                          <tr className="font-bold">
                            <td colSpan={2} className="py-2 pt-4">BIAYA OPERASIONAL</td>
                          </tr>
                          {Object.entries(financialData.profitability.operatingExpenses).map(([expense, amount]) => (
                            <tr key={expense}>
                              <td className="py-1 pl-4">
                                <div className="text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none break-words">{expense}</div>
                              </td>
                              <td className="text-right text-red-500">-{formatCurrency(amount as number)}</td>
                            </tr>
                          ))}
                          <tr className="border-t">
                            <td className="py-1 pl-4 font-medium">Total Biaya Operasional</td>
                            <td className="text-right text-red-500 font-medium">-{formatCurrency(financialData.profitability.totalOperatingExpenses)}</td>
                          </tr>

                          {/* Operating Profit */}
                          <tr className="border-t">
                            <td className="py-1 pl-4 font-medium">Laba Operasional</td>
                            <td className="text-right font-medium">{formatCurrency(financialData.profitability.operatingProfit)}</td>
                          </tr>
                          <tr>
                            <td className="py-1 pl-4">Margin Laba Operasional</td>
                            <td className="text-right">{financialData.profitability.operatingProfitMargin?.toFixed(2) || '0.00'}%</td>
                          </tr>

                          {/* Net Profit */}
                          <tr className="border-t border-t-2 font-bold">
                            <td className="py-2">LABA BERSIH</td>
                            <td className="text-right">{formatCurrency(financialData.profitability.netProfit)}</td>
                          </tr>
                          <tr>
                            <td className="py-1">Margin Laba Bersih</td>
                            <td className="text-right">{financialData.profitability.profitMargin?.toFixed(2) || '0.00'}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  {/* Category Analysis */}
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Laporan Harian Keuangan</CardTitle>
                        <CardDescription>Penjualan bersih dan laba operasional per hari</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {financialData && Array.isArray(financialData.daily) && financialData.daily.length > 0 ? (
                          <Line
                            data={prepareDailyChartData() || { labels: [], datasets: [] }}
                            options={{
                              responsive: true,
                              plugins: { legend: { position: 'top' as const } },
                              scales: { y: { ticks: { callback: (val) => formatCurrency(Number(val)) } } }
                            }}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">Tidak ada data harian pada periode ini.</p>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle>Analisis Kategori</CardTitle>
                        <CardDescription>Pendapatan dan laba berdasarkan kategori produk</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {financialData && (
                          <Bar 
                            data={prepareCategoryChartData() || {labels: [], datasets: []}} 
                            options={{
                              responsive: true,
                              plugins: {
                                legend: {
                                  position: 'top' as const,
                                },
                                title: {
                                  display: false,
                                },
                              },
                            }}
                          />
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Distribusi Biaya Operasional</CardTitle>
                        <CardDescription>Persentase dari total biaya operasional</CardDescription>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        <div style={{ width: '300px', height: '300px' }}>
                          {financialData && (
                            <Pie 
                              data={prepareExpenseChartData() || {labels: [], datasets: []}} 
                              options={{
                                responsive: true,
                                plugins: {
                                  legend: {
                                    position: 'bottom' as const,
                                  },
                                },
                              }}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Daily Details Table */}
                {financialData && Array.isArray(financialData.daily) && financialData.daily.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Ringkasan Harian Keuangan</CardTitle>
                      <CardDescription>Penjualan bersih, biaya operasional, dan laba operasional per hari</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full table-fixed">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Tanggal</th>
                              <th className="text-right py-2">Penjualan Bersih</th>
                              <th className="text-right py-2">Biaya Operasional</th>
                              <th className="text-right py-2">Laba Operasional</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialData.daily.map((d: any) => (
                              <tr key={d.date} className="border-b">
                                <td className="py-2">{format(new Date(d.date), 'dd MMM yyyy', { locale: id })}</td>
                                <td className="text-right">{formatCurrency(Number(d.netSales || 0))}</td>
                                <td className="text-right">{formatCurrency(Number(d.operatingExpenses || 0))}</td>
                                <td className="text-right">{formatCurrency(Number(d.operatingProfit || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Category Details Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Detail Kategori Produk</CardTitle>
                    <CardDescription>Analisis profitabilitas berdasarkan kategori</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full table-fixed">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Kategori</th>
                            <th className="text-right py-2">Pendapatan</th>
                            <th className="text-right py-2">HPP</th>
                            <th className="text-right py-2">Laba Kotor</th>
                            <th className="text-right py-2">Margin</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financialData && (() => {
                            const ca = financialData.categoryAnalysis || { revenue: {}, cogs: {}, profit: {}, margin: {} }
                            const categories = Array.from(new Set([
                              ...Object.keys(ca.revenue || {}),
                              ...Object.keys(ca.cogs || {}),
                              ...Object.keys(ca.profit || {}),
                              ...Object.keys(ca.margin || {}),
                            ]))
                            return categories.map((category) => {
                              const revenue = ca.revenue?.[category] ?? 0
                              const cogs = ca.cogs?.[category] ?? 0
                              const profit = ca.profit?.[category] ?? (revenue - cogs)
                              const margin = ca.margin?.[category] ?? (revenue > 0 ? profit / revenue : 0)
                            
                              return (
                                <tr key={category} className="border-b">
                                  <td className="py-2">
                                    <div className="text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none break-words">{category}</div>
                                  </td>
                                  <td className="text-right">{formatCurrency(revenue)}</td>
                                  <td className="text-right">{formatCurrency(cogs)}</td>
                                  <td className="text-right">{formatCurrency(profit)}</td>
                                  <td className="text-right">{(margin * 100)?.toFixed(2) || '0.00'}%</td>
                                </tr>
                              )
                            })
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-10">
                <p>Failed to load financial data. Please try again.</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      </div>
    </div>
  )
}
