"use client"

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
// Payment methods are limited to CASH and CARD only
import Navbar from '@/components/Navbar'

import ProductImage from '@/components/ProductImage'
// DOKU Payment Modal removed
import useSWR from 'swr'
import {
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  ArrowLeftIcon,
  PrinterIcon,
  CreditCardIcon,
  BanknotesIcon,
  XCircleIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  BuildingLibraryIcon,
  QuestionMarkCircleIcon,
  DocumentDuplicateIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// AutomaticIcon component for promotions
const AutomaticIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
    <path d="M5 5l14 14" />
  </svg>
);

// Add custom CSS animations
// Format currency function
const formatCurrency = (amount: number) => {
  // Handle NaN, null, undefined, or invalid numbers
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
  }).format(amount)
}

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style')
  styleSheet.textContent = `
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    @keyframes slide-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .animate-fade-in {
      animation: fade-in 0.5s ease-out;
    }
    
    .animate-slide-up {
      animation: slide-up 0.6s ease-out;
    }
    
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `
  document.head.appendChild(styleSheet)
}

interface Product {
  id: string
  name: string
  productCode?: string
  price: number
  category: {
    id: string
    name: string
  }
  stock: number
  image?: string
  size?: string
  color?: string
}

interface CartItem extends Product {
  quantity: number
}

interface Category {
  id: string
  name: string
}

interface Transaction {
  id: string
  items: CartItem[]
  total: number
  paymentMethod: string
  customerName?: string
  createdAt: Date
  pointsUsed?: number
  pointsEarned?: number
  voucherCode?: string | null
  voucherDiscount?: number
  promotionDiscount?: number
  appliedPromotions?: AppliedPromotion[]
}

interface Member {
  id: string
  name: string
  phone?: string
  email?: string
  points: number
  totalSpent: number
}

interface Voucher {
  id: string
  code: string
  name: string
  type: string
  value: number
  minPurchase?: number
  maxUsage?: number
  usageCount: number
  startDate: string
  endDate: string
  isActive: boolean
}

interface Promotion {
  id: string
  name: string
  type: string
  discount: number
  conditions?: any
}

interface AppliedPromotion {
  promotion: Promotion
  discount: number
  appliedItems: string[]
}

