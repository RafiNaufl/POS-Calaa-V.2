"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface ProductImageProps {
  productId: string
  productName: string
  image?: string
  width?: number
  height?: number
  className?: string
  showFallback?: boolean
}

export default function ProductImage({
  productId,
  productName,
  image,
  width = 200,
  height = 200,
  className = "w-full h-full object-cover rounded-lg",
  showFallback = true
}: ProductImageProps) {
  const [currentImage, setCurrentImage] = useState<string | undefined>(image)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Fetch image from product details if not provided
  useEffect(() => {
    if (!image && productId && !loading) {
      setLoading(true)
      fetch(`/api/products/${productId}`)
        .then(response => response.json())
        .then(data => {
          if (data.image) {
            setCurrentImage(data.image)
          }
        })
        .catch(err => {
          console.error('Error fetching product image:', err)
          setError(true)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [productId, image, loading])

  const handleImageError = () => {
    setError(true)
    setCurrentImage(undefined)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg" style={{ width, height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  if (currentImage && !error) {
    return (
      <Image
        src={currentImage}
        alt={productName}
        width={width}
        height={height}
        className={className}
        unoptimized={true}
        onError={handleImageError}
      />
    )
  }

  // Fallback UI
  if (showFallback) {
    return (
      <div 
        className="flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg"
        style={{ width, height }}
      >
        <div className="text-2xl mb-1">📦</div>
        <span className="text-xs text-center px-2">No Image</span>
      </div>
    )
  }

  return null
}