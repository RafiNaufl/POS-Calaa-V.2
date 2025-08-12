"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { PhotoIcon, XCircleIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline"
import toast from "react-hot-toast"

interface Category {
  id: string
  name: string
}

interface ProductForm {
  name: string
  productCode: string
  description: string
  price: string
  costPrice: string
  stock: string
  categoryId: string
  image: string
  size: string
  color: string
}

interface EditProductFormProps {
  productId: string
  onClose: () => void
  onSuccess: () => void
}

export default function EditProductForm({ productId, onClose, onSuccess }: EditProductFormProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProduct, setLoadingProduct] = useState(true)
  const [form, setForm] = useState<ProductForm>({
    name: '',
    productCode: '',
    description: '',
    price: '',
    costPrice: '',
    stock: '',
    categoryId: '',
    image: '',
    size: '',
    color: ''
  })
  const [errors, setErrors] = useState<Partial<ProductForm>>({})
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("") // Untuk menyimpan nama kategori yang dipilih

  // Load categories and product data
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch('/api/categories')
        if (!response.ok) {
          throw new Error('Failed to fetch categories')
        }
        const data = await response.json()
        setCategories(data)
      } catch (error) {
        console.error('Error fetching categories:', error)
        toast.error('Gagal memuat data kategori')
      }
    }

    const fetchProduct = async () => {
      try {
        const response = await fetch(`/api/products/${productId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch product')
        }
        const product = await response.json()
        
        setForm({
          name: product.name,
          productCode: product.productCode || '',
          description: product.description || '',
          price: product.price.toString(),
          costPrice: product.costPrice?.toString() || '',
          stock: product.stock.toString(),
          categoryId: product.categoryId,
          image: product.image || '',
          size: product.size || '',
          color: product.color || '',
        })
        
        // Set selected category name
        const category = await fetchCategoryById(product.categoryId)
        if (category) {
          setSelectedCategoryName(category.name)
        }
      } catch (error) {
        console.error('Error fetching product:', error)
        toast.error('Gagal memuat data produk')
      } finally {
        setLoadingProduct(false)
      }
    }
    
    // Helper function to fetch category by ID
    const fetchCategoryById = async (categoryId: string) => {
      try {
        const response = await fetch(`/api/categories/${categoryId}`)
        if (!response.ok) return null
        return await response.json()
      } catch (error) {
        console.error('Error fetching category:', error)
        return null
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
    
    // Jika yang berubah adalah kategori, update selectedCategoryName
    if (name === "categoryId") {
      const selectedCategory = categories.find(cat => cat.id === value)
      setSelectedCategoryName(selectedCategory?.name || "")
      
      // Reset ukuran jika kategori berubah
      if (selectedCategory?.name === "Atasan") {
        // Default ke ukuran S jika kategori adalah Atasan
        setForm(prev => ({ ...prev, size: "S" }))
      } else if (selectedCategory?.name === "Bawahan") {
        // Default ke ukuran S jika kategori adalah Bawahan
        setForm(prev => ({ ...prev, size: "S" }))
      } else if (selectedCategory?.name === "Sepatu") {
        // Default ke ukuran 38 jika kategori adalah Sepatu
        setForm(prev => ({ ...prev, size: "38" }))
      } else {
        // Reset ukuran jika kategori lainnya
        setForm(prev => ({ ...prev, size: "" }))
      }
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<ProductForm> = {}

    if (!form.name.trim()) {
      newErrors.name = 'Nama produk wajib diisi'
    }
    
    if (!form.productCode.trim()) {
      newErrors.productCode = 'Kode produk wajib diisi'
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

    if (!form.size.trim()) {
      newErrors.size = 'Ukuran wajib diisi'
    }

    if (!form.color.trim()) {
      newErrors.color = 'Warna wajib diisi'
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
        productCode: form.productCode.trim(),
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
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Gagal memperbarui produk')
      }
      
      onSuccess()
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
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Memuat data produk...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Produk</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
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
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Masukkan nama produk"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Product Code */}
        <div>
          <label htmlFor="productCode" className="block text-sm font-medium text-gray-700 mb-2">
            Kode Produk *
          </label>
          <input
            type="text"
            id="productCode"
            name="productCode"
            value={form.productCode}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.productCode ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Masukkan kode produk"
          />
          {errors.productCode && (
            <p className="mt-1 text-sm text-red-600">{errors.productCode}</p>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                Rp
              </span>
              <input
                type="text"
                id="price"
                name="price"
                value={formatCurrency(form.price)}
                onChange={handlePriceChange}
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                Rp
              </span>
              <input
                type="text"
                id="costPrice"
                name="costPrice"
                value={formatCurrency(form.costPrice)}
                onChange={handleCostPriceChange}
                className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
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
            {selectedCategoryName === "Atasan" ? (
              <select
                id="size"
                name="size"
                value={form.size}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
              </select>
            ) : selectedCategoryName === "Bawahan" ? (
              <select
                id="size"
                name="size"
                value={form.size}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
                <option value="XXL">XXL</option>
              </select>
            ) : selectedCategoryName === "Sepatu" ? (
              <select
                id="size"
                name="size"
                value={form.size}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {Array.from({ length: 21 }, (_, i) => i + 30).map(size => (
                  <option key={size} value={size.toString()}>{size}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                id="size"
                name="size"
                value={form.size}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Contoh: S, M, L, XL, 38, 40, dll"
              />
            )}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Contoh: Merah, Biru, Motif Bunga, dll"
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
  )
}