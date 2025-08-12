"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  ArrowLeftIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

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
}

export default function NewProductPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<ProductForm>({
    name: '',
    description: '',
    price: '',
    costPrice: '',
    stock: '',
    categoryId: '',
    image: '',
  })
  const [errors, setErrors] = useState<Partial<ProductForm>>({})

  // Fetcher function for SWR
  const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch data')
    }
    return response.json()
  }

  // Fetch categories with SWR
  const { data: categoriesData, error: categoriesError } = useSWR('/api/categories', fetcher)

  // Set categories data
  useEffect(() => {
    if (categoriesData) {
      const transformedCategories = categoriesData.map((category: any) => ({
        id: category.id.toString(),
        name: category.name
      }))
      setCategories(transformedCategories)
    }
  }, [categoriesData])

  // Handle category errors with fallback data
  useEffect(() => {
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      toast.error('Gagal memuat data kategori')
      // Fallback to sample data if API fails - using fashion categories
      setCategories([
        { id: '1', name: 'Atasan' },
        { id: '2', name: 'Bawahan' },
        { id: '3', name: 'Aksesoris' },
        { id: '4', name: 'Sepatu' },
      ])
    }
  }, [categoriesError])

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
      // Prepare product data
      const productData = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        costPrice: form.costPrice.trim() ? Number(form.costPrice) : 0,
        stock: Number(form.stock),
        categoryId: form.categoryId,
        image: form.image,
        isActive: true
      }
      
      // Make actual API call
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create product')
      }
      
      const result = await response.json()
      console.log('Product created:', result)
      
      toast.success('Produk berhasil ditambahkan!')
      router.push('/products')
    } catch (error) {
      console.error('Error creating product:', error)
      toast.error(`Gagal menambahkan produk: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        toast.success('Gambar berhasil dipilih')
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            <Link href="/products" className="mr-4">
              <ArrowLeftIcon className="h-6 w-6 text-gray-600 hover:text-gray-900" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Tambah Produk</h1>
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
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
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
                  Harga Jual (IDR) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={form.price}
                    onChange={handleInputChange}
                    min="0"
                    step="1000"
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
                  HPP (IDR)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">Rp</span>
                  </div>
                  <input
                    type="number"
                    id="costPrice"
                    name="costPrice"
                    value={form.costPrice}
                    onChange={handleInputChange}
                    min="0"
                    step="1000"
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
                  Stok Awal *
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

            {/* Form Actions */}
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
                  'Simpan Produk'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Tips:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Gunakan nama produk yang jelas dan mudah dipahami</li>
            <li>• Pastikan harga sesuai dengan standar pasar</li>
            <li>• Stok awal dapat diubah nanti melalui halaman manajemen stok</li>
            <li>• Gambar produk akan membantu kasir mengidentifikasi produk</li>
          </ul>
        </div>
      </main>
    </div>
  )
}