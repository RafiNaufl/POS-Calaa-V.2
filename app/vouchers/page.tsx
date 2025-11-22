"use client"

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Navbar from '@/components/Navbar'
import { apiFetch } from '@/lib/api'

interface Voucher {
  id: string
  code: string
  name: string
  description?: string
  type: string
  value: number
  minPurchase?: number
  maxDiscount?: number
  usageLimit?: number
  usageCount: number
  perUserLimit?: number
  startDate: string
  endDate: string
  isActive: boolean
  createdAt: string
}

export default function VouchersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null)
  const [searchCode, setSearchCode] = useState('')
  const [searchName, setSearchName] = useState('')
  const [filterActive, setFilterActive] = useState<string>('all')

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    type: 'percentage',
    value: 0,
    minPurchase: '',
    maxDiscount: '',
    usageLimit: '',
    perUserLimit: '',
    startDate: '',
    endDate: '',
    isActive: true
  })

  const fetchVouchers = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (searchCode) params.append('code', searchCode)
      if (searchName) params.append('name', searchName)
      if (filterActive !== 'all') params.append('active', filterActive)

      const response = await apiFetch(`/api/v1/vouchers?${params}`)
      if (response.ok) {
        const data = await response.json()
        const raw = Array.isArray(data) ? data : (data.vouchers || [])
        const normalized: Voucher[] = raw.map((v: any) => ({
          id: v.id,
          code: v.code,
          name: v.name,
          description: v.description,
          type: v.type,
          value: Number(v.value || 0),
          minPurchase: v.minPurchase != null ? Number(v.minPurchase) : undefined,
          maxDiscount: v.maxDiscount != null ? Number(v.maxDiscount) : undefined,
          usageLimit: v.maxUses != null ? Number(v.maxUses) : undefined,
          usageCount: Number(v.usedCount || 0),
          perUserLimit: v.maxUsesPerUser != null ? Number(v.maxUsesPerUser) : undefined,
          startDate: v.startDate,
          endDate: v.endDate,
          isActive: Boolean(v.isActive),
          createdAt: v.createdAt
        }))
        setVouchers(normalized)
      }
    } catch (error) {
      console.error('Error fetching vouchers:', error)
    } finally {
      setLoading(false)
    }
  }, [searchCode, searchName, filterActive])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    fetchVouchers()
  }, [authLoading, user, router, fetchVouchers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Validate form data
      if (!formData.code.trim()) {
        alert('Kode voucher harus diisi')
        return
      }
      if (!formData.name.trim()) {
        alert('Nama voucher harus diisi')
        return
      }
      if (formData.value === undefined || formData.value < 0) {
        alert('Nilai voucher harus diisi dengan nilai yang valid')
        return
      }
      if (!formData.startDate) {
        alert('Tanggal mulai harus diisi')
        return
      }
      if (!formData.endDate) {
        alert('Tanggal berakhir harus diisi')
        return
      }
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        alert('Tanggal mulai tidak boleh lebih besar dari tanggal berakhir')
        return
      }

      const url = editingVoucher ? `/api/v1/vouchers/${editingVoucher.id}` : '/api/v1/vouchers'
      const method = editingVoucher ? 'PUT' : 'POST'
      
      const response = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          // Map to backend shape: lowercase type, maxUses, omit perUserLimit
          code: editingVoucher ? undefined : formData.code.toUpperCase().trim(),
          name: formData.name.trim(),
          description: formData.description.trim(),
          type: (formData.type || '').toString().toLowerCase(),
          value: Number(formData.value),
          minPurchase: formData.minPurchase ? Number(formData.minPurchase) : null,
          maxDiscount: formData.maxDiscount ? Number(formData.maxDiscount) : null,
          maxUses: formData.usageLimit ? Number(formData.usageLimit) : null,
          maxUsesPerUser: formData.perUserLimit ? Number(formData.perUserLimit) : null,
          startDate: formData.startDate,
          endDate: formData.endDate,
          isActive: formData.isActive
        })
      })

      if (response.ok) {
        setShowForm(false)
        setEditingVoucher(null)
        resetForm()
        fetchVouchers()
      } else {
        const error = await response.json()
        alert(error.error || `Error ${editingVoucher ? 'updating' : 'creating'} voucher`)
      }
    } catch (error) {
      console.error(`Error ${editingVoucher ? 'updating' : 'creating'} voucher:`, error)
      alert(`Error ${editingVoucher ? 'updating' : 'creating'} voucher`)
    }
  }

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      type: 'percentage',
      value: 0,
      minPurchase: '',
      maxDiscount: '',
      usageLimit: '',
      perUserLimit: '',
      startDate: '',
      endDate: '',
      isActive: true
    })
  }



  const handleEdit = (voucher: Voucher) => {
    setEditingVoucher(voucher)
    setFormData({
      code: voucher.code,
      name: voucher.name,
      description: voucher.description || '',
      type: voucher.type,
      value: voucher.value,
      minPurchase: voucher.minPurchase?.toString() || '',
      maxDiscount: voucher.maxDiscount?.toString() || '',
      usageLimit: voucher.usageLimit?.toString() || '',
      perUserLimit: voucher.perUserLimit?.toString() || '',
      startDate: new Date(voucher.startDate).toISOString().slice(0, 16),
      endDate: new Date(voucher.endDate).toISOString().slice(0, 16),
      isActive: voucher.isActive
    })
    setShowForm(true)
  }

  const handleDelete = async (voucher: Voucher) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus voucher "${voucher.name}"?`)) {
      return
    }

    try {
      const response = await apiFetch(`/api/v1/vouchers/${voucher.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchVouchers()
      } else {
        const error = await response.json()
        alert(error.error || 'Error deleting voucher')
      }
    } catch (error) {
      console.error('Error deleting voucher:', error)
      alert('Error deleting voucher')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingVoucher(null)
    resetForm()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID')
  }

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Kembali
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Manajemen Voucher</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tambah Voucher
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cari Kode Voucher
            </label>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Masukkan kode voucher"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cari Nama Voucher
            </label>
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Masukkan nama voucher"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua</option>
              <option value="true">Aktif</option>
              <option value="false">Tidak Aktif</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchVouchers}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cari
            </button>
          </div>
        </div>
      </div>

      {/* Vouchers List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nilai
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Penggunaan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Periode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vouchers.map((voucher) => {
                const now = new Date()
                const startDate = new Date(voucher.startDate)
                const endDate = new Date(voucher.endDate)
                const isExpired = now > endDate
                const isNotStarted = now < startDate
                
                return (
                  <tr key={voucher.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {voucher.code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-[180px] sm:max-w-none break-words">{voucher.name}</div>
                        {voucher.description && (
                          <div className="text-xs sm:text-xs text-gray-500 truncate max-w-[200px] sm:max-w-none break-words">{voucher.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {voucher.type === 'percentage' ? 'Persentase' : 
                         voucher.type === 'fixed' ? 'Nominal Tetap' : 'Gratis Ongkir'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {voucher.type === 'percentage' ? `${voucher.value}%` : voucher.type === 'free_shipping' ? 'Gratis Ongkir' : formatCurrency(voucher.value)}
                      {voucher.minPurchase && (
                        <div className="text-xs text-gray-500">
                          Min: {formatCurrency(voucher.minPurchase)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {voucher.usageCount}
                      {voucher.usageLimit && ` / ${voucher.usageLimit}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{formatDate(voucher.startDate)}</div>
                        <div className="text-gray-500">s/d {formatDate(voucher.endDate)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        !voucher.isActive ? 'bg-gray-100 text-gray-800' :
                        isExpired ? 'bg-red-100 text-red-800' :
                        isNotStarted ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {!voucher.isActive ? 'Tidak Aktif' :
                         isExpired ? 'Kedaluwarsa' :
                         isNotStarted ? 'Belum Dimulai' :
                         'Aktif'}
                      </span>
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEdit(voucher)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit Voucher"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(voucher)}
                            className="text-red-600 hover:text-red-800"
                            title="Hapus Voucher"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Voucher Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editingVoucher ? 'Edit Voucher' : 'Tambah Voucher Baru'}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kode Voucher *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="DISKON10"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Voucher *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Diskon 10%"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Deskripsi voucher"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipe Voucher *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="percentage">Persentase</option>
                    <option value="fixed">Nominal Tetap</option>
                    <option value="free_shipping">Gratis Ongkir</option>
                  </select>
                  <div className="mt-2 p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
                    {formData.type === 'percentage' && (
                      <div>
                        <p className="font-medium">Voucher Persentase</p>
                        <p>Memberikan diskon berdasarkan persentase dari total belanja. Contoh: diskon 10% dari total belanja.</p>
                        <p className="mt-1">Anda dapat mengatur nilai maksimum diskon untuk membatasi jumlah diskon.</p>
                      </div>
                    )}
                    {formData.type === 'fixed' && (
                      <div>
                        <p className="font-medium">Voucher Nominal Tetap</p>
                        <p>Memberikan diskon dengan nilai tetap. Contoh: diskon Rp 50.000 dari total belanja.</p>
                      </div>
                    )}
                    {formData.type === 'free_shipping' && (
                      <div>
                        <p className="font-medium">Voucher Gratis Ongkir</p>
                        <p>Menghapus biaya pengiriman dari total belanja.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nilai {formData.type === 'percentage' ? '(%)' : '(Rp)'} *
                  </label>
                  <input
                    type="number"
                    required={formData.type !== 'free_shipping'}
                    min="0"
                    step="1"
                    max={formData.type === 'percentage' ? "100" : undefined}
                    inputMode="numeric"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={formData.type === 'percentage' ? '10' : '50000'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimal Pembelian (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={formData.minPurchase}
                    onChange={(e) => setFormData({ ...formData, minPurchase: Number(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maksimal Diskon (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: Number(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="50000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batas Total Penggunaan
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Batas Penggunaan per User
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={formData.perUserLimit}
                    onChange={(e) => setFormData({ ...formData, perUserLimit: Number(e.target.value) })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Mulai *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tanggal Berakhir *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {editingVoucher && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="isActive"
                        checked={formData.isActive === true}
                        onChange={() => setFormData({ ...formData, isActive: true })}
                        className="mr-2"
                      />
                      Aktif
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="isActive"
                        checked={formData.isActive === false}
                        onChange={() => setFormData({ ...formData, isActive: false })}
                        className="mr-2"
                      />
                      Tidak Aktif
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingVoucher ? 'Update Voucher' : 'Simpan Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
