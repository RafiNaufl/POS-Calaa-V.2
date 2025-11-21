"use client"

import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import Link from "next/link"
import Navbar from "@/components/Navbar"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { formatCurrency } from "@/lib/utils"
import { apiFetch } from "@/lib/api"
import { RefreshCw, Download, Search as SearchIcon, CheckCircle, Clock, XCircle, Circle } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"

type TransactionItemRow = {
  transactionId: string
  dateTime: string
  productName: string
  categoryName: string
  quantity: number
  unitPrice: number
  itemTotal: number
  customerName?: string | null
  paymentMethod: string
  status: string
}

type DateRange = { from?: Date; to?: Date }

function deriveRangeParam(range?: DateRange): string {
  if (!range?.from || !range?.to) return "7days"
  const diffDays = Math.ceil((range.to.getTime() - range.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  if (diffDays <= 7) return "7days"
  if (diffDays <= 30) return "30days"
  if (diffDays <= 90) return "3months"
  return "1year"
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const valid = d instanceof Date && !isNaN(d.getTime()) ? d : new Date()
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(valid)
}

export default function DailySalesDetailPage() {
  const [loading, setLoading] = useState<boolean>(true)
  const [dateRange, setDateRange] = useState<DateRange>({ from: new Date(), to: new Date() })
  const [rawTransactions, setRawTransactions] = useState<any[]>([])
  const [rows, setRows] = useState<TransactionItemRow[]>([])
  const [search, setSearch] = useState<string>("")
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("ALL")
  const [selectedPayment, setSelectedPayment] = useState<string>("ALL")
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL")
  const [sortKey, setSortKey] = useState<keyof TransactionItemRow>("dateTime")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const tableRef = useRef<HTMLDivElement>(null)
  const [backendSummary, setBackendSummary] = useState<{ totalSales: number; transactionCount: number; avgTransaction: number; topProductName: string } | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    try {
      const rangeParam = deriveRangeParam(dateRange)
      const params = new URLSearchParams({ range: rangeParam })
      if (selectedPayment !== "ALL") params.set("paymentMethod", selectedPayment)
      if (selectedStatus !== "ALL") params.set("status", selectedStatus)
      if (selectedCategoryId !== "ALL") params.set("categoryId", selectedCategoryId)
      const q = search.trim()
      if (q) params.set("productName", q)
      const res = await apiFetch(`/api/v1/transactions?${params.toString()}`)
      if (!res.ok) throw new Error("Gagal mengambil data transaksi")
      const json = await res.json()
      const transactions = Array.isArray(json?.transactions) ? json.transactions : []
      const summary = json?.summary
      if (summary && typeof summary === "object") {
        setBackendSummary({
          totalSales: Number(summary.totalSales ?? 0),
          transactionCount: Number(summary.transactionCount ?? 0),
          avgTransaction: Number((summary.avgTransaction ?? summary.avgTransactionValue) ?? 0),
          topProductName: String(summary.topProductName ?? summary.topProduct?.name ?? "-")
        })
      } else {
        setBackendSummary(null)
      }
      setRawTransactions(transactions)
      // Map ke baris, dengan fallback nama kategori dari daftar categoriesList jika relasi tidak ikut dimuat
      const flattened: TransactionItemRow[] = transactions.flatMap((t: any) => {
        const items = Array.isArray(t.items) ? t.items : []
        return items.map((it: any) => {
          const relCatName = it?.product?.category?.name
          const flatCatName = it?.product?.categoryName
          const catId = it?.product?.categoryId != null ? String(it.product.categoryId) : undefined
          const mappedCatName = relCatName ?? flatCatName ?? (catId ? (categoriesList.find((c) => c.id === catId)?.name ?? "-") : "-")
          return {
            transactionId: t?.id != null ? String(t.id) : t?.transactionNumber != null ? String(t.transactionNumber) : "-",
            dateTime: String(t.createdAt),
            productName: it?.product?.name ?? "Unknown",
            categoryName: mappedCatName,
            quantity: Number(it?.quantity ?? 0),
            unitPrice: Number(it?.price ?? 0),
            itemTotal: Number(it?.subtotal ?? (Number(it?.price || 0) * Number(it?.quantity || 0))),
            customerName: t?.customerName ?? null,
            paymentMethod: String(t?.paymentMethod || "-").toUpperCase(),
            status: String(t?.paymentStatus || t?.status || "-").toUpperCase(),
          }
        })
      })
      setRows(flattened)
    } catch (e) {
      console.error("Error fetching transactions:", e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dateRange, selectedPayment, selectedStatus, selectedCategoryId, search])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await apiFetch(`/api/v1/categories`)
        if (!res.ok) throw new Error("Gagal mengambil kategori")
        const json = await res.json()
        const list = Array.isArray(json?.categories) ? json.categories : Array.isArray(json) ? json : []
        const normalized = list.map((c: any) => ({ id: String(c.id), name: String(c.name) }))
        setCategoriesList(normalized)
      } catch (err) {
        console.error("Error fetching categories:", err)
        setCategoriesList([])
      }
    }
    fetchCategories()
  }, [])

  // Re-render rows ketika daftar kategori terlambat masuk agar nama kategori terisi
  useEffect(() => {
    if (!rawTransactions || rawTransactions.length === 0) return
    const flattened: TransactionItemRow[] = rawTransactions.flatMap((t: any) => {
      const items = Array.isArray(t.items) ? t.items : []
      return items.map((it: any) => {
        const relCatName = it?.product?.category?.name
        const flatCatName = it?.product?.categoryName
        const catId = it?.product?.categoryId != null ? String(it.product.categoryId) : undefined
        const mappedCatName = relCatName ?? flatCatName ?? (catId ? (categoriesList.find((c) => c.id === catId)?.name ?? "-") : "-")
        return {
          transactionId: t?.id != null ? String(t.id) : t?.transactionNumber != null ? String(t.transactionNumber) : "-",
          dateTime: String(t.createdAt),
          productName: it?.product?.name ?? "Unknown",
          categoryName: mappedCatName,
          quantity: Number(it?.quantity ?? 0),
          unitPrice: Number(it?.price ?? 0),
          itemTotal: Number(it?.subtotal ?? (Number(it?.price || 0) * Number(it?.quantity || 0))),
          customerName: t?.customerName ?? null,
          paymentMethod: String(t?.paymentMethod || "-").toUpperCase(),
          status: String(t?.paymentStatus || t?.status || "-").toUpperCase(),
        }
      })
    })
    setRows(flattened)
  }, [categoriesList])

  const filteredRows = useMemo(() => rows, [rows])

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (sortKey === "dateTime") {
        const ad = new Date(String(av)).getTime()
        const bd = new Date(String(bv)).getTime()
        return sortOrder === "asc" ? ad - bd : bd - ad
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortOrder === "asc" ? av - bv : bv - av
      }
      return sortOrder === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return sorted
  }, [filteredRows, sortKey, sortOrder])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  const clientSummary = useMemo(() => {
    const totalsByTransaction = new Map<string, number>()
    for (const r of filteredRows) {
      const current = totalsByTransaction.get(r.transactionId) ?? 0
      totalsByTransaction.set(r.transactionId, current + r.itemTotal)
    }
    const totalSales = Array.from(totalsByTransaction.values()).reduce((a, b) => a + b, 0)
    const transactionCount = totalsByTransaction.size
    const avgTransaction = transactionCount > 0 ? totalSales / transactionCount : 0
    const topProduct = filteredRows.reduce<{ name: string; qty: number } | null>((acc, row) => {
      if (!acc) return { name: row.productName, qty: row.quantity }
      if (row.quantity > acc.qty) return { name: row.productName, qty: row.quantity }
      return acc
    }, null)
    return {
      totalSales,
      transactionCount,
      avgTransaction,
      topProductName: topProduct?.name || "-",
    }
  }, [filteredRows])

  function toggleSort(key: keyof TransactionItemRow) {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortOrder("asc")
    }
  }

  async function exportCSV() {
    const header = [
      "Nomor Transaksi",
      "Tanggal/Waktu",
      "Nama Produk",
      "Kategori",
      "Jumlah",
      "Harga Satuan",
      "Total Per Item",
      "Nama Pelanggan",
      "Metode Pembayaran",
      "Status",
    ]
    const lines = sortedRows.map((r) => [
      r.transactionId,
      formatDateTime(r.dateTime),
      r.productName,
      r.categoryName,
      r.quantity,
      r.unitPrice,
      r.itemTotal,
      r.customerName || "",
      r.paymentMethod,
      r.status,
    ])
    const csv = [header, ...lines]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `laporan-harian-penjualan-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportExcel() {
    // Ekspor .xls berbasis HTML agar tidak membutuhkan dependensi tambahan
    const header = [
      "Nomor Transaksi",
      "Tanggal/Waktu",
      "Nama Produk",
      "Kategori",
      "Jumlah",
      "Harga Satuan",
      "Total Per Item",
      "Nama Pelanggan",
      "Metode Pembayaran",
      "Status",
    ]
    const rowsHtml = sortedRows
      .map((r) => `
        <tr>
          <td>#${r.transactionId}</td>
          <td>${formatDateTime(r.dateTime)}</td>
          <td>${r.productName}</td>
          <td>${r.categoryName}</td>
          <td>${r.quantity}</td>
          <td>${r.unitPrice}</td>
          <td>${r.itemTotal}</td>
          <td>${r.customerName || ''}</td>
          <td>${r.paymentMethod}</td>
          <td>${r.status}</td>
        </tr>
      `)
      .join("")
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
            <thead>
              <tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `
    const blob = new Blob([html], { type: "application/vnd.ms-excel" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `laporan-harian-penjualan-${new Date().toISOString().slice(0,10)}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportPDF() {
    if (!tableRef.current) return
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
    await doc.html(tableRef.current, {
      callback: (pdf) => {
        pdf.save(`laporan-harian-penjualan-${new Date().toISOString().slice(0,10)}.pdf`)
      },
      x: 24,
      y: 24,
      html2canvas: { scale: 0.8 },
    })
  }

  function rowTintClass(status: string) {
    if (status === "PAID" || status === "COMPLETED") return "bg-green-50"
    if (status === "PENDING") return "bg-amber-50"
    if (status === "CANCELED") return "bg-red-50"
    return "bg-gray-50"
  }

  function statusClass(status: string) {
    if (status === "PAID" || status === "COMPLETED") return "bg-green-50 text-green-700 border border-green-200"
    if (status === "PENDING") return "bg-amber-50 text-amber-700 border border-amber-200"
    if (status === "CANCELED") return "bg-red-50 text-red-700 border border-red-200"
    return "bg-gray-50 text-gray-700 border border-gray-200"
  }

  function statusIcon(status: string) {
    if (status === "PAID" || status === "COMPLETED") return <CheckCircle className="h-3 w-3 mr-1" />
    if (status === "PENDING") return <Clock className="h-3 w-3 mr-1" />
    if (status === "CANCELED") return <XCircle className="h-3 w-3 mr-1" />
    return <Circle className="h-3 w-3 mr-1" />
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
              <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
                <Link href="/reports" className="px-4 py-2 rounded-md hover:bg-white hover:shadow-sm font-medium text-gray-600 hover:text-gray-800 transition-all">
                  Penjualan
                </Link>
                <Link href="/reports/financial" className="px-4 py-2 rounded-md hover:bg-white hover:shadow-sm font-medium text-gray-600 hover:text-gray-800 transition-all">
                  Keuangan
                </Link>
                <Link href="/reports/daily" className="px-4 py-2 rounded-md bg-white shadow-sm font-medium text-gray-800">
                  Harian
                </Link>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={fetchTransactions} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Filter Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label>Rentang Tanggal</Label>
                <DateRangePicker
                  dateRange={{ from: dateRange.from, to: dateRange.to }}
                  onDateRangeChange={(range) => setDateRange({ from: range?.from, to: range?.to })}
                />
              </div>
              <div>
                <Label>Kategori Produk</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Kategori</SelectItem>
                    {categoriesList.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Metode Pembayaran</Label>
                <Select value={selectedPayment} onValueChange={setSelectedPayment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Metode</SelectItem>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="CARD">CARD</SelectItem>
                    <SelectItem value="QRIS">QRIS</SelectItem>
                    <SelectItem value="MIDTRANS">MIDTRANS</SelectItem>
                    <SelectItem value="BANK_TRANSFER">BANK_TRANSFER</SelectItem>
                    <SelectItem value="VIRTUAL_ACCOUNT">VIRTUAL_ACCOUNT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status Transaksi</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua Status</SelectItem>
                    <SelectItem value="PAID">PAID</SelectItem>
                    <SelectItem value="PENDING">PENDING</SelectItem>
                    <SelectItem value="CANCELED">CANCELED</SelectItem>
                    <SelectItem value="COMPLETED">COMPLETED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cari (Nama Produk / No. Transaksi)</Label>
                <div className="relative">
                  <SearchIcon className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                  <Input
                    className="pl-8"
                    placeholder="Misal: Kopi Latte atau #123"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Penjualan</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <Skeleton className="h-8 w-32" /> : <span className="font-semibold">{formatCurrency((backendSummary ?? clientSummary).totalSales)}</span>}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Jumlah Transaksi</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <Skeleton className="h-8 w-24" /> : <span className="font-semibold">{(backendSummary ?? clientSummary).transactionCount}</span>}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <Skeleton className="h-8 w-40" /> : <span className="font-semibold">{(backendSummary ?? clientSummary).topProductName}</span>}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Rata-rata Nilai Transaksi</CardTitle>
            </CardHeader>
            <CardContent>{loading ? <Skeleton className="h-8 w-32" /> : <span className="font-semibold">{formatCurrency((backendSummary ?? clientSummary).avgTransaction)}</span>}</CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCSV} variant="outline" className="bg-white">
            <Download className="h-4 w-4 mr-2" /> Ekspor CSV
          </Button>
          <Button onClick={exportExcel} variant="outline" className="bg-white">
            <Download className="h-4 w-4 mr-2" /> Ekspor Excel (.xls)
          </Button>
          <Button onClick={exportPDF} variant="outline" className="bg-white">
            <Download className="h-4 w-4 mr-2" /> Ekspor PDF
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Detail Penjualan Harian</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : (
              <div className="overflow-x-auto" ref={tableRef}>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("transactionId")}>Nomor Transaksi</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("dateTime")}>Tanggal/Waktu</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("productName")}>Nama Produk</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("categoryName")}>Kategori</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("quantity")}>Jumlah Terjual</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("unitPrice")}>Harga Satuan</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => toggleSort("itemTotal")}>Total Per Item</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Pelanggan</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metode Pembayaran</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-3 text-center text-gray-500">Tidak ada data untuk filter ini</td>
                      </tr>
                    ) : (
                      pagedRows.map((r, idx) => (
                        <tr key={`${r.transactionId}-${idx}`} className={`${rowTintClass(r.status)} hover:bg-muted/20`}>
                          <td className="px-4 py-2 text-sm text-gray-900">#{r.transactionId}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatDateTime(r.dateTime)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.productName}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.categoryName}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-700">{r.quantity}</td>
                          <td className="px-4 py-2 text-sm text-right text-gray-700">{formatCurrency(r.unitPrice)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(r.itemTotal)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.customerName || "-"}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{r.paymentMethod}</td>
                          <td className={`px-4 py-2 text-xs font-semibold rounded flex items-center ${statusClass(r.status)} w-fit`}>
                            {statusIcon(r.status)}
                            {r.status}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Halaman {page}</span>
                <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</Button>
                <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={(page * pageSize) >= sortedRows.length}>Berikutnya</Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Baris per halaman</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
