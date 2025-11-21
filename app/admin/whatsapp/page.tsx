"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  WifiIcon,
  XCircleIcon,
  CheckCircleIcon,
  QrCodeIcon,
  PhoneIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import { apiFetch } from '@/lib/api'

interface WhatsAppStatus {
  isConnected: boolean
  qrCode?: string
  timestamp: string
}

export default function WhatsAppManagementPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Check if user is admin
  useEffect(() => {
    if (authLoading) return
    
    if (!user) {
      router.push('/login')
      return
    }
    
    if (user.role !== 'ADMIN') {
      toast.error('Akses ditolak - Hanya admin yang dapat mengakses halaman ini')
      router.push('/')
      return
    }
  }, [user, authLoading, router])

  // Fetch WhatsApp connection status
  const fetchStatus = async () => {
    try {
      const response = await apiFetch('/api/v1/whatsapp/connection')
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch status')
      }
      
      const data = await response.json()
      
      // Only update state if there's an actual change to prevent unnecessary re-renders
      if (!whatsappStatus || 
          data.isConnected !== whatsappStatus.isConnected || 
          data.qrCode !== whatsappStatus.qrCode) {
        setWhatsappStatus(data)
      }
    } catch (error) {
      console.error('Error fetching WhatsApp status:', error)
      toast.error('Gagal memuat status WhatsApp')
      // Don't update state on error to prevent unnecessary re-renders
    } finally {
      setLoading(false)
    }
  }

  // Initialize WhatsApp connection
  const initializeConnection = async () => {
    setConnecting(true)
    try {
      const response = await apiFetch('/api/v1/whatsapp/connection', { method: 'POST' })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to initialize connection')
      }
      
      const data = await response.json()
      setWhatsappStatus(data)
      toast.success('Koneksi WhatsApp berhasil diinisialisasi')
      
      // Start polling for status updates
      startStatusPolling()
    } catch (error) {
      console.error('Error initializing WhatsApp:', error)
      toast.error('Gagal menginisialisasi koneksi WhatsApp')
    } finally {
      setConnecting(false)
    }
  }

  // Disconnect WhatsApp
  const disconnectWhatsApp = async () => {
    setDisconnecting(true)
    try {
      const response = await apiFetch('/api/v1/whatsapp/connection', { method: 'DELETE' })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to disconnect')
      }
      
      setWhatsappStatus({ isConnected: false, timestamp: new Date().toISOString() })
      toast.success('WhatsApp berhasil diputuskan')
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error)
      toast.error('Gagal memutuskan koneksi WhatsApp')
    } finally {
      setDisconnecting(false)
    }
  }

  // Logout WhatsApp (disconnect and remove session files)
  const logoutWhatsApp = async () => {
    setLoggingOut(true)
    try {
      const response = await apiFetch('/api/v1/whatsapp/logout', { method: 'POST' })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to logout')
      }
      
      setWhatsappStatus({ isConnected: false, timestamp: new Date().toISOString() })
      toast.success('WhatsApp berhasil logout - session direset untuk login baru')
    } catch (error) {
      console.error('Error logging out WhatsApp:', error)
      toast.error('Gagal logout WhatsApp')
    } finally {
      setLoggingOut(false)
    }
  }

  // Start polling for status updates when QR code is shown
  const startStatusPolling = () => {
    const interval = setInterval(async () => {
      try {
        // Use the Express v1 endpoint for WhatsApp status polling
        const response = await apiFetch('/api/v1/whatsapp/connection')
        if (response.ok) {
          const data = await response.json()
          setWhatsappStatus(data)
          
          // Stop polling if connected or no QR code
          if (data.isConnected || !data.qrCode) {
            clearInterval(interval)
          }
        }
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }, 3000) // Poll every 3 seconds

    // Clear interval after 5 minutes
    setTimeout(() => clearInterval(interval), 300000)
  }

  // Initial status fetch and polling
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchStatus()
      
      // Set up polling with longer interval to reduce server load
      const interval = setInterval(fetchStatus, 10000) // Poll every 10 seconds
      
      return () => clearInterval(interval)
    }
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user || user.role !== 'ADMIN') {
    return null
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
              <h1 className="text-2xl font-bold text-gray-900">Manajemen WhatsApp</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Connection Status Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Status Koneksi WhatsApp</h2>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {whatsappStatus && (
            <div className="flex items-center space-x-4">
              {whatsappStatus.isConnected ? (
                <>
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-lg font-medium text-green-700">Terhubung</p>
                      <p className="text-sm text-gray-500">
                        Terakhir diperbarui: {new Date(whatsappStatus.timestamp).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1"></div>
                  <div className="flex space-x-3">
                    <button
                      onClick={disconnectWhatsApp}
                      disabled={disconnecting}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                    >
                      {disconnecting ? (
                        <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 mr-2" />
                      )}
                      Putuskan Koneksi
                    </button>
                    <button
                      onClick={logoutWhatsApp}
                      disabled={loggingOut}
                      className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                    >
                      {loggingOut ? (
                        <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                      )}
                      Logout & Reset Session
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <XCircleIcon className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="text-lg font-medium text-red-700">Tidak Terhubung</p>
                      <p className="text-sm text-gray-500">
                        WhatsApp belum terhubung ke sistem
                      </p>
                    </div>
                  </div>
                  <div className="flex-1"></div>
                  <button
                    onClick={initializeConnection}
                    disabled={connecting}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center"
                  >
                    {connecting ? (
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <WifiIcon className="h-5 w-5 mr-2" />
                    )}
                    Hubungkan WhatsApp
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* QR Code Card */}
        {whatsappStatus?.qrCode && !whatsappStatus.isConnected && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="text-center">
              <QrCodeIcon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Scan QR Code untuk Menghubungkan WhatsApp
              </h3>
              <p className="text-gray-600 mb-6">
                Buka WhatsApp di ponsel Anda, pilih "WhatsApp Web" dan scan QR code di bawah ini
              </p>
              
              <div className="flex justify-center mb-6">
                <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img
                    src={whatsappStatus.qrCode}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-blue-800">Petunjuk:</p>
                    <ol className="text-sm text-blue-700 mt-1 space-y-1">
                      <li>1. Buka aplikasi WhatsApp di ponsel Anda</li>
                      <li>2. Tap menu (⋮) atau Settings</li>
                      <li>3. Pilih "WhatsApp Web"</li>
                      <li>4. Tap "Scan QR Code"</li>
                      <li>5. Arahkan kamera ke QR code di atas</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Information Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start space-x-3">
            <PhoneIcon className="h-6 w-6 text-blue-600 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Tentang Fitur WhatsApp
              </h3>
              <div className="text-gray-600 space-y-2">
                <p>
                  Sistem akan secara otomatis mengirim struk pembelian melalui WhatsApp kepada pelanggan 
                  yang memiliki nomor telepon terdaftar.
                </p>
                <p>
                  Fitur ini menggunakan nomor WhatsApp yang Anda hubungkan melalui QR code di atas. 
                  Pastikan nomor tersebut adalah nomor bisnis yang valid.
                </p>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mt-4">
                  <p className="text-sm text-amber-800">
                    <strong>Catatan:</strong> Koneksi WhatsApp akan tetap aktif selama aplikasi berjalan. 
                    Jika server restart, Anda perlu menghubungkan ulang WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}