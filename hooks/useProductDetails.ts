import { useState, useEffect } from 'react'

interface ProductDetails {
  id: string
  name: string
  productCode?: string
  price: number
  costPrice?: number
  stock: number
  isActive: boolean
  size: string
  color: string
  image?: string
  description?: string
  createdAt: string
  categoryId: string
  category: {
    id: string
    name: string
  }
}

interface UseProductDetailsReturn {
  productDetails: ProductDetails | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useProductDetails(productId: string): UseProductDetailsReturn {
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProductDetails = async () => {
    if (!productId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/products/${productId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch product details: ${response.statusText}`)
      }
      
      const data = await response.json()
      setProductDetails(data)
    } catch (err) {
      console.error('Error fetching product details:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch product details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProductDetails()
  }, [productId])

  const refetch = () => {
    fetchProductDetails()
  }

  return {
    productDetails,
    loading,
    error,
    refetch
  }
}