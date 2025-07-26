'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

interface Product {
  id: string
  name: string
  price: number
}

interface Category {
  id: string
  name: string
}

interface Promotion {
  id: string
  name: string
  description?: string
  type: string
  discountValue: number
  discountType: string
  minQuantity?: number
  buyQuantity?: number
  getQuantity?: number
  startDate: string
  endDate: string
  isActive: boolean
  productPromotions: {
    product: Product
  }[]
  categoryPromotions: {
    category: Category
  }[]
}

export default function PromotionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null)
  const [filterActive, setFilterActive] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PRODUCT_DISCOUNT',
    discountValue: 0,
    discountType: 'PERCENTAGE',
    minQuantity: undefined as number | undefined,
    buyQuantity: undefined as number | undefined,
    getQuantity: undefined as number | undefined,
    startDate: '',
    endDate: '',
    productIds: [] as string[],
    categoryIds: [] as string[],
    isActive: true
  })

  const fetchPromotions = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterActive !== 'all') params.append('active', filterActive)
      if (filterType !== 'all') params.append('type', filterType)

      const response = await fetch(`/api/promotions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setPromotions(data)
      }
    } catch (error) {
      console.error('Error fetching promotions:', error)
    } finally {
      setLoading(false)
    }
  }, [filterActive, filterType])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    fetchPromotions()
    fetchProducts()
    fetchCategories()
  }, [session, status, router, fetchPromotions])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      if (response.ok) {
        const data = await response.json()
        setProducts(data)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Validasi form
      if (!formData.name) {
        alert('Nama promosi harus diisi')
        return
      }

      if (formData.discountValue <= 0) {
        alert('Nilai diskon harus lebih dari 0')
        return
      }

      if (formData.type === 'BULK_DISCOUNT' && (!formData.minQuantity || formData.minQuantity <= 0)) {
        alert('Kuantitas minimum harus diisi dan lebih dari 0')
        return
      }

      if (formData.type === 'BUY_X_GET_Y' && (!formData.buyQuantity || formData.buyQuantity <= 0 || !formData.getQuantity || formData.getQuantity <= 0)) {
        alert('Kuantitas beli dan gratis harus diisi dan lebih dari 0')
        return
      }

      if ((formData.type === 'PRODUCT_DISCOUNT' || formData.type === 'BUY_X_GET_Y') && formData.productIds.length === 0) {
        alert('Pilih setidaknya satu produk untuk promosi ini')
        return
      }

      if ((formData.type === 'CATEGORY_DISCOUNT' || formData.type === 'BULK_DISCOUNT') && formData.categoryIds.length === 0) {
        alert('Pilih setidaknya satu kategori untuk promosi ini')
        return
      }

      if (!formData.startDate || !formData.endDate) {
        alert('Tanggal mulai dan tanggal berakhir harus diisi')
        return
      }

      const url = editingPromotion ? `/api/promotions/${editingPromotion.id}` : '/api/promotions'
      const method = editingPromotion ? 'PUT' : 'POST'
      
      // Format tanggal ke ISO string yang valid untuk Prisma
      const formatDateForPrisma = (dateString: string) => {
        try {
          // Pastikan format tanggal valid dengan menambahkan 'Z' untuk UTC timezone
          // Format input: YYYY-MM-DDThh:mm
          // Format output: YYYY-MM-DDThh:mm:00.000Z
          const date = new Date(dateString);
          return date.toISOString();
        } catch (error) {
          console.error('Error formatting date:', error);
          throw new Error(`Format tanggal tidak valid: ${dateString}`);
        }
      };
      
      // Siapkan data untuk dikirim
      const dataToSend = {
        ...formData,
        discountValue: Number(formData.discountValue),
        minQuantity: formData.minQuantity || undefined,
        buyQuantity: formData.buyQuantity || undefined,
        getQuantity: formData.getQuantity || undefined,
        productIds: formData.productIds.length > 0 ? formData.productIds : undefined,
        categoryIds: formData.categoryIds.length > 0 ? formData.categoryIds : undefined,
        startDate: formatDateForPrisma(formData.startDate),
        endDate: formatDateForPrisma(formData.endDate)
      }

      console.log('Sending data:', dataToSend)
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSend)
      })

      if (response.ok) {
        setShowForm(false)
        setEditingPromotion(null)
        resetForm()
        fetchPromotions()
        alert(`Promosi berhasil ${editingPromotion ? 'diperbarui' : 'dibuat'}`)
      } else {
        const errorData = await response.json()
        console.error('API error response:', errorData)
        alert(errorData.error || `Error ${editingPromotion ? 'memperbarui' : 'membuat'} promosi`)
      }
    } catch (error) {
      console.error(`Error ${editingPromotion ? 'updating' : 'creating'} promotion:`, error)
      alert(`Terjadi kesalahan saat ${editingPromotion ? 'memperbarui' : 'membuat'} promosi. Silakan coba lagi.`)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'PRODUCT_DISCOUNT',
      discountValue: 0,
      discountType: 'PERCENTAGE',
      minQuantity: undefined,
      buyQuantity: undefined,
      getQuantity: undefined,
      startDate: '',
      endDate: '',
      productIds: [],
      categoryIds: [],
      isActive: true
    })
  }

  const handleEdit = (promotion: Promotion) => {
    try {
      setEditingPromotion(promotion)
      
      // Format tanggal dengan aman untuk input datetime-local
      // Format yang dibutuhkan: YYYY-MM-DDThh:mm
      let startDateFormatted = '';
      let endDateFormatted = '';
      
      if (promotion.startDate) {
        try {
          const startDate = new Date(promotion.startDate);
          if (!isNaN(startDate.getTime())) { // Pastikan tanggal valid
            startDateFormatted = startDate.toISOString().slice(0, 16);
          }
        } catch (error) {
          console.error('Error formatting start date:', error);
        }
      }
      
      if (promotion.endDate) {
        try {
          const endDate = new Date(promotion.endDate);
          if (!isNaN(endDate.getTime())) { // Pastikan tanggal valid
            endDateFormatted = endDate.toISOString().slice(0, 16);
          }
        } catch (error) {
          console.error('Error formatting end date:', error);
        }
      }
      
      // Jika tanggal tidak bisa diformat, tampilkan pesan error
      if (!startDateFormatted || !endDateFormatted) {
        console.warn('Beberapa tanggal tidak bisa diformat dengan benar');
      }
      
      setFormData({
        name: promotion.name,
        description: promotion.description || '',
        type: promotion.type,
        discountValue: promotion.discountValue,
        discountType: promotion.discountType,
        minQuantity: promotion.minQuantity || undefined,
        buyQuantity: promotion.buyQuantity || undefined,
        getQuantity: promotion.getQuantity || undefined,
        startDate: startDateFormatted,
        endDate: endDateFormatted,
        productIds: promotion.productPromotions?.map(pp => pp.product.id) || [],
        categoryIds: promotion.categoryPromotions?.map(cp => cp.category.id) || [],
        isActive: promotion.isActive
      })
      setShowForm(true)
    } catch (error) {
      console.error('Error editing promotion:', error);
      alert('Terjadi kesalahan saat mengedit promosi. Silakan coba lagi.');
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingPromotion(null)
    resetForm()
  }

  const handleDelete = async (promotion: Promotion) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus promosi "${promotion.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/promotions/${promotion.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchPromotions()
      } else {
        const error = await response.json()
        alert(error.error || 'Error deleting promotion')
      }
    } catch (error) {
      console.error('Error deleting promotion:', error)
      alert('Error deleting promotion')
    }
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

  const getPromotionTypeLabel = (type: string) => {
    switch (type) {
      case 'PRODUCT_DISCOUNT': return 'Diskon Produk'
      case 'CATEGORY_DISCOUNT': return 'Diskon Kategori'
      case 'BULK_DISCOUNT': return 'Diskon Grosir'
      case 'BUY_X_GET_Y': return 'Beli X Dapat Y'
      default: return type
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
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
          <h1 className="text-3xl font-bold text-gray-800">Manajemen Promosi</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Tambah Promosi
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipe Promosi
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Semua</option>
              <option value="PRODUCT_DISCOUNT">Diskon Produk</option>
              <option value="CATEGORY_DISCOUNT">Diskon Kategori</option>
              <option value="BULK_DISCOUNT">Diskon Grosir</option>
              <option value="BUY_X_GET_Y">Beli X Dapat Y</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchPromotions}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Promotions List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Diskon
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Target
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
              {promotions.map((promotion) => {
                const now = new Date()
                const startDate = new Date(promotion.startDate)
                const endDate = new Date(promotion.endDate)
                const isExpired = now > endDate
                const isNotStarted = now < startDate
                
                return (
                  <tr key={promotion.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{promotion.name}</div>
                        {promotion.description && (
                          <div className="text-gray-500 text-xs">{promotion.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                        {getPromotionTypeLabel(promotion.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {promotion.discountType === 'PERCENTAGE' ? `${promotion.discountValue}%` : formatCurrency(promotion.discountValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {promotion.productPromotions.length > 0 && (
                          <div className="text-xs text-blue-600">
                            {promotion.productPromotions.length} Produk
                          </div>
                        )}
                        {promotion.categoryPromotions.length > 0 && (
                          <div className="text-xs text-green-600">
                            {promotion.categoryPromotions.length} Kategori
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{formatDate(promotion.startDate)}</div>
                        <div className="text-gray-500">s/d {formatDate(promotion.endDate)}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        !promotion.isActive ? 'bg-gray-100 text-gray-800' :
                        isExpired ? 'bg-red-100 text-red-800' :
                        isNotStarted ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {!promotion.isActive ? 'Tidak Aktif' :
                         isExpired ? 'Kedaluwarsa' :
                         isNotStarted ? 'Belum Dimulai' :
                         'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(promotion)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit Promosi"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(promotion)}
                          className="text-red-600 hover:text-red-800"
                          title="Hapus Promosi"
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

      {/* Create Promotion Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">Tambah Promosi Baru</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Promosi
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jenis Promosi
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Pilih Jenis Promosi</option>
                  <option value="PRODUCT_DISCOUNT">Diskon Produk</option>
                  <option value="CATEGORY_DISCOUNT">Diskon Kategori</option>
                  <option value="BULK_DISCOUNT">Diskon Bulk</option>
                  <option value="BUY_X_GET_Y">Beli X Gratis Y</option>
                </select>
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Nilai Diskon
                 </label>
                 <input
                   type="number"
                   step="0.01"
                   min="0"
                   value={formData.discountValue}
                   onChange={(e) => setFormData({...formData, discountValue: parseFloat(e.target.value) || 0})}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   required
                 />
                 <p className="text-sm text-gray-500 mt-1">
                   Untuk persentase: 0-100, untuk nominal tetap: nilai dalam rupiah
                 </p>
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">
                   Tipe Diskon
                 </label>
                 <select
                   value={formData.discountType}
                   onChange={(e) => setFormData({...formData, discountType: e.target.value})}
                   className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                   required
                 >
                   <option value="PERCENTAGE">Persentase (%)</option>
                   <option value="FIXED">Nominal Tetap (Rp)</option>
                 </select>
               </div>

              {formData.type === 'BULK_DISCOUNT' && (
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     Minimum Kuantitas
                   </label>
                   <input
                     type="number"
                     min="1"
                     value={formData.minQuantity || ''}
                     onChange={(e) => setFormData({...formData, minQuantity: parseInt(e.target.value) || undefined})}
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                     required
                   />
                 </div>
               )}

              {formData.type === 'BUY_X_GET_Y' && (
                 <>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Beli Kuantitas (X)
                     </label>
                     <input
                       type="number"
                       min="1"
                       value={formData.buyQuantity || ''}
                       onChange={(e) => setFormData({...formData, buyQuantity: parseInt(e.target.value) || undefined})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                       required
                     />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">
                       Gratis Kuantitas (Y)
                     </label>
                     <input
                       type="number"
                       min="1"
                       value={formData.getQuantity || ''}
                       onChange={(e) => setFormData({...formData, getQuantity: parseInt(e.target.value) || undefined})}
                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                       required
                     />
                   </div>
                 </>
               )}

              {/* Product Selection */}
              {(formData.type === 'PRODUCT_DISCOUNT' || formData.type === 'BUY_X_GET_Y') && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Pilih Produk
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        // Pilih semua produk
                        const allProductIds = products.map(product => product.id);
                        setFormData({
                          ...formData,
                          productIds: allProductIds
                        });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Pilih Semua
                    </button>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {products.map((product) => (
                      <label key={product.id} className="flex items-center space-x-2 p-1">
                        <input
                          type="checkbox"
                          checked={formData.productIds.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                productIds: [...formData.productIds, product.id]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                productIds: formData.productIds.filter(id => id !== product.id)
                              })
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{product.name} - {formatCurrency(product.price)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Selection */}
              {(formData.type === 'CATEGORY_DISCOUNT' || formData.type === 'BULK_DISCOUNT') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pilih Kategori
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2">
                    {categories.map((category) => (
                      <label key={category.id} className="flex items-center space-x-2 p-1">
                        <input
                          type="checkbox"
                          checked={formData.categoryIds.includes(category.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                categoryIds: [...formData.categoryIds, category.id]
                              })
                            } else {
                              setFormData({
                                ...formData,
                                categoryIds: formData.categoryIds.filter(id => id !== category.id)
                              })
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{category.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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

              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan Promosi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}