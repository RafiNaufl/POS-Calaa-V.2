"use client"

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeftIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { apiFetch } from '@/lib/api'

interface Category {
  id: string
  name: string
}

interface ProductForm {
  name: string
  description: string
  price: string
  costPrice: string
  stock: string
  categoryId: string
  image: string
  size: string
  color: string
}

interface Product {
  id: string
  name: string
  description?: string
  price: number
  costPrice?: number
  stock: number
  category: string
  categoryName: string
  isActive: boolean
  createdAt: string
  image?: string
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProduct, setLoadingProduct] = useState(true)
  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    costPrice: '',
    stock: '',
    categoryId: '',
    image: '',
    size: '',
    color: '',
  })
  const [errors, setErrors] = useState<Partial<ProductForm>>({})

  // Fetch product data from API

  // Load categories and product data
  useEffect(() => {
    const fetchCategories = async () => {
      try {
const res = await apiFetch('/api/v1/categories')
        if (!res.ok) throw new Error('Failed to fetch categories')
        const data = await res.json()
        setCategories(Array.isArray(data) ? data : (Array.isArray((data as any)?.categories) ? (data as any).categories : []))
      } catch (error) {
        console.error('Error fetching categories:', error)
        toast.error('Gagal memuat data kategori')
      }
    }

    const fetchProduct = async () => {
      try {
const res = await apiFetch(`/api/v1/products/${productId}`)
        if (!res.ok) throw new Error('Failed to fetch product')
        const product = await res.json()
        
        setForm({
          name: product.name,
          description: product.description || '',
          price: product.price.toString(),
          costPrice: product.costPrice?.toString() || '',
          stock: product.stock.toString(),
          categoryId: product.categoryId,
          image: product.image || '',
          size: product.size || '',
          color: product.color || '',
        })
      } catch (error) {
        console.error('Error fetching product:', error)
        toast.error('Gagal memuat data produk')
      } finally {
        setLoadingProduct(false)
      }
    }

    fetchCategories()
    fetchProduct()
  }, [productId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (errors[name as keyof ProductForm]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<ProductForm> = {}

    if (!form.name.trim()) {
      newErrors.name = 'Nama produk wajib diisi'
    }

    if (!form.price.trim()) {
      newErrors.price = 'Harga wajib diisi'
    } else if (isNaN(Number(form.price)) || Number(form.price) <= 0) {
      newErrors.price = 'Harga harus berupa angka positif'
    }
    
    if (form.costPrice.trim() && (isNaN(Number(form.costPrice)) || Number(form.costPrice) < 0)) {
      newErrors.costPrice = 'Harga pokok harus berupa angka non-negatif'
    }

    if (!form.stock.trim()) {
      newErrors.stock = 'Stok wajib diisi'
    } else if (isNaN(Number(form.stock)) || Number(form.stock) < 0) {
      newErrors.stock = 'Stok harus berupa angka non-negatif'
    }

    if (!form.categoryId) {
      newErrors.categoryId = 'Kategori wajib dipilih'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Mohon periksa kembali form yang diisi')
      return
    }

    setLoading(true)
    
    try {
      // Prepare data for API
      const productData = {
        id: productId,
        name: form.name.trim(),
        price: form.price,
        costPrice: form.costPrice || '0',
        stock: form.stock,
        categoryId: form.categoryId,
        description: form.description.trim(),
        image: form.image,
        size: form.size.trim(),
        color: form.color.trim()
      }
      
      // Send to API
const res = await apiFetch(`/api/v1/products/${productId}`, {
  method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal memperbarui produk' }))
        throw new Error(errorData.error || 'Gagal memperbarui produk')
      }
      
      toast.success('Produk berhasil diperbarui!')
      router.push('/products')
    } catch (error) {
      console.error('Error updating product:', error)
      toast.error(error instanceof Error ? error.message : 'Gagal memperbarui produk')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: string) => {
    const number = value.replace(/\D/g, '')
    return new Intl.NumberFormat('id-ID').format(Number(number))
  }

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    setForm(prev => ({ ...prev, price: value }))
    
    if (errors.price) {
      setErrors(prev => ({ ...prev, price: '' }))
    }
  }
  
  const handleCostPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    setForm(prev => ({ ...prev, costPrice: value }))
    
    if (errors.costPrice) {
      setErrors(prev => ({ ...prev, costPrice: '' }))
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (2MB max)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran file terlalu besar. Maksimal 2MB')
        return
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('File harus berupa gambar')
        return
      }

      // Create preview URL
      const reader = new FileReader()
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string
        setForm(prev => ({ ...prev, image: imageUrl }))
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setForm(prev => ({ ...prev, image: '' }))
    // Reset file input
    const fileInput = document.getElementById('image-upload') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
  }

  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data produk...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Link href="/products" className="mr-4">
              <ArrowLeftIcon className="h-6 w-6 text-gray-600 hover:text-gray-900" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Edit Produk</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Product Image */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gambar Produk
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                  {form.image ? (
                    <>
                      <Image 
                        src={form.image} 
                        alt="Preview" 
                        width={96}
                        height={96}
                        className="w-full h-full object-cover rounded-lg"
                        unoptimized={true}
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                    </>
                  ) : (
                    <PhotoIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="image-upload"
                    onChange={handleImageChange}
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {form.image ? 'Ganti Gambar' : 'Pilih Gambar'}
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG hingga 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Product Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nama Produk *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Masukkan nama produk"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Deskripsi
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Masukkan deskripsi produk (opsional)"
              />
            </div>

            {/* Price, Cost Price, and Stock */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                  Harga Jual *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    id="price"
                    name="price"
                    value={formatCurrency(form.price)}
                    onChange={handlePriceChange}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.price ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                </div>
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600">{errors.price}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="costPrice" className="block text-sm font-medium text-gray-700 mb-2">
                  HPP
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="text"
                    id="costPrice"
                    name="costPrice"
                    value={formatCurrency(form.costPrice)}
                    onChange={handleCostPriceChange}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.costPrice ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="0"
                  />
                </div>
                {errors.costPrice && (
                  <p className="mt-1 text-sm text-red-600">{errors.costPrice}</p>
                )}
              </div>

              <div>
                <label htmlFor="stock" className="block text-sm font-medium text-gray-700 mb-2">
                  Stok *
                </label>
                <input
                  type="number"
                  id="stock"
                  name="stock"
                  value={form.stock}
                  onChange={handleInputChange}
                  min="0"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.stock ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="0"
                />
                {errors.stock && (
                  <p className="mt-1 text-sm text-red-600">{errors.stock}</p>
                )}
              </div>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                Kategori *
              </label>
              <select
                id="categoryId"
                name="categoryId"
                value={form.categoryId}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.categoryId ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Pilih kategori</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-sm text-red-600">{errors.categoryId}</p>
              )}
            </div>

            {/* Size and Color */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Size */}
              <div>
                <label htmlFor="size" className="block text-sm font-medium text-gray-700 mb-2">
                  Ukuran
                </label>
                <input
                  type="text"
                  id="size"
                  name="size"
                  value={form.size}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contoh: S, M, L, XL, 38, 40, dll"
                />
              </div>

              {/* Color */}
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-gray-700 mb-2">
                  Warna/Corak
                </label>
                <input
                  type="text"
                  id="color"
                  name="color"
                  value={form.color}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Contoh: Merah, Biru, Motif Bunga, dll"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Link
                href="/products"
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium shadow-sm"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}