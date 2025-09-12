"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import ProductImage from '@/components/ProductImage'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import EditProductForm from '../../components/EditProductForm'
import AddProductForm from '../../components/AddProductForm'
import Navbar from '@/components/Navbar'

interface Product {
  id: string
  name: string
  price: number
  costPrice?: number
  stock: number
  category: string
  categoryName: string
  isActive: boolean
  createdAt: string
  image?: string
  productCode?: string
  size: string
  color: string
}

interface Category {
  id: string
  name: string
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  // Fetcher function for SWR
  const fetcher = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch data')
    }
    return response.json()
  }

  // Fetch products with SWR for real-time updates
  const { data: productsData, error: productsError, isLoading: productsLoading, mutate: refreshProducts } = useSWR(
    '/api/products?includeInactive=true', 
    fetcher, 
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
      dedupingInterval: 2000
    }
  )

  // Fetch categories with SWR
  const { data: categoriesData, error: categoriesError } = useSWR('/api/categories', fetcher)

  // Transform products data
  useEffect(() => {
    if (productsData && productsData.products) {
      const transformedProducts = productsData.products.map((product: any) => ({
        id: product.id.toString(),
        name: product.name,
        description: product.description || '',
        price: product.price,
        costPrice: product.costPrice || 0,
        stock: product.stock,
        category: product.categoryId.toString(),
        categoryName: product.category?.name || '',
        isActive: product.isActive,
        createdAt: product.createdAt ? new Date(product.createdAt).toISOString().split('T')[0] : '',
        image: product.image,
        productCode: product.productCode || '',
        size: product.size || '',
        color: product.color || ''
      }))
      setProducts(transformedProducts)
      setLoading(false)
    }
  }, [productsData])

  // Set categories data
  useEffect(() => {
    if (categoriesData && Array.isArray(categoriesData)) {
      const transformedCategories = categoriesData.map((category: any) => ({
        id: category.id.toString(),
        name: category.name
      }))
      setCategories(transformedCategories)
    }
  }, [categoriesData])

  // Set loading state
  useEffect(() => {
    setLoading(productsLoading)
  }, [productsLoading])

  // Function to open edit modal
  const openEditModal = (productId: string) => {
    setSelectedProductId(productId)
    setIsEditModalOpen(true)
  }

  // Function to close edit modal
  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setSelectedProductId(null)
  }

  // Handle successful product edit
  const handleEditSuccess = () => {
    // Refresh product data
    refreshProducts()
    // Close the modal
    closeEditModal()
    // Show success message
    toast.success('Produk berhasil diperbarui')
  }

  // Handle product errors with fallback data
  useEffect(() => {
    if (productsError) {
      console.error('Error fetching products:', productsError)
      toast.error('Gagal memuat data produk')
      // Fallback to sample data if API fails - using fashion products
      setProducts([
        {
          id: '1',
          name: 'Kemeja Denim',
          price: 250000,
          stock: 20,
          category: '1',
          categoryName: 'Atasan',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&h=300&fit=crop&crop=center',
          size: 'L',
          color: 'Biru',
        },
        {
          id: '2',
          name: 'Kaos Polos',
          price: 120000,
          stock: 15,
          category: '1',
          categoryName: 'Atasan',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=300&fit=crop&crop=center',
          size: 'M',
          color: 'Putih',
        },
        {
          id: '3',
          name: 'Sweater Rajut',
          price: 300000,
          stock: 10,
          category: '1',
          categoryName: 'Atasan',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=400&h=300&fit=crop&crop=center',
          size: 'XL',
          color: 'Abu-abu',
        },
        {
          id: '4',
          name: 'Celana Jeans',
          price: 350000,
          stock: 50,
          category: '2',
          categoryName: 'Bawahan',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=300&fit=crop&crop=center',
          size: '32',
          color: 'Biru Tua',
        },
        {
          id: '5',
          name: 'Rok Panjang',
          price: 220000,
          stock: 25,
          category: '2',
          categoryName: 'Bawahan',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=400&h=300&fit=crop&crop=center',
          size: 'M',
          color: 'Hitam',
        },
        {
          id: '6',
          name: 'Celana Pendek',
          price: 180000,
          stock: 30,
          category: '2',
          categoryName: 'Bawahan',
          isActive: false,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=400&h=300&fit=crop&crop=center',
          size: 'L',
          color: 'Khaki',
        },
        {
          id: '7',
          name: 'Topi Bucket',
          price: 150000,
          stock: 12,
          category: '3',
          categoryName: 'Aksesoris',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1556306535-0f09a537f0a3?w=400&h=300&fit=crop&crop=center',
          size: 'One Size',
          color: 'Hitam',
        },
        {
          id: '8',
          name: 'Dompet Kulit',
          price: 280000,
          stock: 8,
          category: '3',
          categoryName: 'Aksesoris',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=300&fit=crop&crop=center',
          size: 'Standard',
          color: 'Coklat',
        },
        {
          id: '9',
          name: 'Sneakers Casual',
          price: 450000,
          stock: 20,
          category: '4',
          categoryName: 'Sepatu',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=300&fit=crop&crop=center',
          size: '42',
          color: 'Putih',
        },
        {
          id: '10',
          name: 'Boots Kulit',
          price: 850000,
          stock: 15,
          category: '4',
          categoryName: 'Sepatu',
          isActive: true,
          createdAt: '2024-01-15',
          image: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400&h=300&fit=crop&crop=center',
          size: '43',
          color: 'Coklat Tua',
        },
      ])
      setLoading(false)
    }
  }, [productsError])

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

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    const matchesStatus = showInactive ? true : product.isActive
    return matchesSearch && matchesCategory && matchesStatus
  })
  
  // Fungsi-fungsi modal sudah dideklarasikan di atas

  // Function to handle successful product addition
  const handleAddSuccess = () => {
    // Refresh product data
    refreshProducts()
    // Close the modal
    setIsAddModalOpen(false)
    // Show success message
    toast.success('Produk berhasil ditambahkan')
  }

  const toggleProductStatus = (id: string) => {
    setProducts(products.map(product => 
      product.id === id 
        ? { ...product, isActive: !product.isActive }
        : product
    ))
    toast.success('Status produk berhasil diubah')
  }

  const deleteProduct = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus produk ini?')) {
      try {
        const response = await fetch(`/api/products?id=${id}`, {
          method: 'DELETE',
        })
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Gagal menghapus produk')
        }
        
        // Refresh products data after successful deletion
        refreshProducts()
        toast.success('Produk berhasil dihapus')
      } catch (error) {
        console.error('Error deleting product:', error)
        toast.error(error instanceof Error ? error.message : 'Gagal menghapus produk')
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount)
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { text: 'Habis', color: 'text-red-600 bg-red-100' }
    if (stock <= 5) return { text: 'Menipis', color: 'text-yellow-600 bg-yellow-100' }
    return { text: 'Tersedia', color: 'text-green-600 bg-green-100' }
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
              <h1 className="text-2xl font-bold text-gray-900">Manajemen Produk</h1>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Tambah Produk
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">{products.length}</div>
            <div className="text-sm text-gray-500">Total Produk</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">
              {products.filter(p => p.isActive).length}
            </div>
            <div className="text-sm text-gray-500">Produk Aktif</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-yellow-600">
              {products.filter(p => p.stock <= 5 && p.stock > 0).length}
            </div>
            <div className="text-sm text-gray-500">Stok Menipis</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-red-600">
              {products.filter(p => p.stock === 0).length}
            </div>
            <div className="text-sm text-gray-500">Stok Habis</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Semua Kategori</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Tampilkan produk nonaktif</span>
              </label>
            </div>

            {/* Stats */}
            <div className="text-right">
              <p className="text-sm text-gray-500">
                Menampilkan {filteredProducts.length} dari {products.length} produk
              </p>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="spinner"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Harga Jual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Harga Pokok
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stok
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
                  {filteredProducts.map((product) => {
                    const stockStatus = getStockStatus(product.stock)
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12">
                              <ProductImage
                                productId={product.id}
                                productName={product.name}
                                image={product.image}
                                width={48}
                                height={48}
                                className="h-12 w-12 rounded-lg object-cover"
                              />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {product.name} {product.productCode && <span className="text-xs text-gray-500 ml-1">({product.productCode})</span>}
                              </div>
                              <div className="text-sm text-gray-500">
                                {product.size} - {product.color}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {product.size && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                    Ukuran: {product.size}
                                  </span>
                                )}
                                {product.color && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800">
                                    Warna: {product.color}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {product.categoryName}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(product.costPrice || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stockStatus.color}`}>
                            {product.stock} - {stockStatus.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleProductStatus(product.id)}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              product.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {product.isActive ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openEditModal(product.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => deleteProduct(product.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              
              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">Tidak ada produk yang ditemukan</p>
                </div>
              )}
            </div>
          )}
        </div>


      </main>

      {/* Edit Product Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedProductId && (
            <EditProductForm 
              productId={selectedProductId} 
              onClose={closeEditModal}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
      
      {/* Add Product Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <AddProductForm 
            onClose={() => setIsAddModalOpen(false)} 
            onSuccess={handleAddSuccess} 
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}