export default function CashierPage() {
  const { data: session } = useSession()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [member, setMember] = useState<Member | null>(null)
  const [pointsToUse, setPointsToUse] = useState(0)
  const [isSearchingMember, setIsSearchingMember] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'QRIS' | 'BANK_TRANSFER' | 'MIDTRANS'>('CASH')
  // Payment methods are limited to CASH and CARD only
  const [cashAmount, setCashAmount] = useState<number>(0)
  const [changeAmount, setChangeAmount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [completedTransaction, setCompletedTransaction] = useState<any>(null)
  const [showBankTransferModal, setShowBankTransferModal] = useState(false)
const [bankTransferTransaction, setBankTransferTransaction] = useState<any>(null)
const [showQrisModal, setShowQrisModal] = useState(false)
const [qrisTransaction, setQrisTransaction] = useState<any>(null)
const [showCardModal, setShowCardModal] = useState(false)
const [cardTransaction, setCardTransaction] = useState<any>(null)
  // DOKU Modal state removed
  // Pending transaction state removed
  const [voucherCode, setVoucherCode] = useState('')
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null)
  const [voucherDiscount, setVoucherDiscount] = useState(0)
  const [appliedPromotions, setAppliedPromotions] = useState<AppliedPromotion[]>([])
  const [promotionDiscount, setPromotionDiscount] = useState(0)
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false)
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([])
  const [availablePromotions, setAvailablePromotions] = useState<Promotion[]>([])
  const [showVoucherList, setShowVoucherList] = useState(false)
  const [showPromotionList, setShowPromotionList] = useState(false)
  const [showCashPaymentModal, setShowCashPaymentModal] = useState(false)


  // Fetch data using SWR
  const fetcher = (url: string) => fetch(url).then(res => {
    if (!res.ok) throw new Error('Failed to fetch data')
    return res.json()
  })
  
  const { data: productsData, error: productsError, isLoading: productsLoading } = useSWR('/api/products', fetcher, {
    refreshInterval: 5000 // refresh every 5 seconds
  })
  
  const { data: categoriesData, error: categoriesError } = useSWR('/api/categories', fetcher)
  
  const { data: vouchersData, error: vouchersError } = useSWR('/api/vouchers?active=true', fetcher)
  
  const { data: promotionsData, error: promotionsError } = useSWR('/api/promotions?active=true', fetcher)

  // Handle payment callback from Midtrans redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paymentStatus = urlParams.get('payment')
    const transactionId = urlParams.get('transaction_id')
    
    if (paymentStatus && transactionId) {
      console.log('Payment callback detected:', paymentStatus, 'transaction ID:', transactionId)
      
      // Clear URL parameters first
      window.history.replaceState({}, document.title, window.location.pathname)
      
      if (paymentStatus === 'success') {
        // Payment successful - webhook should have already updated the status
        // Just show success message and refresh data
        toast.success('Pembayaran berhasil! Transaksi telah dicatat.')
        
        // Clear cart and reset form
        setCart([])
        setCustomerName('')
        setCustomerPhone('')
        setCustomerEmail('')
        setMember(null)
        setPointsToUse(0)
        setAppliedVoucher(null)
        setVoucherCode('')
        
        // Refresh transactions data if available
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else if (paymentStatus === 'error' || paymentStatus === 'failed' || paymentStatus === 'cancelled') {
        toast.error('Pembayaran gagal atau dibatalkan. Silakan coba lagi.')
      } else if (paymentStatus === 'pending') {
        toast.loading('Pembayaran sedang diproses. Mohon tunggu konfirmasi.', {
          duration: 5000
        })
      }
    }
  }, [])

  // Process products data from SWR
  useEffect(() => {
    if (productsData && productsData.products && Array.isArray(productsData.products)) {
      setProducts(productsData.products)
      setLoading(false)
    } else if (productsData && !productsData.products) {
      console.error('Products data does not contain products array:', productsData)
      setError('Format data produk tidak valid')
      setLoading(false)
    }
  }, [productsData])

  // Process categories data from SWR
  useEffect(() => {
    if (categoriesData && Array.isArray(categoriesData)) {
      setCategories(categoriesData)
    } else if (categoriesData) {
      console.error('Categories data is not an array:', categoriesData)
      toast.error('Format data kategori tidak valid')
    }
  }, [categoriesData])

  // Process vouchers data from SWR
  useEffect(() => {
    if (vouchersData && Array.isArray(vouchersData)) {
      const activeVouchers = vouchersData.filter((voucher: Voucher) => {
        const now = new Date()
        const startDate = new Date(voucher.startDate)
        const endDate = new Date(voucher.endDate)
        return voucher.isActive && now >= startDate && now <= endDate
      })
      setAvailableVouchers(activeVouchers)
    } else if (vouchersData && !Array.isArray(vouchersData)) {
      console.error('Vouchers data is not an array:', vouchersData)
    }
  }, [vouchersData])

  // Process promotions data from SWR
  useEffect(() => {
    if (promotionsData && Array.isArray(promotionsData)) {
      const activePromotions = promotionsData.filter((promotion: any) => {
        const now = new Date()
        const startDate = new Date(promotion.startDate)
        const endDate = new Date(promotion.endDate)
        return promotion.isActive && now >= startDate && now <= endDate
      })
      setAvailablePromotions(activePromotions)
    } else if (promotionsData && !Array.isArray(promotionsData)) {
      console.error('Promotions data is not an array:', promotionsData)
    }
  }, [promotionsData])
  
  // Handle errors
  useEffect(() => {
    if (productsError) {
      console.error('Error fetching products:', productsError)
      setError('Gagal memuat data produk')
      setLoading(false)
    }
  }, [productsError])
  
  useEffect(() => {
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError)
      toast.error('Gagal memuat kategori')
    }
  }, [categoriesError])
  
  useEffect(() => {
    if (vouchersError) {
      console.error('Error fetching vouchers:', vouchersError)
    }
  }, [vouchersError])
  
  useEffect(() => {
    if (promotionsError) {
      console.error('Error fetching promotions:', promotionsError)
    }
  }, [promotionsError])

  // Filter products
  const filteredProducts = Array.isArray(products) ? products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category.id === selectedCategory
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (product.productCode && product.productCode.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesCategory && matchesSearch
  }) : []

  // Cart functions
  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id)
    
    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        alert('Stok tidak mencukupi')
        return
      }
      setCart(cart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      if (product.stock === 0) {
        alert('Produk habis')
        return
      }
      setCart([...cart, {
        ...product,
        quantity: 1
      }])
    }
  }

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeFromCart(id)
      return
    }
    
    const product = products.find(p => p.id === id)
    if (product && newQuantity > product.stock) {
      toast.error('Stok tidak mencukupi')
      return
    }

    setCart(cart.map(item => 
      item.id === id 
        ? { ...item, quantity: newQuantity }
        : item
    ))
  }

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id))
    toast.success('Item dihapus dari keranjang')
  }

  const clearCart = () => {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setCustomerEmail('')
    setMember(null)
    setPointsToUse(0)
    setVoucherCode('')
    setAppliedVoucher(null)
    setVoucherDiscount(0)
    setAppliedPromotions([])
    setPromotionDiscount(0)
    toast.success('Keranjang dikosongkan')
  }

  // Member functions
  const searchMember = async () => {
    if (!customerPhone && !customerEmail) {
      toast.error('Masukkan nomor HP atau email untuk mencari member')
      return
    }

    setIsSearchingMember(true)
    try {
      const params = new URLSearchParams()
      if (customerPhone) params.append('phone', customerPhone)
      if (customerEmail) params.append('email', customerEmail)

      const response = await fetch(`/api/members/search?${params}`)
      
      if (response.ok) {
        const memberData = await response.json()
        setMember(memberData)
        setCustomerName(memberData.name)
        toast.success(`Member ditemukan: ${memberData.name} (${memberData.points} poin)`)
      } else {
        setMember(null)
        toast.error('Member tidak ditemukan')
      }
    } catch (error) {
      console.error('Error searching member:', error)
      toast.error('Gagal mencari member')
    } finally {
      setIsSearchingMember(false)
    }
  }

  const createNewMember = async () => {
    if (!customerName) {
      toast.error('Nama pelanggan harus diisi')
      return
    }

    try {
      const response = await fetch('/api/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: customerName,
          phone: customerPhone || null,
          email: customerEmail || null
        })
      })

      if (response.ok) {
        const newMember = await response.json()
        setMember(newMember)
        toast.success(`Member baru berhasil dibuat: ${newMember.name}`)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Gagal membuat member baru')
      }
    } catch (error) {
      console.error('Error creating member:', error)
      toast.error('Gagal membuat member baru')
    }
  }

  const validateVoucher = async () => {
    if (!voucherCode.trim()) {
      toast.error('Masukkan kode voucher')
      return
    }

    setIsValidatingVoucher(true)
    try {
      const { subtotal } = calculateTotal()
      
      // Prepare cart items for voucher validation
      const cartItems = cart.map(item => ({
        productId: item.id,
        categoryId: item.category.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name
      }))
      
      const response = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: voucherCode,
          subtotal,
          cartItems,
          userId: session?.user?.id
        })
      })

      if (response.ok) {
        const data = await response.json()
        setAppliedVoucher(data.voucher)
        setVoucherDiscount(data.discountAmount)
        toast.success(`Voucher berhasil diterapkan: ${data.voucher.name}`)
      } else {
        const error = await response.json()
        if (error.minPurchase) {
          toast.error(`Minimum pembelian Rp ${new Intl.NumberFormat('id-ID').format(error.minPurchase)}`)
        } else {
          toast.error(error.error || 'Voucher tidak valid')
        }
      }
    } catch (error) {
      console.error('Error validating voucher:', error)
      toast.error('Gagal memvalidasi voucher')
    } finally {
      setIsValidatingVoucher(false)
    }
  }

  const removeVoucher = () => {
    setAppliedVoucher(null)
    setVoucherDiscount(0)
    setVoucherCode('')
    toast.success('Voucher dihapus')
  }

  const removePromotions = () => {
    setAppliedPromotions([])
    setPromotionDiscount(0)
    toast.success('Diskon promosi dibatalkan')
  }

  const calculatePromotions = useCallback(async () => {
    if (cart.length === 0) return

    try {
      const cartItems = cart.map(item => ({
        productId: item.id,
        categoryId: item.category.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name,
        image: item.image
      }))

      const response = await fetch('/api/promotions/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: cartItems })
      })

      if (response.ok) {
        const data = await response.json()
        setAppliedPromotions(data.appliedPromotions || [])
        setPromotionDiscount(data.totalDiscount || 0)
        
        // Log applied promotions for debugging
        if (data.appliedPromotions && data.appliedPromotions.length > 0) {
          console.log('Applied promotions:', data.appliedPromotions)
        }
      }
    } catch (error) {
      console.error('Error calculating promotions:', error)
    }
  }, [cart])

  // Recalculate promotions when cart changes
  useEffect(() => {
    calculatePromotions()
  }, [calculatePromotions])

  const calculateTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const pointsDiscount = pointsToUse * 1000 // 1 poin = 1000 rupiah
    const totalBeforeDiscounts = subtotal - pointsDiscount
    const totalVoucherDiscount = voucherDiscount
    const totalPromotionDiscount = promotionDiscount
    const total = Math.max(0, totalBeforeDiscounts - totalVoucherDiscount - totalPromotionDiscount)
    const pointsEarned = member ? Math.floor(total / 10000) : 0
    return { 
      subtotal, 
      total, 
      pointsDiscount, 
      pointsEarned, 
      voucherDiscount: totalVoucherDiscount,
      promotionDiscount: totalPromotionDiscount
    }
  }

  // Function to print bank transfer instructions
  const printBankTransferInstructions = () => {
    if (!bankTransferTransaction) return;
    
    const instructionsContent = document.createElement('div');
    instructionsContent.innerHTML = `
      <div style="font-family: 'Arial', sans-serif; width: 400px; padding: 20px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0;">WEAR CALAA</h2>
          <p style="margin: 5px 0;">Jl. Contoh No. 123, Jakarta</p>
          <p style="margin: 5px 0;">Telp: (021) 123-4567</p>
          <h3 style="margin: 15px 0 5px;">Instruksi Transfer Bank</h3>
        </div>
        
        <div style="border: 1px solid #000; padding: 10px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px;">Detail Transaksi</h4>
          <p style="margin: 5px 0;">ID Transaksi: ${bankTransferTransaction.id}</p>
          <p style="margin: 5px 0;">Tanggal: ${new Date(bankTransferTransaction.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p style="margin: 5px 0;">Total Pembayaran: ${formatCurrency(bankTransferTransaction.total)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px;">Rekening Tujuan</h4>
          <div style="border: 1px solid #000; padding: 10px; margin-bottom: 10px;">
            <p style="margin: 2px 0; font-weight: bold;">Bank BCA</p>
            <p style="margin: 2px 0;">Nama: WEAR CALAA</p>
            <p style="margin: 2px 0;">No. Rekening: 1234567890</p>
          </div>
          <div style="border: 1px solid #000; padding: 10px;">
            <p style="margin: 2px 0; font-weight: bold;">Bank Mandiri</p>
            <p style="margin: 2px 0;">Nama: WEAR CALAA</p>
            <p style="margin: 2px 0;">No. Rekening: 0987654321</p>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px;">Langkah-langkah Pembayaran</h4>
          <ol style="margin: 0; padding-left: 20px;">
            <li style="margin-bottom: 5px;">Transfer tepat sejumlah ${formatCurrency(bankTransferTransaction.total)} ke salah satu rekening di atas</li>
            <li style="margin-bottom: 5px;">Simpan bukti transfer</li>
            <li style="margin-bottom: 5px;">Tunjukkan bukti transfer kepada kasir atau admin untuk konfirmasi pembayaran</li>
            <li style="margin-bottom: 5px;">Pembayaran akan diverifikasi dan status transaksi akan diperbarui</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin-top: 30px; border-top: 1px dashed #000; padding-top: 10px;">
          <p style="margin: 5px 0;">Terima kasih atas kunjungan Anda!</p>
          <p style="margin: 5px 0;">Silakan datang kembali</p>
        </div>
      </div>
    `;
    
    const printWindow = window.open('', '', 'height=600,width=400');
    printWindow?.document.write('<html><head><title>Instruksi Transfer Bank</title>');
    printWindow?.document.write('</head><body>');
    printWindow?.document.write(instructionsContent.innerHTML);
    printWindow?.document.write('</body></html>');
    printWindow?.document.close();
    printWindow?.print();
  };

  const processPayment = async () => {
    if (cart.length === 0) {
      toast.error('Keranjang kosong')
      return
    }

    // Validasi sudah dilakukan di modal untuk pembayaran tunai

    setIsProcessing(true)
    
    try {
      // Re-cek stok terbaru untuk setiap item agar tidak oversell
      const latestProducts = await Promise.all(
        cart.map(async (item) => {
          const res = await fetch(`/api/products/${item.id}`)
          if (!res.ok) {
            throw new Error('Gagal mengambil data produk terbaru')
          }
          return res.json()
        })
      )

      for (const latest of latestProducts) {
        const cartItem = cart.find(ci => ci.id === latest.id)
        if (!cartItem) continue
        if (latest.stock === 0) {
          toast.error(`Stok habis untuk ${latest.name}`)
          return
        }
        if (cartItem.quantity > latest.stock) {
          toast.error(`Stok tidak mencukupi untuk ${latest.name}. Tersisa ${latest.stock}.`)
          return
        }
      }

      const totals = calculateTotal()
      const transactionData = {
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.price * item.quantity,
          name: item.name
        })),
        subtotal: totals.subtotal,
        total: totals.total,
        paymentMethod,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        pointsUsed: pointsToUse,
        voucherCode: appliedVoucher?.code || null,
        voucherDiscount: totals.voucherDiscount,
        promoDiscount: totals.promotionDiscount,
        promotionDiscount: totals.promotionDiscount, // Mengirim kedua field untuk kompatibilitas
        memberId: member?.id || null,
        // Add cash payment data
        cashAmount: paymentMethod === 'CASH' ? cashAmount : null,
        changeAmount: paymentMethod === 'CASH' ? changeAmount : null,
        // Require manual confirmation for CARD to show modal and defer stock
        requiresConfirmation: paymentMethod === 'CARD' ? true : false
      }
      
      // Handle Midtrans payment
      if (paymentMethod === 'MIDTRANS') {
        try {
          const orderId = `TXN-${Date.now()}`;
          
          // First, create transaction in database with PENDING status
          const transactionResponse = await fetch('/api/transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...transactionData,
              id: orderId,
              paymentStatus: 'PENDING',
              status: 'PENDING'
            })
          });

          if (!transactionResponse.ok) {
            throw new Error('Failed to create transaction record');
          }

          const transactionResult = await transactionResponse.json();
          
          // Create Midtrans payment token
          const midtransResponse = await fetch('/api/payments/midtrans/create-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId: orderId,
              amount: totals.total,
              customerDetails: {
                first_name: customerName || member?.name || 'Customer',
                email: customerEmail || member?.email || undefined,
                phone: customerPhone || member?.phone || undefined
              },
              itemDetails: cart.map(item => ({
                id: item.id,
                price: item.price,
                quantity: item.quantity,
                name: item.name
              }))
            })
          });

          if (!midtransResponse.ok) {
            throw new Error('Failed to create Midtrans payment token');
          }

          const midtransData = await midtransResponse.json();
          
          // Redirect to Midtrans payment page
          if (midtransData.redirect_url) {
            window.location.href = midtransData.redirect_url;
            toast.success('Redirecting to Midtrans payment page...');
            return;
          }
        } catch (error) {
          console.error('Midtrans payment error:', error);
          toast.error('Failed to process Midtrans payment');
          return;
        }
      }
      
      // Proses pembayaran normal untuk metode lain
      const pendingForConfirmation = (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'QRIS' || paymentMethod === 'CARD')
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pendingForConfirmation ? { ...transactionData, status: 'PENDING', paymentStatus: 'PENDING' } : transactionData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Transaction error:', errorData)
        throw new Error(errorData.message || 'Failed to process transaction')
      }
    
      const transaction = await response.json()
    
      // Set transaction data for modal
      const transactionWithItems = {
        id: transaction.id,
        items: cart,
        total: totals.total,
        paymentMethod,
        customerName: customerName || undefined,
        createdAt: new Date(),
        pointsUsed: pointsToUse,
        pointsEarned: totals.pointsEarned,
        voucherCode: appliedVoucher?.code || null,
        voucherDiscount: totals.voucherDiscount,
        promotionDiscount: totals.promotionDiscount,
        appliedPromotions: appliedPromotions
      }
      
      // Show appropriate modal based on payment method
      if (paymentMethod === 'BANK_TRANSFER') {
        setBankTransferTransaction(transactionWithItems)
        setShowBankTransferModal(true)
      } else if (paymentMethod === 'QRIS') {
        setQrisTransaction(transactionWithItems)
        setShowQrisModal(true)
      } else if (paymentMethod === 'CARD') {
        setCardTransaction(transactionWithItems)
        setShowCardModal(true)
      } else {
        setCompletedTransaction(transactionWithItems)
        setShowTransactionModal(true)
      }
      
      // Clear cart
      clearCart()
      // SWR will automatically revalidate data
      
      toast.success('Pembayaran berhasil!')

    } catch (error) {
      console.error('Payment failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Tampilkan pesan error yang lebih spesifik
      if (errorMessage.includes('Sesi pengguna tidak valid') || errorMessage.includes('User not found in database')) {
        toast.error('Sesi pengguna tidak valid. Silakan login ulang.')
        // Redirect ke halaman login setelah beberapa detik
        setTimeout(() => {
          window.location.href = '/login'
        }, 3000)
      } else {
        toast.error('Pembayaran gagal! ' + errorMessage)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  // Payment handler code

  // DOKU payment handlers removed

  const printReceipt = () => {
    const { subtotal, total, voucherDiscount, promotionDiscount } = calculateTotal()
    const pointsUsed = completedTransaction?.pointsUsed ?? 0
    const pointsEarned = completedTransaction?.pointsEarned ?? 0
    const pointDiscount = pointsUsed * 1000
    
    const receiptContent = `
      ===== Wear Calaa =====
      Tanggal: ${new Date().toLocaleDateString('id-ID')}
      Waktu: ${new Date().toLocaleTimeString('id-ID')}
      Kasir: ${session?.user?.name || 'Admin'}
      ${customerName ? `Pelanggan: ${customerName}` : ''}
      ${member ? `Member: ${member.name} (${member.phone})` : ''}
      
      ===== DETAIL PESANAN =====
      ${cart.map(item => 
        `${item.name}${item.productCode ? ` (Kode: ${item.productCode})` : ''}${item.size ? `
Ukuran: ${item.size}` : ''}${item.color ? `
Warna: ${item.color}` : ''}
${item.quantity} x ${formatCurrency(item.price)} = ${formatCurrency(item.price * item.quantity)}`
      ).join('\n\n')}
      
      ===== TOTAL =====
      Subtotal: ${formatCurrency(subtotal)}
      ${pointsUsed > 0 ? `Diskon Poin (${pointsUsed} poin): -${formatCurrency(pointDiscount)}` : ''}
      ${voucherDiscount > 0 ? `Diskon Voucher (${appliedVoucher?.code}): -${formatCurrency(voucherDiscount)}` : ''}
      ${promotionDiscount > 0 ? `Diskon Promosi: -${formatCurrency(promotionDiscount)}` : ''}
      ${appliedPromotions.length > 0 ? `\n===== PROMOSI DITERAPKAN =====\n${appliedPromotions.map(p => `- ${p.promotion?.name || 'Promosi'}: ${formatCurrency(p.discount)}`).join('\n')}` : ''}
      Total: ${formatCurrency(total)}
      
      Metode Pembayaran: ${paymentMethod}
      
      ${member && pointsEarned > 0 ? `===== POIN MEMBER =====\nPoin yang didapat: +${pointsEarned} poin\nTotal poin sekarang: ${(member.points || 0) + pointsEarned} poin\n` : ''}
      
      Terima kasih atas kunjungan Anda!
    `
    
    console.log(receiptContent)
    toast.success('Struk dicetak')
  }



  const formatCurrency = (amount: number) => {
    // Handle NaN, null, undefined, or invalid numbers
    if (isNaN(amount) || amount === null || amount === undefined) {
      amount = 0
    }
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount)
  }

  const { subtotal, total } = calculateTotal()

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Modern Header */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Kasir {session.user.name}</h1>
                <p className="text-gray-600">Kelola transaksi penjualan</p>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{cart.reduce((sum, item) => sum + item.quantity, 0)}</div>
                  <div className="text-sm text-gray-500">Item</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(calculateTotal().total)}</div>
                  <div className="text-sm text-gray-500">Total</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Products Section */}
          <div className="xl:col-span-2 space-y-6">
            {/* Search and Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 pl-11 pr-11 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <XCircleIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
                
                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Semua
                  </button>
                  {categories.map(category => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-6 text-sm text-gray-600 pt-2 border-t border-gray-100">
                  <span>Total: <span className="font-medium text-blue-600">{products.length}</span></span>
                  <span>Ditemukan: <span className="font-medium text-green-600">{filteredProducts.length}</span></span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={() => setShowVoucherList(!showVoucherList)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showVoucherList 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                >
                  <span>🎫</span>
                  <span>Voucher ({availableVouchers.length})</span>
                  {showVoucherList ? (
                    <ChevronUpIcon className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 ml-1" />
                  )}
                </button>
                <button
                  onClick={() => setShowPromotionList(!showPromotionList)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showPromotionList 
                      ? 'bg-green-600 text-white' 
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <span>🏷️</span>
                  <span>Promosi ({availablePromotions.length})</span>
                  {showPromotionList ? (
                    <ChevronUpIcon className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 ml-1" />
                  )}
                </button>
              </div>

              {/* Voucher List */}
              {showVoucherList && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Voucher Tersedia</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">
                        {availableVouchers.length} voucher
                      </span>
                      {appliedVoucher && (
                        <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                          1 aktif
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {appliedVoucher && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full">✓</span>
                            <h4 className="font-medium text-green-800 text-base">Voucher Aktif</h4>
                          </div>
                          <div className="ml-8 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-700">{appliedVoucher.name}</span>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                {appliedVoucher.code}
                              </span>
                            </div>
                            <p className="text-sm text-green-700">
                              <span className="font-medium">Tipe:</span> {
                                appliedVoucher.type === 'PERCENTAGE' ? 'Persentase' : 
                                appliedVoucher.type === 'FIXED_AMOUNT' ? 'Nominal Tetap' : 
                                'Gratis Ongkir'
                              }
                            </p>
                            <p className="text-sm text-green-700">
                              <span className="font-medium">Nilai:</span> {
                                appliedVoucher.type === 'PERCENTAGE' ? `${appliedVoucher.value}%` : 
                                appliedVoucher.type === 'FIXED_AMOUNT' ? formatCurrency(appliedVoucher.value) : 
                                'Gratis Ongkir'
                              }
                            </p>
                            <p className="text-sm text-green-700 font-medium">
                              Total diskon: {formatCurrency(voucherDiscount)}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={removeVoucher}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors shadow-sm"
                          title="Hapus voucher"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">Hapus</span>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {availableVouchers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <div className="text-4xl mb-2">🎫</div>
                      <p className="font-medium text-gray-600">Tidak ada voucher tersedia</p>
                      <p className="text-sm text-gray-500 mt-1">Voucher akan muncul di sini saat tersedia</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availableVouchers.map((voucher) => (
                          <div 
                            key={voucher.id} 
                            className={`border rounded-lg p-4 transition-all ${appliedVoucher?.code === voucher.code 
                              ? 'border-green-300 bg-green-50 shadow-md' 
                              : 'border-gray-200 hover:border-purple-300 hover:shadow-sm bg-white'}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-medium text-gray-900">{voucher.name}</h4>
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                                {voucher.code}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${voucher.type === 'PERCENTAGE' 
                                ? 'bg-blue-100 text-blue-700' 
                                : voucher.type === 'FIXED_AMOUNT' 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-purple-100 text-purple-700'}`}>
                                {voucher.type === 'PERCENTAGE' ? '%' : voucher.type === 'FIXED_AMOUNT' ? '¥' : '🚚'}
                              </span>
                              <p className="text-sm font-medium ${voucher.type === 'PERCENTAGE' 
                                ? 'text-blue-600' 
                                : voucher.type === 'FIXED_AMOUNT' 
                                ? 'text-green-600' 
                                : 'text-purple-600'}">
                                {voucher.type === 'PERCENTAGE' 
                                  ? `Diskon ${voucher.value}%${(voucher as any).maxDiscount ? ` (maks. ${formatCurrency((voucher as any).maxDiscount)})` : ''}` 
                                  : voucher.type === 'FIXED_AMOUNT' 
                                  ? `Diskon ${formatCurrency(voucher.value)}` 
                                  : 'Gratis Ongkir'}
                              </p>
                            </div>
                            {voucher.minPurchase && (
                              <div className="flex items-center gap-1 mb-2">
                                <InformationCircleIcon className="h-4 w-4 text-gray-400" />
                                <p className="text-xs text-gray-500">
                                  Min. pembelian: {formatCurrency(voucher.minPurchase)}
                                </p>
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setVoucherCode(voucher.code)
                                validateVoucher()
                              }}
                              disabled={appliedVoucher !== null}
                              className={`w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors mt-2 flex items-center justify-center gap-2 ${appliedVoucher?.code === voucher.code
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : appliedVoucher !== null
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700 shadow-sm hover:shadow transform hover:scale-105'}`}
                            >
                              {appliedVoucher?.code === voucher.code ? (
                                <>
                                  <CheckCircleIcon className="h-4 w-4" />
                                  <span>Diterapkan</span>
                                </>
                              ) : (
                                <>
                                  {!appliedVoucher && <span>🎫</span>}
                                  <span>{appliedVoucher ? 'Tidak tersedia' : 'Gunakan'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Promotion List */}
              {showPromotionList && (
                <div className="pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">Promosi Tersedia</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                        {availablePromotions.length} promosi
                      </span>
                      {appliedPromotions.length > 0 && (
                        <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                          {appliedPromotions.length} aktif
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {appliedPromotions.length > 0 && (
                    <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 bg-green-100 text-green-700 rounded-full">✓</span>
                          <h4 className="font-medium text-green-800 text-base">Promosi Aktif</h4>
                        </div>
                        <button 
                          onClick={removePromotions}
                          className="flex items-center gap-1 px-3 py-1.5 bg-white text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors shadow-sm"
                          title="Batalkan semua diskon promosi"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          <span className="text-xs font-medium">Batalkan</span>
                        </button>
                      </div>
                      <div className="ml-8 space-y-3">
                        {appliedPromotions.map((applied, index) => (
                          <div key={index} className="flex justify-between items-start bg-white p-2 rounded-lg border border-green-100">
                            <div>
                              <p className="text-sm font-medium text-gray-800">{applied.promotion.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  {applied.promotion.type === 'PRODUCT_DISCOUNT' && 'Diskon Produk'}
                                  {applied.promotion.type === 'CATEGORY_DISCOUNT' && 'Diskon Kategori'}
                                  {applied.promotion.type === 'BULK_DISCOUNT' && 'Diskon Grosir'}
                                  {applied.promotion.type === 'BUY_X_GET_Y' && 'Beli X Dapat Y'}
                                </span>
                                <p className="text-xs text-green-600 font-medium">Diskon: {formatCurrency(applied.discount)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="pt-3 border-t border-green-200 mt-2">
                          <p className="text-sm text-green-700 font-medium flex items-center justify-between">
                            <span>Total diskon promosi:</span>
                            <span className="text-base">{formatCurrency(promotionDiscount)}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {availablePromotions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      <div className="text-4xl mb-2">🏷️</div>
                      <p className="font-medium text-gray-600">Tidak ada promosi tersedia</p>
                      <p className="text-sm text-gray-500 mt-1">Promosi akan muncul di sini saat tersedia</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availablePromotions.map((promotion) => {
                          // Check if this promotion is applied
                          const isApplied = appliedPromotions.some(ap => ap.promotion.id === promotion.id);
                          
                          return (
                            <div 
                              key={promotion.id} 
                              className={`border rounded-lg p-4 transition-all ${isApplied 
                                ? 'border-green-300 bg-green-50 shadow-md' 
                                : 'border-gray-200 hover:border-green-300 hover:shadow-sm bg-white'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium text-gray-900">{promotion.name}</h4>
                                {isApplied && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                    Aktif
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-3">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${
                                  promotion.type === 'PRODUCT_DISCOUNT' ? 'bg-blue-100 text-blue-700' :
                                  promotion.type === 'CATEGORY_DISCOUNT' ? 'bg-purple-100 text-purple-700' :
                                  promotion.type === 'BULK_DISCOUNT' ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'}`}>
                                  {promotion.type === 'PRODUCT_DISCOUNT' ? 'P' :
                                   promotion.type === 'CATEGORY_DISCOUNT' ? 'C' :
                                   promotion.type === 'BULK_DISCOUNT' ? 'B' : 'XY'}
                                </span>
                                <p className="text-sm font-medium">
                                  {promotion.type === 'PRODUCT_DISCOUNT' && 'Diskon Produk'}
                                  {promotion.type === 'CATEGORY_DISCOUNT' && 'Diskon Kategori'}
                                  {promotion.type === 'BULK_DISCOUNT' && 'Diskon Grosir'}
                                  {promotion.type === 'BUY_X_GET_Y' && 'Beli X Dapat Y'}
                                </p>
                              </div>
                              <div className={`rounded-lg p-2.5 ${isApplied ? 'bg-green-100' : 'bg-gray-50'}`}>
                                <p className="text-xs text-gray-700 font-medium flex items-center gap-1.5">
                                  <AutomaticIcon className="h-4 w-4 text-green-600" />
                                  Otomatis diterapkan saat syarat terpenuhi
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500 italic">Promosi akan otomatis diterapkan saat syarat terpenuhi</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Products Grid */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Daftar Produk
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {filteredProducts.length} dari {products.length} produk tersedia
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="bg-blue-50 px-3 py-1 rounded-full">
                    <span className="text-blue-600 text-sm font-medium">
                      {filteredProducts.length} item
                    </span>
                  </div>
                </div>
              </div>
              
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                  {[...Array(12)].map((_, i) => (
                    <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
                      <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                      <div className="h-8 bg-gray-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-16 bg-red-50 rounded-xl border-2 border-dashed border-red-200">
                  <div className="text-red-500 text-5xl mb-4">⚠️</div>
                  <h3 className="text-red-700 text-lg font-semibold mb-2">Terjadi Kesalahan</h3>
                  <p className="text-red-600 mb-6">{error}</p>
                  <button
                    onClick={() => {
                      setError('')
                      // SWR will automatically revalidate
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    🔄 Muat Ulang
                  </button>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <div className="text-gray-400 text-5xl mb-4">🔍</div>
                  <h3 className="text-gray-600 text-lg font-semibold mb-2">Produk Tidak Ditemukan</h3>
                  <p className="text-gray-500 text-sm max-w-md mx-auto">Tidak ada produk yang sesuai dengan pencarian atau filter yang dipilih. Coba ubah kata kunci atau kategori.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:-translate-y-1"
                      onClick={() => addToCart(product)}
                    >
                      {/* Product Image */}
                      <div className="aspect-square bg-gray-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                        <ProductImage
                          productId={product.id}
                          productName={product.name}
                          image={product.image}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                        />
                        
                        {/* Stock Status Badge */}
                        {product.stock <= 5 && (
                          <div className="absolute top-2 right-2">
                            <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                              product.stock === 0 ? 'bg-red-500' : 'bg-yellow-500'
                            }`}></div>
                          </div>
                        )}
                        
                        {/* Quick Add Overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 rounded-lg transition-all duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div className="bg-white rounded-full p-2 shadow-lg">
                              <span className="text-blue-600 text-sm font-medium">+</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Product Info */}
                      <div className="space-y-2">
                        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight group-hover:text-blue-600 transition-colors">
                          {product.name}
                        </h3>
                        
                        {product.productCode && (
                          <p className="text-gray-500 text-xs">
                            Kode: {product.productCode}
                          </p>
                        )}
                        
                        {product.size && (
                          <p className="text-gray-500 text-xs">
                            Ukuran: {product.size}
                          </p>
                        )}
                        
                        {product.color && (
                          <p className="text-gray-500 text-xs">
                            Warna: {product.color}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <p className="text-blue-600 font-bold text-sm">{formatCurrency(product.price)}</p>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-medium">
                            {product.category.name}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            product.stock === 0 
                              ? 'bg-red-100 text-red-600' 
                              : product.stock <= 5 
                              ? 'bg-yellow-100 text-yellow-600' 
                              : 'bg-green-100 text-green-600'
                          }`}>
                            {product.stock === 0 ? 'Habis' : `${product.stock} stok`}
                          </span>
                        </div>
                      </div>
                      
                      {/* Add to Cart Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          addToCart(product)
                        }}
                        className={`w-full mt-3 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                          product.stock === 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transform hover:scale-105'
                        }`}
                        disabled={product.stock === 0}
                      >
                        {product.stock === 0 ? '❌ Stok Habis' : 'Tambah ke Keranjang'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart Section */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <ShoppingCartIcon className="h-5 w-5 mr-2 text-blue-600" />
                  Keranjang
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-600 rounded text-sm font-medium">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </h2>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-red-600 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  >
                    Kosongkan
                  </button>
                )}
              </div>

              {/* Customer Details */}
              <div className="mb-4">
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Informasi Pelanggan</h4>
                  
                  <input
                    type="text"
                    placeholder="Nama pelanggan"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 mb-3 bg-gray-50"
                    disabled={member !== null}
                  />
                  
                  <div className="flex space-x-2 mb-3">
                    <input
                      type="tel"
                      placeholder="No. Handphone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-gray-50"
                      disabled={member !== null}
                    />
                    <button
                      onClick={searchMember}
                      disabled={isSearchingMember || (!customerPhone && !customerEmail)}
                      className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white text-sm rounded-lg transition-colors font-medium"
                    >
                      {isSearchingMember ? 'Cari...' : 'Cari'}
                    </button>
                  </div>
                  
                  <input
                    type="email"
                    placeholder="Email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 mb-3 bg-gray-50"
                    disabled={member !== null}
                  />
                  
                  {member ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-green-800">Member: {member.name}</span>
                        <button
                          onClick={() => {
                            setMember(null)
                            setPointsToUse(0)
                            setCustomerName('')
                            setCustomerPhone('')
                            setCustomerEmail('')
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Reset
                        </button>
                      </div>
                      <p className="text-sm text-green-700">Email: {member.email || 'Tidak ada email'}</p>
                      <p className="text-sm text-green-700">Poin tersedia: {member.points}</p>
                      <p className="text-sm text-green-700">Total belanja: {formatCurrency(member.totalSpent)}</p>
                      
                      {member.points > 0 && (
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-green-700 mb-1">
                            Gunakan Poin (1 poin = Rp 1.000)
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="number"
                              min="0"
                              max={Math.min(member.points, Math.floor(calculateTotal().total / 1000))}
                              value={pointsToUse}
                              onChange={(e) => setPointsToUse(parseInt(e.target.value) || 0)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                              onClick={() => setPointsToUse(Math.min(member.points, Math.floor(calculateTotal().total / 1000)))}
                              className="px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm rounded-lg transition-colors"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Applied Promotions */}
                      {appliedPromotions.length > 0 && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <h4 className="text-sm font-medium text-green-800 mb-2">Promosi Aktif</h4>
                          <div className="space-y-2">
                            {appliedPromotions.map((applied, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-green-100 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-green-800">{applied.promotion?.name || 'Promosi'}</p>
                                  <p className="text-xs text-green-600">Diskon: {formatCurrency(applied.discount)}</p>
                                </div>
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    customerName && (customerPhone || customerEmail) && (
                      <button
                        onClick={createNewMember}
                        className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm rounded-xl transition-all duration-200 transform hover:scale-105 font-medium shadow-md"
                      >
                        ✨ Daftar sebagai Member Baru
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Cart Items */}
              <div className="space-y-2 mb-6">
                {cart.length === 0 ? (
                  <p className="text-gray-400 text-center py-8 text-sm">Keranjang kosong</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex items-start justify-between p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 mb-3">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm text-gray-900 mb-1">{item.name}</h4>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {item.productCode && (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                              <span className="mr-1">📋</span> {item.productCode}
                            </span>
                          )}
                          {item.size && (
                            <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-md">
                              <span className="mr-1">📏</span> {item.size}
                            </span>
                          )}
                          {item.color && (
                            <span className="inline-flex items-center px-2 py-1 bg-purple-50 text-purple-600 text-xs rounded-md">
                              <span className="mr-1">🎨</span> {item.color}
                            </span>
                          )}
                          <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-600 text-xs rounded-md">
                            <span className="mr-1">🏷️</span> {item.category.name}
                          </span>
                        </div>
                        <p className="text-blue-600 text-sm font-medium">{formatCurrency(item.price)} x {item.quantity}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-bold text-sm text-gray-900">{formatCurrency(item.price * item.quantity)}</p>
                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                            disabled={item.quantity >= item.stock}
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors ml-1"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Voucher Section */}
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <h4 className="text-sm font-semibold text-purple-800">Kode Voucher</h4>
                  </div>
                  {!appliedVoucher ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                          placeholder="Masukkan kode voucher"
                          className="w-full px-4 py-2.5 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm transition-all duration-200 placeholder-gray-400"
                        />
                      </div>
                      <button
                        onClick={validateVoucher}
                        disabled={isValidatingVoucher || !voucherCode.trim()}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-105 disabled:transform-none min-w-[100px]"
                      >
                        {isValidatingVoucher ? (
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Validasi...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>🎫</span>
                            <span>Terapkan</span>
                          </div>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-white border border-purple-200 rounded-lg shadow-sm">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-green-500">✅</span>
                          <p className="text-sm font-semibold text-purple-800">{appliedVoucher.name}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs">
                          <span className="text-purple-600 font-medium">Kode: {appliedVoucher.code}</span>
                          <span className="text-green-600 font-semibold">Diskon: {formatCurrency(voucherDiscount)}</span>
                        </div>
                      </div>
                      <button
                        onClick={removeVoucher}
                        className="ml-3 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 transform hover:scale-110"
                        title="Hapus voucher"
                      >
                        <XCircleIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Payment Method */}
                {cart.length > 0 && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Metode Pembayaran
                    </label>
                  <div className="space-y-2">
                    {[
                      { value: 'CASH', label: 'Tunai', icon: BanknotesIcon },
                      { value: 'CARD', label: 'Kartu Debit/Kredit', icon: CreditCardIcon },
                      { value: 'QRIS', label: 'QRIS', icon: DevicePhoneMobileIcon },
                      { value: 'BANK_TRANSFER', label: 'Transfer Bank', icon: BuildingLibraryIcon },
                      { value: 'MIDTRANS', label: 'Midtrans Payment Gateway', icon: CreditCardIcon }
                    ].map(method => {
                      const IconComponent = method.icon
                      return (
                        <label key={method.value} className="flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={method.value}
                            checked={paymentMethod === method.value}
                            onChange={(e) => {
                              const selectedMethod = e.target.value as any
                              setPaymentMethod(selectedMethod)
                              // Reset cash amount when changing payment method from CASH
                              if (paymentMethod === 'CASH' && selectedMethod !== 'CASH') {
                                setCashAmount(0)
                                setChangeAmount(0)
                              }
                            }}
                            className="mr-3 text-blue-500"
                          />
                          <IconComponent className="h-4 w-4 mr-2 text-gray-600" />
                          <span className="text-sm text-gray-700">{method.label}</span>
                        </label>
                      )
                    })}
                  </div>

                </div>
              )}

              {/* Total */}
              {cart.length > 0 && (
                <div className="border-t border-gray-100 pt-4 mb-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>

                    {pointsToUse > 0 && (
                      <div className="flex justify-between text-green-600">
                      <span>Diskon Poin ({pointsToUse} poin):</span>
                      <span>-{formatCurrency(pointsToUse * 1000)}</span>
                    </div>
                  )}
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-purple-600">
                      <span>Diskon Voucher:</span>
                      <span>-{formatCurrency(voucherDiscount)}</span>
                    </div>
                  )}
                  {promotionDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Diskon Promosi:</span>
                      <span>-{formatCurrency(promotionDiscount)}</span>
                    </div>
                    )}
                    <div className="flex justify-between font-medium text-lg border-t border-gray-100 pt-3 mt-3">
                      <span className="text-gray-800">Total:</span>
                      <span className="text-blue-600 font-semibold">{formatCurrency(total)}</span>
                    </div>
                    {calculateTotal().pointsEarned > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                        <div className="flex justify-between text-sm text-yellow-800">
                          <span>Poin yang didapat:</span>
                          <span className="font-medium text-yellow-800">+{calculateTotal().pointsEarned} poin</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => {
                    if (paymentMethod === 'CASH') {
                      setShowCashPaymentModal(true)
                    } else {
                      processPayment()
                    }
                  }}
                  disabled={cart.length === 0}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 px-6 rounded-lg font-medium text-base transition-colors shadow-sm flex items-center justify-center"
                >
                  Proses Pembayaran
                </button>
                {cart.length > 0 && (
                  <button
                    onClick={printReceipt}
                    className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2.5 px-6 rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center"
                  >
                    <PrinterIcon className="h-4 w-4 mr-2" />
                    Cetak Struk
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Success Modal */}
      {showTransactionModal && completedTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Pembayaran Berhasil!
                </h3>
                <button
                  onClick={() => setShowTransactionModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Transaction Info */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-green-800">
                        Transaksi ID: {completedTransaction.id}
                      </h4>
                      <p className="text-sm text-green-700">
                        {completedTransaction.createdAt.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Kasir</p>
                    <p className="text-sm text-gray-900">{session?.user?.name}</p>
                  </div>
                  {completedTransaction.customerName && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Pelanggan</p>
                      <p className="text-sm text-gray-900">{completedTransaction.customerName}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">Metode Pembayaran</p>
                    <p className="text-sm text-gray-900">
                      {completedTransaction.paymentMethod === 'CASH' ? 'Tunai' :
                       completedTransaction.paymentMethod === 'CARD' ? 'Kartu' :
                       completedTransaction.paymentMethod === 'QRIS' ? 'QRIS' :
                       completedTransaction.paymentMethod === 'BANK_TRANSFER' ? 'Transfer Bank' :
                       completedTransaction.paymentMethod === 'MIDTRANS' ? 'Midtrans Payment Gateway' :
                       'Metode Lain'}
                    </p>
                  </div>
                  {/* Cash Payment Details */}
                  {completedTransaction.paymentMethod === 'CASH' && cashAmount > 0 && (
                    <>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Nominal Pembayaran</p>
                        <p className="text-sm text-gray-900">{formatCurrency(cashAmount)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Kembalian</p>
                        <p className="text-sm text-gray-900">{formatCurrency(changeAmount)}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Items */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Item Pembelian</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Produk
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Harga
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {completedTransaction.items.map((item: CartItem) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {item.name}
                              {item.productCode && (
                                <div className="text-xs text-gray-500">Kode: {item.productCode}</div>
                              )}
                              {item.size && (
                                <div className="text-xs text-gray-500">Ukuran: {item.size}</div>
                              )}
                              {item.color && (
                                <div className="text-xs text-gray-500">Warna: {item.color}</div>
                              )}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">{item.quantity}</td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatCurrency(item.price * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Subtotal:</span>
                      <span className="text-sm text-gray-900">
                        {formatCurrency(completedTransaction.total / 1.1)}
                      </span>
                    </div>

                    {(completedTransaction.pointsUsed ?? 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="text-sm text-gray-600">Diskon Poin ({completedTransaction.pointsUsed} poin):</span>
                        <span className="text-sm text-gray-900">-{formatCurrency((completedTransaction.pointsUsed ?? 0) * 1000)}</span>
                      </div>
                    )}
                    {completedTransaction.voucherCode && (completedTransaction.voucherDiscount ?? 0) > 0 && (
                      <div className="flex justify-between text-purple-600">
                        <span className="text-sm text-gray-600">Diskon Voucher ({completedTransaction.voucherCode}):</span>
                        <span className="text-sm text-gray-900">-{formatCurrency(completedTransaction.voucherDiscount ?? 0)}</span>
                      </div>
                    )}
                    {completedTransaction.appliedPromotions && completedTransaction.appliedPromotions.length > 0 && (
                      <div className="space-y-1">
                        {completedTransaction.appliedPromotions.map((applied: AppliedPromotion, index: number) => (
                          <div key={index} className="flex justify-between text-green-600">
                            <span className="text-sm text-gray-600">Diskon {applied.promotion?.name || 'Promosi'}:</span>
                            <span className="text-sm text-gray-900">-{formatCurrency(applied.discount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between font-medium text-lg border-t pt-2">
                      <span className="text-gray-900">Total:</span>
                      <span className="text-green-600">
                        {formatCurrency(completedTransaction.total)}
                      </span>
                    </div>
                    {(completedTransaction.pointsEarned ?? 0) > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-2">
                        <div className="flex justify-between text-sm text-yellow-800">
                          <span>Poin yang didapat:</span>
                          <span className="font-medium">+{completedTransaction.pointsEarned} poin</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>



                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => {
                      printReceipt()
                      setShowTransactionModal(false)
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    <PrinterIcon className="h-5 w-5 mr-2" />
                    Cetak Struk
                  </button>
                  <button
                    onClick={() => setShowTransactionModal(false)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Transfer Modal */}
      {showBankTransferModal && bankTransferTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">Instruksi Transfer Bank</h2>
                  <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5">Menunggu Konfirmasi</span>
                </div>
                <button
                  onClick={() => setShowBankTransferModal(false)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-start">
                  <InformationCircleIcon className="h-6 w-6 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-800">Informasi Pembayaran</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Silakan transfer sesuai dengan jumlah yang tertera ke rekening berikut. Pembayaran akan dikonfirmasi oleh admin.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-2">Detail Transaksi</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-600">ID Transaksi:</div>
                    <div className="font-medium text-gray-900">{bankTransferTransaction.id}</div>
                    <div className="text-gray-600">Tanggal:</div>
                    <div className="font-medium text-gray-900">
                      {new Date(bankTransferTransaction.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="text-gray-600">Total Pembayaran:</div>
                    <div className="font-medium text-green-600">{formatCurrency(bankTransferTransaction.total)}</div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Rekening Tujuan</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-white p-3 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium">Bank BCA</div>
                        <div className="text-gray-600 text-sm">ROZWA AZHAR AFIFAH</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">6521167294</div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText('6521167294')
                            toast.success('Nomor rekening disalin!')
                          }}
                          className="text-blue-600 text-xs hover:text-blue-800 flex items-center"
                        >
                          <DocumentDuplicateIcon className="h-3 w-3 mr-1" />
                          Salin
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Langkah-langkah Pembayaran</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                    <li>Transfer tepat sejumlah <span className="font-medium text-green-600">{formatCurrency(bankTransferTransaction.total)}</span> ke salah satu rekening di atas</li>
                    <li>Simpan bukti transfer</li>
                    <li>Tunjukkan bukti transfer kepada kasir atau admin untuk konfirmasi pembayaran</li>
                    <li>Pembayaran akan diverifikasi dan status transaksi akan diperbarui</li>
                  </ol>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    printBankTransferInstructions()
                    setShowBankTransferModal(false)
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                >
                  <PrinterIcon className="h-5 w-5 mr-2" />
                  Cetak Instruksi
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Panggil API konfirmasi BANK_TRANSFER yang sekaligus mengurangi stok
                      const response = await fetch('/api/payments/bank-transfer/confirm', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ transactionId: bankTransferTransaction.id })
                      })

                      if (response.ok) {
                        toast.success('Pembayaran berhasil dikonfirmasi!')
                        // Tampilkan modal sukses transaksi
                        setCompletedTransaction({ ...bankTransferTransaction })
                        setShowTransactionModal(true)
                        setShowBankTransferModal(false)
                        // Clear cart dan reset form
                        clearCart()
                        setCustomerName('')
                        setCustomerPhone('')
                        setCustomerEmail('')
                        setMember(null)
                        setPointsToUse(0)
                        setVoucherCode('')
                        setAppliedVoucher(null)
                        setVoucherDiscount(0)
                        setAppliedPromotions([])
                        setPromotionDiscount(0)
                        setBankTransferTransaction(null)
                      } else {
                        const errorData = await response.json()
                        toast.error(errorData.message || 'Gagal mengkonfirmasi pembayaran')
                      }
                    } catch (error) {
                      console.error('Error confirming payment:', error)
                      toast.error('Terjadi kesalahan saat mengkonfirmasi pembayaran')
                    }
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                >
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Konfirmasi Pembayaran
                </button>
                <button
                  onClick={() => setShowBankTransferModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QRIS Payment Modal */}
      {showQrisModal && qrisTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Konfirmasi Pembayaran QRIS</h2>
                <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5">Menunggu Konfirmasi</span>
              </div>
              <button onClick={() => setShowQrisModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">ID Transaksi</p>
                  <p className="text-sm font-medium text-gray-900">{qrisTransaction.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Tanggal</p>
                  <p className="text-sm text-gray-900">{new Date(qrisTransaction.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Pembayaran</p>
                  <p className="text-sm font-medium text-green-600">{formatCurrency(qrisTransaction.total)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Metode</p>
                  <p className="text-sm text-gray-900">QRIS</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Instruksi</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  <li>Minta pelanggan melakukan pembayaran QRIS menggunakan QR statis toko.</li>
                  <li>Pastikan nominal yang dibayar sesuai: <span className="font-medium text-green-600">{formatCurrency(qrisTransaction.total)}</span>.</li>
                  <li>Verifikasi dana telah masuk ke akun toko.</li>
                  <li>Tekan tombol Konfirmasi Pembayaran untuk menyelesaikan transaksi.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/payments/qris/confirm', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ transactionId: qrisTransaction.id })
                    })
                    if (response.ok) {
                      toast.success('Pembayaran QRIS berhasil dikonfirmasi!')
                      // Tampilkan modal sukses transaksi
                      setCompletedTransaction({ ...qrisTransaction })
                      setShowTransactionModal(true)
                      setShowQrisModal(false)
                      clearCart()
                      setCustomerName('')
                      setCustomerPhone('')
                      setCustomerEmail('')
                      setMember(null)
                      setPointsToUse(0)
                      setVoucherCode('')
                      setAppliedVoucher(null)
                      setVoucherDiscount(0)
                      setAppliedPromotions([])
                      setPromotionDiscount(0)
                      setQrisTransaction(null)
                    } else {
                      const errorData = await response.json()
                      toast.error(errorData.message || 'Gagal mengkonfirmasi pembayaran QRIS')
                    }
                  } catch (error) {
                    console.error('Error confirming QRIS payment:', error)
                    toast.error('Terjadi kesalahan saat mengkonfirmasi pembayaran QRIS')
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              >
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                Konfirmasi Pembayaran
              </button>
              <button
                onClick={() => setShowQrisModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARD Payment Modal */}
      {showCardModal && cardTransaction && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Konfirmasi Pembayaran Kartu</h3>
                <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5">Menunggu Konfirmasi</span>
              </div>
              <button onClick={() => setShowCardModal(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Pembayaran</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(cardTransaction.total)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Metode</p>
                  <p className="text-sm text-gray-900">Kartu Debit/Kredit</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">Instruksi</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                  <li>Proses pembayaran menggunakan mesin EDC atau aplikasi kartu.</li>
                  <li>Pastikan nominal yang dibayar sesuai: <span className="font-medium text-green-600">{formatCurrency(cardTransaction.total)}</span>.</li>
                  <li>Verifikasi transaksi sukses pada mesin EDC/aplikasi.</li>
                  <li>Tekan tombol Konfirmasi Pembayaran untuk menyelesaikan transaksi dan mengurangi stok.</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/payments/card/confirm', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ transactionId: cardTransaction.id })
                    })
                    if (response.ok) {
                      toast.success('Pembayaran Kartu berhasil dikonfirmasi!')
                      // Tampilkan modal sukses transaksi
                      setCompletedTransaction({ ...cardTransaction })
                      setShowTransactionModal(true)
                      setShowCardModal(false)
                      clearCart()
                      setCustomerName('')
                      setCustomerPhone('')
                      setCustomerEmail('')
                      setMember(null)
                      setPointsToUse(0)
                      setVoucherCode('')
                      setAppliedVoucher(null)
                      setVoucherDiscount(0)
                      setAppliedPromotions([])
                      setPromotionDiscount(0)
                      setCardTransaction(null)
                    } else {
                      const errorData = await response.json()
                      toast.error(errorData.message || 'Gagal mengkonfirmasi pembayaran Kartu')
                    }
                  } catch (error) {
                    console.error('Error confirming CARD payment:', error)
                    toast.error('Terjadi kesalahan saat mengkonfirmasi pembayaran Kartu')
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
              >
                <CheckCircleIcon className="h-5 w-5 mr-2" />
                Konfirmasi Pembayaran
              </button>
              <button
                onClick={() => setShowCardModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Payment Modal */}
      {showCashPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Pembayaran Tunai</h3>
              <button
                onClick={() => {
                  setShowCashPaymentModal(false)
                  setPaymentMethod('CASH') // Keep CASH selected
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Total Belanja
                </label>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(total)}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nominal Pembayaran
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={cashAmount || ''}
                  onChange={(e) => {
                    const amount = parseFloat(e.target.value) || 0
                    setCashAmount(amount)
                    const change = amount - total
                    setChangeAmount(change > 0 ? change : 0)
                  }}
                  placeholder="Masukkan nominal pembayaran"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  autoFocus
                />
                
                {/* Quick Amount Buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCashAmount(total)
                      setChangeAmount(0)
                    }}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors"
                  >
                    Pas
                  </button>
                </div>
              </div>
              
              {/* Change Display */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800">Kembalian:</span>
                  <span className="text-lg font-bold text-green-900">
                    {cashAmount >= total ? formatCurrency(changeAmount) : '-'}
                  </span>
                </div>
                {cashAmount > 0 && cashAmount < total && (
                  <p className="text-xs text-red-600 mt-1">
                    Pembayaran kurang {formatCurrency(total - cashAmount)}
                  </p>
                )}
              </div>
            </div>
            
            {/* Modal Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCashPaymentModal(false)
                  // Process payment if amount is sufficient
                  if (cashAmount >= total) {
                    processPayment()
                  }
                }}
                disabled={!cashAmount || cashAmount < total}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition-colors"
              >
                Konfirmasi Pembayaran
              </button>
              <button
                onClick={() => {
                  setShowCashPaymentModal(false)
                  setPaymentMethod('CASH') // Keep CASH selected but reset amounts
                  setCashAmount(0)
                  setChangeAmount(0)
                }}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
