"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'

// Simple in-memory cache to avoid repeated fetches across remounts
const imageCache = new Map<string, string | null>()
const inFlight = new Set<string>()

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

  // Fetch image from product details if not provided (run once per id/image change)
  useEffect(() => {
    if (image || !productId) return

    // Use cache if available to prevent repeated fetches (e.g., Strict Mode double-invoke)
    if (imageCache.has(productId)) {
      const cached = imageCache.get(productId)
      if (cached) {
        setCurrentImage(cached)
        setError(false)
      } else {
        setCurrentImage(undefined)
        setError(true)
      }
      return
    }

    // If a fetch for this productId is already in-flight, skip starting another
    if (inFlight.has(productId)) return

    let isMounted = true
    setLoading(true)
    inFlight.add(productId)
    fetch(`/api/v1/products/${productId}`)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to fetch product: ${response.status}`)
        return response.json()
      })
      .then(data => {
        if (!isMounted) return
        if (data && data.image) {
          setCurrentImage(data.image)
          imageCache.set(productId, data.image)
        } else {
          imageCache.set(productId, null)
        }
      })
      .catch(err => {
        if (!isMounted) return
        console.error('Error fetching product image:', err)
        setError(true)
        imageCache.set(productId, null)
      })
      .finally(() => {
        if (!isMounted) return
        inFlight.delete(productId)
        setLoading(false)
      })
    return () => { isMounted = false }
  }, [productId, image])

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