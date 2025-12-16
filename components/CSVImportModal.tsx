"use client"

import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import toast from 'react-hot-toast'

interface CSVImportModalProps {
  open: boolean
  onClose: () => void
  onImported?: (summary: { createdCount: number; updatedCount?: number; skippedCount: number; totalRows: number }) => void
  importEndpoint?: string
}

function splitCSVRow(row: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const char = row[i]
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result.map((s) => s.trim())
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = splitCSVRow(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVRow(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return { headers, rows }
}

export default function CSVImportModal({ open, onClose, onImported, importEndpoint = '/api/v1/products/import' }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [importSummary, setImportSummary] = useState<{ createdCount: number; updatedCount?: number; skippedCount: number; totalRows: number } | null>(null)
  const [skippedErrors, setSkippedErrors] = useState<{ index: number; error?: string }[]>([])
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update' | 'overwrite'>('skip')
  const [autoCreateCategory, setAutoCreateCategory] = useState<boolean>(false)

  const resetState = () => {
    setFile(null)
    setError(null)
    setHeaders([])
    setPreviewRows([])
    setImportSummary(null)
    setSkippedErrors([])
    setIsImporting(false)
    setDuplicateStrategy('skip')
    setAutoCreateCategory(false)
  }

  const validateCsvFile = (f: File) => {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.csv')) {
      return false
    }
    return true
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null
    setImportSummary(null)
    setSkippedErrors([])
    if (!f) {
      setFile(null)
      setHeaders([])
      setPreviewRows([])
      return
    }
    if (!validateCsvFile(f)) {
      setError('Format file tidak valid. Harap unggah file dengan ekstensi .csv')
      setFile(null)
      setHeaders([])
      setPreviewRows([])
      return
    }
    setError(null)
    setFile(f)

    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      const parsed = parseCSV(text)
      setHeaders(parsed.headers)
      setPreviewRows(parsed.rows.slice(0, 10))
    }
    reader.readAsText(f)
  }

  const handleConfirmImport = async () => {
    if (!file) {
      setError('Silakan pilih file CSV terlebih dahulu')
      return
    }
    try {
      setIsImporting(true)
      const text = await file.text()
      const res = await apiFetch(importEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text, duplicateStrategy, autoCreateCategory })
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Gagal mengimpor CSV')
      }
      const summary = data?.summary
      setImportSummary(summary || null)
      const errors = Array.isArray(data?.results)
        ? data.results.filter((r: any) => r.status === 'skipped' && r.error).map((r: any) => ({ index: r.index, error: r.error }))
        : []
      setSkippedErrors(errors)
      toast.success(`Import selesai: ${summary?.createdCount || 0} dibuat, ${summary?.updatedCount || 0} diperbarui, ${summary?.skippedCount || 0} dilewati`)
      onImported?.(summary)
    } catch (err: any) {
      const msg = err?.message || 'Terjadi kesalahan saat import'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsImporting(false)
    }
  }

  // Tambah tombol Unduh Template ke dalam modal
  const downloadTemplate = () => {
    const headers = ['name','price','stock','categoryId','categoryName','size','color','description','costPrice','productCode','isActive','image']
    const example = ['Kaos Polos','50000','100','','Fashion','L','Hitam','Kaos lengan pendek','30000','KSP-001','true','https://example.com/image.jpg']
    const csvContent = [headers.join(','), example.join(',')].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'template_import_produk.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] p-0">
        <div className="bg-white flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6">
            <DialogTitle className="text-lg font-semibold text-gray-900">Import CSV Produk</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-600">Unggah file CSV, lihat preview data, lalu konfirmasi untuk memulai impor.</DialogDescription>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
            {/* File Upload */}
            <div>
              <label htmlFor="csv-upload" className="block text-sm font-medium text-gray-700 mb-1">File CSV</label>
              <input id="csv-upload" type="file" accept=".csv" onChange={handleFileChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
              <p className="text-xs text-gray-500 mt-2">Format yang didukung: .csv. Pastikan header seperti: <code>name</code>, <code>price</code>, <code>categoryId</code>/<code>categoryName</code>, <code>size</code>, <code>color</code>.</p>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Strategi duplikat</label>
                <select value={duplicateStrategy} onChange={(e) => setDuplicateStrategy(e.target.value as 'skip' | 'update' | 'overwrite')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="skip">Skip (lewati)</option>
                  <option value="update">Update (perbarui field yang diisi)</option>
                  <option value="overwrite">Overwrite (timpa & kosongkan field optional)</option>
                </select>
              </div>
              <div className="flex items-center mt-6">
                <label className="flex items-center">
                  <input type="checkbox" checked={autoCreateCategory} onChange={(e) => setAutoCreateCategory(e.target.checked)} className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Auto-create kategori dari <code>categoryName</code></span>
                </label>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">{error}</div>
            )}

            {/* Preview */}
            {headers.length > 0 && previewRows.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Preview (10 baris pertama)</div>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewRows.map((row, idx) => (
                        <tr key={idx}>
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">{row[h] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">Kolom wajib: <code>name</code>, <code>price</code>, <code>categoryId</code>/<code>categoryName</code>, <code>size</code>, <code>color</code>.</p>
              </div>
            )}

            {/* Summary & Errors */}
            {importSummary && (
              <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                <div className="text-sm text-gray-700">
                  <span className="font-medium">Ringkasan:</span> {importSummary.createdCount} dibuat, {importSummary.updatedCount || 0} diperbarui, {importSummary.skippedCount} dilewati dari {importSummary.totalRows} baris.
                </div>
                {skippedErrors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-gray-700">Detail error (maks 10):</div>
                    <ul className="mt-1 space-y-1 max-h-40 overflow-auto">
                      {skippedErrors.slice(0, 10).map((e) => (
                        <li key={e.index} className="text-xs text-red-700">Baris {e.index}: {e.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-3 border-t flex items-center justify-between bg-white">
            <button onClick={downloadTemplate} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Unduh Template</button>
            <div className="flex items-center space-x-2">
              <button onClick={handleClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Batal</button>
              <button onClick={handleConfirmImport} disabled={isImporting || !file} className={`px-4 py-2 rounded-lg text-white ${isImporting || !file ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>{isImporting ? 'Mengimpor...' : 'Konfirmasi Import'}</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
