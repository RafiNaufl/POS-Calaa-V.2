'use client'

import React, { useState, useEffect, useRef } from 'react'
import { PrinterIcon } from '@heroicons/react/24/outline'

// Define types for Web Bluetooth API
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice: (options: { filters?: Array<{ services?: string[], namePrefix?: string }>, optionalServices?: string[] }) => Promise<BluetoothDevice>
    }
  }
  
  interface BluetoothDevice {
    gatt?: {
      connect: () => Promise<BluetoothRemoteGATTServer>
    }
    name?: string
  }
  
  interface BluetoothRemoteGATTServer {
    getPrimaryService: (service: string) => Promise<BluetoothRemoteGATTService>
    disconnect: () => void
    connected: boolean
  }
  
  interface BluetoothRemoteGATTService {
    getCharacteristic: (characteristic: string) => Promise<BluetoothRemoteGATTCharacteristic>
    getCharacteristics?: () => Promise<BluetoothRemoteGATTCharacteristic[]>
    uuid?: string
  }
  
  interface BluetoothRemoteGATTCharacteristic {
    writeValue: (value: BufferSource) => Promise<void>
    uuid?: string
    properties: {
      write?: boolean
      writeWithoutResponse?: boolean
      read?: boolean
      notify?: boolean
      indicate?: boolean
      authenticatedSignedWrites?: boolean
      reliableWrite?: boolean
      writableAuxiliaries?: boolean
    }
  }
}

interface ThermalPrinterProps {
  receiptHTML: string
  onPrintSuccess?: () => void
  onPrintError?: (error: string) => void
}

// ESC/POS Commands
const ESC = '\x1B'
const GS = '\x1D'
const INIT = ESC + '@'
const CUT = GS + 'V' + '\x00'
const LINE_FEED = '\x0A'
const ALIGN_CENTER = ESC + 'a' + '\x01'
const ALIGN_LEFT = ESC + 'a' + '\x00'
const ALIGN_RIGHT = ESC + 'a' + '\x02'
const FONT_BOLD_ON = ESC + 'E' + '\x01'
const FONT_BOLD_OFF = ESC + 'E' + '\x00'
const TEXT_NORMAL = ESC + '!' + '\x00'
const TEXT_DOUBLE_HEIGHT = ESC + '!' + '\x10'
const TEXT_DOUBLE_WIDTH = ESC + '!' + '\x20'
const TEXT_DOUBLE_HEIGHT_WIDTH = ESC + '!' + '\x30'

// Common Bluetooth service UUIDs for printers
const PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Common printer service (Kassen BTP)
  '00001101-0000-1000-8000-00805f9b34fb', // Serial Port Profile (SPP) - Most common for printers
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Information Service
  '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // EPSON Printer Service
  'af20fbac-2518-4998-9af7-af42540731b3', // Star Micronics Service
  '00035b03-58e6-07dd-021a-08123a000300', // Rongta Printer Service
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // Generic Printer Service
  '00001105-0000-1000-8000-00805f9b34fb', // OBject EXchange (OBEX) Service
  '00001106-0000-1000-8000-00805f9b34fb', // OBEX File Transfer
  '00001124-0000-1000-8000-00805f9b34fb', // Human Interface Device Service
  '00001132-0000-1000-8000-00805f9b34fb', // Printing Status Service
  '1812', // Printer Service
  '1811', // Alert Notification Service
  '180A', // Device Information Service
  '180F', // Battery Service
  '18F0', // Generic printer service
  'FFB0', // Common thermal printer service
  '0000ff00-0000-1000-8000-00805f9b34fb', // Printer service
  '0000ae30-0000-1000-8000-00805f9b34fb'  // Printer service
]

// Common Bluetooth characteristic UUIDs for printers
const PRINTER_CHARACTERISTICS = [
  '0000ffe1-0000-1000-8000-00805f9b34fb', // Standard SPP characteristic
  '00002af1-0000-1000-8000-00805f9b34fb', // Common printer characteristic
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Another common printer characteristic
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // Another common printer characteristic
  'BEF8D6C9-9C21-4C9E-B632-BD58C1009F9F', // Generic printer characteristic
  'E7810A71-73AE-499D-8C15-FAA9AEF0C3F2', // Custom printer characteristic
  'FFB1', // Common thermal printer characteristic
  'FFB2', // Common thermal printer characteristic
  '00002902-0000-1000-8000-00805f9b34fb', // Client Characteristic Configuration
  '00002901-0000-1000-8000-00805f9b34fb', // Characteristic User Description
  '0000ae01-0000-1000-8000-00805f9b34fb', // Printer characteristic
  '0000ae02-0000-1000-8000-00805f9b34fb', // Printer characteristic
  '0000ff01-0000-1000-8000-00805f9b34fb', // Printer characteristic
  '0000ff02-0000-1000-8000-00805f9b34fb', // Printer characteristic
  '00002a06-0000-1000-8000-00805f9b34fb', // Alert Level
  '00002a00-0000-1000-8000-00805f9b34fb', // Device Name
  '00002a01-0000-1000-8000-00805f9b34fb', // Appearance
  '00002a05-0000-1000-8000-00805f9b34fb', // Service Changed
  '9e5d1e47-5c13-43a0-8635-82ad38a1386f', // EPSON Printer Data Transfer
  '35b4bbe3-0d7a-4f1f-8cbd-9fea13dd9ec3', // Star Micronics Data Transfer
  '00035b03-58e6-07dd-021a-08123a000301', // Rongta Data Characteristic
  '00035b03-58e6-07dd-021a-08123a0003ff'  // Rongta Command Characteristic
]

export default function ThermalPrinter({ receiptHTML, onPrintSuccess, onPrintError }: ThermalPrinterProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [autoPrintAttempted, setAutoPrintAttempted] = useState(false)
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice | null>(null)
  const [bluetoothCharacteristic, setBluetoothCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null)
  const [printerName, setPrinterName] = useState<string>('Thermal Printer')
  
  // Check if Web Bluetooth API is supported and detect platform
  const isWebBluetoothSupported = typeof navigator !== 'undefined' && navigator.bluetooth !== undefined
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  // Connect to the printer via Bluetooth
  const connectBluetoothPrinter = async () => {
    if (!isWebBluetoothSupported) {
      setErrorMessage('Web Bluetooth API tidak didukung di browser ini')
      if (onPrintError) onPrintError('Web Bluetooth API tidak didukung di browser ini')
      return false
    }

    try {
      setIsLoading(true)
      setErrorMessage('')

      console.log('Meminta akses Bluetooth untuk printer thermal...')
      
      // Configure options based on platform
      let bluetoothOptions = {}
      
      if (isAndroid) {
        console.log('Menggunakan konfigurasi khusus Android...')
        // Android often works better with fewer filters and more optionalServices
        bluetoothOptions = {
          // Untuk Android, kita gunakan acceptAllDevices untuk melihat semua perangkat Bluetooth
          // Ini membantu menemukan printer yang mungkin tidak mengiklankan layanan standar
          acceptAllDevices: true,
          // Include all services as optional for better device discovery
          optionalServices: PRINTER_SERVICES
        }
        
        console.log('Konfigurasi Android: acceptAllDevices dengan optionalServices')
        console.log('PENTING: Pastikan printer sudah dipasangkan di pengaturan Bluetooth Android')
      } else {
        // Default configuration for other platforms
        bluetoothOptions = {
          filters: [
            { namePrefix: 'Printer' },   // Generic printer name
            { namePrefix: 'POS' },        // Point of Sale printer
            { namePrefix: 'Thermal' },    // Thermal printer
            { namePrefix: 'BT' },         // Bluetooth printer
            { namePrefix: 'TP' },         // Thermal Printer abbreviation
            { namePrefix: 'ZJ' },         // Common for some thermal printers
            { namePrefix: 'MHT' },        // Common for some thermal printers
            { namePrefix: 'Kassen' },     // Kassen brand
            { namePrefix: 'BTP' },        // BTP model series
            { namePrefix: 'RONGTA' },     // Rongta printers
            { namePrefix: 'RT' },         // Rongta abbreviation
            { namePrefix: 'EPSON' },      // Epson printers
            { namePrefix: 'TM-' },        // Epson TM series
            { namePrefix: 'Star' },       // Star Micronics
            { namePrefix: 'SM-' },        // Star Micronics model prefix
            { namePrefix: 'SPP' },        // Serial Port Profile devices
            { namePrefix: 'MUNBYN' },     // Munbyn printers
            { namePrefix: 'ITPP' },       // ITPP printers
            { namePrefix: 'HOIN' },       // HOIN printers
            { namePrefix: 'BIXOLON' },    // Bixolon printers
            { namePrefix: 'GOOJPRT' },    // Goojprt printers
            { namePrefix: 'XPRINTER' },   // XPrinter brand
            { namePrefix: 'XP-' }         // XPrinter model prefix
          ],
          optionalServices: PRINTER_SERVICES  // Common printer services from our constant
        }
      }
      
      // Request Bluetooth device with printer services
      const device = await navigator.bluetooth!.requestDevice(bluetoothOptions)
      
      console.log(`Perangkat Bluetooth ditemukan: ${device.name || 'Unnamed device'}`)
      setPrinterName(device.name || 'Thermal Printer')
      
      if (!device.gatt) {
        throw new Error('Perangkat Bluetooth tidak mendukung GATT')
      }
      
      // Connect to the GATT server
      console.log('Menghubungkan ke GATT server...')
      
      // Pada Android, kita perlu menangani koneksi GATT dengan lebih hati-hati
      let server
      try {
        // Tambahkan timeout untuk koneksi GATT
        const connectPromise = device.gatt.connect()
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout menghubungkan ke GATT server')), 10000)
        })
        
        server = await Promise.race([connectPromise, timeoutPromise])
        console.log('Koneksi ke GATT server berhasil')
      } catch (gattError) {
        console.error('Error saat menghubungkan ke GATT server:', gattError)
        
        if (isAndroid) {
          // Pada Android, coba lagi dengan delay dan beberapa kali percobaan
          console.log('Mencoba ulang koneksi GATT pada Android dengan delay...')
          
          // Coba hingga 3 kali dengan delay yang meningkat
          let retryCount = 0
          const maxRetries = 3
          
          while (retryCount < maxRetries) {
            try {
              // Tunggu dengan delay yang meningkat setiap percobaan
              const delayMs = 2000 + (retryCount * 1000)
              console.log(`Percobaan ${retryCount + 1}/${maxRetries} dengan delay ${delayMs}ms...`)
              await new Promise(resolve => setTimeout(resolve, delayMs))
              
              // Coba hubungkan kembali
              server = await device.gatt.connect()
              console.log(`Koneksi berhasil pada percobaan ke-${retryCount + 1}`)
              break
            } catch (retryError) {
              retryCount++
              console.error(`Gagal pada percobaan ke-${retryCount}:`, retryError)
              
              if (retryCount >= maxRetries) {
                // Analisis error untuk memberikan pesan yang lebih spesifik
                const errorMsg = String(retryError).toLowerCase()
                if (errorMsg.includes('gatt') && errorMsg.includes('error')) {
                  throw new Error('GATT Error: Gagal menghubungkan ke printer')
                } else if (errorMsg.includes('not paired') || errorMsg.includes('pairing')) {
                  throw new Error('Not paired: Printer belum dipasangkan di pengaturan Bluetooth Android')
                } else if (errorMsg.includes('timeout')) {
                  throw new Error('Timeout: Printer tidak merespon dalam waktu yang ditentukan')
                } else {
                  throw new Error(`Gagal menghubungkan setelah ${maxRetries} percobaan: ${retryError instanceof Error ? retryError.message : String(retryError)}`)
                }
              }
            }
          }
        } else {
          throw gattError
        }
      }
      
      // Mencoba mendapatkan layanan yang tersedia satu per satu
      console.log('Mencoba mendapatkan layanan yang tersedia...')
      let allServices: any[] = []
      
      // Karena getPrimaryServices() tidak tersedia di semua implementasi,
      // kita akan mencoba mendapatkan layanan satu per satu dari daftar yang kita ketahui
      for (const serviceUuid of PRINTER_SERVICES) {
        try {
          const service = await (server as BluetoothRemoteGATTServer).getPrimaryService(serviceUuid)
          if (service) {
            allServices.push(service)
            console.log(`Layanan ditemukan: ${serviceUuid}`)
          }
        } catch (e) {
          // Lanjutkan ke layanan berikutnya jika tidak ditemukan
        }
      }
      
      console.log(`Ditemukan ${allServices.length} layanan tersedia`)
      if (allServices.length === 0) {
        console.log('Tidak ada layanan yang ditemukan, mencoba layanan spesifik')
      }
      
      // First try with all discovered services
      let characteristic = null
      let foundCharacteristics = []
      if (allServices.length > 0) {
        for (const service of allServices) {
          try {
            console.log(`Mencoba layanan yang ditemukan: ${service.uuid || 'unknown'}`)
            
            // Get all characteristics for this service
            let characteristics: BluetoothRemoteGATTCharacteristic[] = []
            
            // Try to use getCharacteristics() if available, otherwise try each known characteristic
            if (service.getCharacteristics) {
              try {
                characteristics = await service.getCharacteristics()
                console.log(`Ditemukan ${characteristics.length} karakteristik untuk layanan ${service.uuid || 'unknown'}`)
              } catch (e) {
                console.log('getCharacteristics() tidak didukung, mencoba karakteristik satu per satu')
              }
            }
            
            // If getCharacteristics() failed or isn't available, try each known characteristic
            if (characteristics.length === 0) {
              for (const charUuid of PRINTER_CHARACTERISTICS) {
                try {
                  const char = await service.getCharacteristic(charUuid)
                  if (char) {
                    characteristics.push(char)
                    console.log(`Karakteristik ditemukan: ${charUuid}`)
                  }
                } catch (e) {
                  // Lanjutkan ke karakteristik berikutnya jika tidak ditemukan
                }
              }
              console.log(`Ditemukan ${characteristics.length} karakteristik untuk layanan ${service.uuid || 'unknown'} dengan metode alternatif`)
            }
            
            // Try each characteristic
            for (const char of characteristics) {
              console.log(`Memeriksa karakteristik: ${char.uuid || 'unknown'}, Writable: ${char.properties.write}, WriteWithoutResponse: ${char.properties.writeWithoutResponse}`)
              
              // Check if characteristic is writable
              if (char.properties.write || char.properties.writeWithoutResponse) {
                console.log(`Karakteristik yang dapat ditulis ditemukan: ${char.uuid || 'unknown'}`)
                foundCharacteristics.push(char)
              }
            }
          } catch (serviceError) {
            console.log(`Error saat memeriksa layanan: ${service.uuid || 'unknown'}`, serviceError)
          }
        }
        
        // Prioritize characteristics that support writeWithoutResponse for Android
        if (foundCharacteristics.length > 0) {
          console.log(`Ditemukan ${foundCharacteristics.length} karakteristik yang dapat ditulis`)
          
          if (isAndroid) {
            // For Android, prioritize characteristics with writeWithoutResponse
            const writeWithoutResponseChar = foundCharacteristics.find(char => char.properties.writeWithoutResponse)
            if (writeWithoutResponseChar) {
              characteristic = writeWithoutResponseChar
              console.log('Menggunakan karakteristik dengan writeWithoutResponse untuk Android')
            } else {
              characteristic = foundCharacteristics[0]
              console.log('Tidak ada karakteristik writeWithoutResponse, menggunakan karakteristik write standar')
            }
          } else {
            // For other platforms, use the first characteristic found
            characteristic = foundCharacteristics[0]
          }
        }
      }
      
      // If no suitable characteristic found with discovered services, try with known service/characteristic pairs
      if (!characteristic) {
        console.log('Mencoba layanan dan karakteristik yang diketahui...')
        let service = null
        
        for (const serviceId of PRINTER_SERVICES) {
          try {
            console.log(`Mencoba service: ${serviceId}...`)
            service = await (server as BluetoothRemoteGATTServer).getPrimaryService(serviceId)
            
            // Try to find writable characteristics
            try {
              // Try standard SPP characteristic first
              const sppCharacteristic = '0000ffe1-0000-1000-8000-00805f9b34fb' // Standard SPP characteristic
              try {
                const char = await service.getCharacteristic(sppCharacteristic)
                if (char && (char.properties.write || char.properties.writeWithoutResponse)) {
                  foundCharacteristics.push(char)
                  console.log('Karakteristik SPP ditemukan')
                }
              } catch (sppErr) {
                console.log('Karakteristik SPP tidak ditemukan, mencoba karakteristik lain...')
              }
              
              // Try other common printer characteristics
              for (const charId of PRINTER_CHARACTERISTICS) {
                try {
                  const char = await service.getCharacteristic(charId)
                  if (char && (char.properties.write || char.properties.writeWithoutResponse)) {
                    foundCharacteristics.push(char)
                    console.log(`Karakteristik ditemukan: ${charId}`)
                  }
                } catch (e) {
                  console.log(`Karakteristik ${charId} tidak tersedia`)
                }
              }
            } catch (charErr) {
              console.log(`Error saat mencari karakteristik: ${charErr instanceof Error ? charErr.message : String(charErr)}`)
            }
          } catch (err) {
            console.log(`Service ${serviceId} tidak tersedia`, err)
          }
        }
        
        // Prioritaskan karakteristik yang mendukung writeWithoutResponse untuk Android
        if (foundCharacteristics.length > 0) {
          console.log(`Total ditemukan ${foundCharacteristics.length} karakteristik yang dapat ditulis`)
          
          if (isAndroid) {
            // Untuk Android, prioritaskan karakteristik dengan writeWithoutResponse
            const writeWithoutResponseChar = foundCharacteristics.find(char => char.properties.writeWithoutResponse)
            if (writeWithoutResponseChar) {
              characteristic = writeWithoutResponseChar
              console.log('Menggunakan karakteristik dengan writeWithoutResponse untuk Android')
            } else {
              characteristic = foundCharacteristics[0]
              console.log('Tidak ada karakteristik writeWithoutResponse, menggunakan karakteristik write standar')
            }
          } else {
            // Untuk platform lain, gunakan karakteristik pertama yang ditemukan
            characteristic = foundCharacteristics[0]
          }
        }
      }
      
      if (!characteristic) {
        let errorMsg = 'Tidak dapat menemukan karakteristik yang dapat ditulis pada printer.';
        
        if (isAndroid) {
          errorMsg += ' Untuk Android: Pastikan printer sudah dipasangkan di pengaturan Bluetooth, coba matikan dan nyalakan printer, lalu coba lagi.';
          
          // Tambahkan informasi diagnostik
          if (allServices.length === 0) {
            errorMsg += ' Tidak ada layanan Bluetooth yang ditemukan pada printer.';
          } else if (foundCharacteristics.length === 0) {
            errorMsg += ' Tidak ada karakteristik yang dapat ditulis yang ditemukan pada layanan printer.';
          }
        } else {
          errorMsg += ' Pastikan printer dalam mode siap terima koneksi.';
        }
        
        throw new Error(errorMsg);
      }
      
      setBluetoothDevice(device)
      setBluetoothCharacteristic(characteristic)
      setIsConnected(true)
      setIsLoading(false)
      
      console.log('Koneksi Bluetooth berhasil')
      return true
    } catch (error: unknown) {
      try {
        console.error('Error connecting to Bluetooth printer:', error)
        let errorMsg = 'Pastikan printer Bluetooth aktif dan dalam jangkauan.'
        
        if (error instanceof Error) {
        if (error.name === 'NotFoundError') {
          errorMsg = 'Tidak dapat menemukan printer Bluetooth yang didukung. Pastikan printer dinyalakan dan dalam mode pairing.'
        } else if (error.name === 'SecurityError') {
          errorMsg = 'Akses Bluetooth ditolak oleh pengguna atau browser'
          if (isAndroid) {
            errorMsg += '. Pada Android, pastikan aplikasi memiliki izin Bluetooth dan Lokasi.'
          }
        } else if (error.name === 'NetworkError') {
          errorMsg = 'Koneksi Bluetooth terputus. Coba nyalakan ulang printer.'
        } else if (error.message.includes('User cancelled')) {
          errorMsg = 'Pemilihan perangkat dibatalkan oleh pengguna'
        } else if (isAndroid && error.message.includes('Bluetooth adapter not available')) {
          errorMsg = 'Adapter Bluetooth tidak tersedia. Pastikan Bluetooth diaktifkan pada perangkat Android Anda.'
        } else if (isAndroid && error.message.includes('Location permission')) {
          errorMsg = 'Izin lokasi diperlukan untuk pemindaian Bluetooth pada Android. Berikan izin lokasi saat diminta.'
        } else if (isAndroid && (error.message.includes('GATT Error') || error.message.includes('GATT'))) {
          errorMsg = 'GATT Error: Pastikan printer sudah dipasangkan (paired) di pengaturan Bluetooth Android sebelum mencoba menghubungkan di aplikasi.'
        } else if (isAndroid && error.message.includes('Not paired')) {
          errorMsg = 'Printer tidak dipasangkan: Anda harus memasangkan (pair) printer di pengaturan Bluetooth Android terlebih dahulu.'
        } else if (isAndroid && error.message.includes('Timeout')) {
          errorMsg = 'Koneksi timeout: Printer mungkin tidak merespon. Pastikan printer menyala, dalam jangkauan, dan sudah dipasangkan di pengaturan Bluetooth.'
        } else {
          errorMsg = error.message
        }
      }
      
      setErrorMessage(`Gagal terhubung ke printer Bluetooth: ${errorMsg}`)
      if (onPrintError) onPrintError(`Gagal terhubung ke printer Bluetooth: ${errorMsg}`)
      setIsLoading(false)
      return false
      } catch (finalError) {
        console.error('Final error handler:', finalError)
        setErrorMessage(`Gagal terhubung ke printer Bluetooth: Terjadi kesalahan tak terduga`)
        if (onPrintError) onPrintError(`Gagal terhubung ke printer Bluetooth: Terjadi kesalahan tak terduga`)
        setIsLoading(false)
        return false
      }
    }
  }
  
  // Connect to the printer via Bluetooth
  const connectPrinter = async () => {
    console.log('Mencoba menghubungkan printer thermal via Bluetooth...')
    
    if (isWebBluetoothSupported) {
      console.log('Mencoba koneksi Bluetooth...')
      
      // For Android, show specific instructions
      if (isAndroid) {
        console.log('Terdeteksi perangkat Android, menampilkan petunjuk khusus...')
      }
      
      const bluetoothSuccess = await connectBluetoothPrinter()
      if (bluetoothSuccess) {
        console.log(`Koneksi Bluetooth berhasil, mempersiapkan data untuk printer ${printerName}...`)
        const escposCommands = convertHTMLToESCPOS(receiptHTML)
        await sendToPrinter(escposCommands)
        return
      }
    } else {
      let errorMsg = 'Web Bluetooth API tidak didukung di browser ini.'
      
      if (isAndroid) {
        errorMsg += ' Untuk Android, gunakan Chrome versi 79 atau lebih baru. Pastikan fitur Web Bluetooth diaktifkan di chrome://flags.'
      } else {
        errorMsg += ' Gunakan browser yang mendukung Web Bluetooth API seperti Chrome, Edge, atau Opera.'
      }
      
      setErrorMessage(errorMsg)
      if (onPrintError) onPrintError(errorMsg)
    }
    
    // If Bluetooth fails
    let failMsg = 'Gagal terhubung ke printer thermal melalui Bluetooth. Pastikan printer aktif dan dalam jangkauan koneksi.'
    
    if (isAndroid) {
      failMsg += ' Pada perangkat Android, pastikan Anda telah memberikan izin Bluetooth dan Lokasi.'
    }
    
    setErrorMessage(failMsg)
    if (onPrintError) onPrintError('Gagal terhubung ke printer thermal melalui Bluetooth.')
  }

  // Disconnect from the printer
  const disconnectPrinter = async () => {
    try {
      // Clean up Bluetooth connection
      if (bluetoothDevice) {
        try {
          // Web Bluetooth API doesn't have a direct disconnect method
          // The connection is automatically closed when the reference is removed
          // or when the page is unloaded
          console.log('Melepaskan referensi perangkat Bluetooth')
          
          // Clear the references to allow garbage collection
          setBluetoothDevice(null)
          setBluetoothCharacteristic(null)
          setPrinterName('')
          console.log('Perangkat Bluetooth dilepaskan')
        } catch (err) {
          console.error('Error melepaskan perangkat Bluetooth:', err)
        }
      }
      
      setIsConnected(false)
      console.log('Printer disconnected')
    } catch (error) {
      console.error('Error disconnecting printer:', error)
    }
  }

  // Clean up on unmount and auto-connect on mount
  useEffect(() => {
    // Auto-connect and print when component mounts
    if (!autoPrintAttempted && isWebBluetoothSupported) {
      console.log('Mencoba auto-connect ke printer via Bluetooth...')
      setAutoPrintAttempted(true)
      
      // Add a small delay before attempting to connect
      // This helps ensure the component is fully mounted
      setTimeout(() => {
        try {
          connectPrinter()
            .catch(err => {
              console.error('Auto-connect gagal:', err)
              // Reset autoPrintAttempted after a delay to allow retry
              setTimeout(() => {
                if (!isConnected) setAutoPrintAttempted(false)
              }, 5000)
            })
        } catch (err) {
          console.error('Error dalam auto-connect:', err)
        }
      }, 1000)
    }
    
    return () => {
      console.log('Component unmounting, disconnecting printer...')
      disconnectPrinter()
    }
  }, [])

  // Convert HTML receipt to ESC/POS commands
  // Optimized for thermal printers with 58mm paper width and 48mm valid printing width
  const convertHTMLToESCPOS = (html: string): string => {
    console.log('Mengkonversi HTML ke format ESC/POS untuk printer thermal...')
    
    // Extract text content from HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    const textContent = tempDiv.textContent || ''
    
    // Basic ESC/POS formatting
    let escposCommands = INIT // Initialize printer
    
    // Set character size - Kassen BTP299 supports 9x17 and 12x24 fonts
    // For 58mm paper with 48mm print width, we need to be careful with text length
    
    // Add store header with center alignment
    escposCommands += ALIGN_CENTER
    escposCommands += FONT_BOLD_ON
    escposCommands += TEXT_DOUBLE_HEIGHT_WIDTH
    escposCommands += 'TOKO SERBAGUNA' + LINE_FEED
    escposCommands += TEXT_NORMAL
    escposCommands += 'Jl. Contoh No. 123' + LINE_FEED
    escposCommands += 'Telp: (021) 1234-5678' + LINE_FEED
    escposCommands += 'Email: info@tokoserbaguna.com' + LINE_FEED + LINE_FEED
    escposCommands += FONT_BOLD_OFF
    
    // Switch to left alignment for transaction details
    escposCommands += ALIGN_LEFT
    
    // Add transaction details - with line wrapping consideration for 48mm width
    const lines = textContent.split('\n')
    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine) {
        // For Kassen BTP299 with 48mm print width, we need to limit line length
        // Assuming standard font can fit about 32 characters per line
        const MAX_CHARS_PER_LINE = 32
        
        if (trimmedLine.length <= MAX_CHARS_PER_LINE) {
          escposCommands += trimmedLine + LINE_FEED
        } else {
          // Simple word wrapping for longer lines
          let remainingText = trimmedLine
          while (remainingText.length > 0) {
            const chunk = remainingText.substring(0, MAX_CHARS_PER_LINE)
            escposCommands += chunk + LINE_FEED
            remainingText = remainingText.substring(MAX_CHARS_PER_LINE)
          }
        }
      }
    }
    
    // Add footer
    escposCommands += LINE_FEED
    escposCommands += ALIGN_CENTER
    escposCommands += 'Terima kasih atas kunjungan Anda!' + LINE_FEED
    escposCommands += 'Barang yang sudah dibeli tidak dapat dikembalikan' + LINE_FEED
    escposCommands += LINE_FEED
    escposCommands += 'Dicetak pada: ' + new Date().toLocaleString('id-ID') + LINE_FEED
    
    // Feed a few lines before cutting to ensure the footer is visible
    escposCommands += LINE_FEED + LINE_FEED
    
    // Cut paper - Kassen BTP299 supports paper cutting
    escposCommands += CUT
    
    console.log('Konversi HTML ke ESC/POS selesai')
    return escposCommands
  }

  // Send ESC/POS commands to the printer via Bluetooth
  const sendToPrinter = async (data: string) => {
    if (!isConnected || !bluetoothCharacteristic) {
      const errorMsg = `Printer ${printerName || 'thermal'} tidak terhubung`
      console.error(errorMsg)
      setErrorMessage(errorMsg)
      if (onPrintError) onPrintError(errorMsg)
      return
    }

    console.log(`Mengirim data ke printer ${printerName} melalui Bluetooth...`)

    try {
      setIsLoading(true)
      
      // Convert string to Uint8Array
      const encoder = new TextEncoder()
      const dataArray = encoder.encode(data)
      console.log(`Data siap dikirim: ${dataArray.length} bytes`)

      const MAX_RETRIES = 5 // Increased max retries
      
      // For Bluetooth, we need to send data in smaller chunks
      // Use smaller chunk size for Android for better compatibility
      const BT_CHUNK_SIZE = isAndroid ? 128 : 256 // Smaller chunk size for Android
      let offset = 0
      
      while (offset < dataArray.length) {
        const chunk = dataArray.slice(offset, offset + BT_CHUNK_SIZE)
        console.log(`Mengirim paket Bluetooth ${Math.floor(offset / BT_CHUNK_SIZE) + 1}: ${chunk.length} bytes`)
        
        let retries = 0
        let success = false
        
        while (retries < MAX_RETRIES && !success) {
          try {
            // Send data via Bluetooth characteristic
            // Menggunakan writeValue yang didukung secara universal
            // Catatan: Beberapa printer bekerja lebih baik dengan writeWithoutResponse,
            // tapi kita hanya bisa menggunakan writeValue yang tersedia di API standar
            
            // Pada Android, kita perlu menangani pengiriman data dengan lebih hati-hati
            if (isAndroid) {
              console.log('Mengirim data pada perangkat Android...')
              
              // Pada Android, gunakan writeWithoutResponse jika tersedia
              // Ini sering kali lebih andal untuk printer thermal pada Android
              if (bluetoothCharacteristic.properties.writeWithoutResponse) {
                console.log('Menggunakan writeWithoutResponse pada Android')
                try {
                  // @ts-ignore - writeWithoutResponse mungkin tidak ada di semua implementasi
                  if (typeof bluetoothCharacteristic.writeWithoutResponse === 'function') {
                    // @ts-ignore
                    await bluetoothCharacteristic.writeWithoutResponse(chunk)
                    console.log('Data berhasil dikirim dengan writeWithoutResponse')
                  } else {
                    console.log('writeWithoutResponse tidak tersedia, menggunakan writeValue')
                    await bluetoothCharacteristic.writeValue(chunk)
                  }
                } catch (writeError) {
                  console.error('Error dengan writeWithoutResponse, mencoba writeValue:', writeError)
                  // Tambahkan timeout yang lebih panjang untuk Android
                  const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Timeout mengirim data ke printer')), 10000) // Timeout lebih panjang (10 detik)
                  })
                  
                  // Race antara pengiriman data dan timeout
                  await Promise.race([
                    bluetoothCharacteristic.writeValue(chunk),
                    timeoutPromise
                  ])
                  console.log('Data berhasil dikirim dengan writeValue (fallback)')
                }
              } else {
                console.log('Karakteristik tidak mendukung writeWithoutResponse, menggunakan writeValue standar')
                
                // Tambahkan timeout yang lebih panjang untuk Android
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Timeout mengirim data ke printer')), 10000) // Timeout lebih panjang (10 detik)
                })
                
                // Race antara pengiriman data dan timeout
                await Promise.race([
                  bluetoothCharacteristic.writeValue(chunk),
                  timeoutPromise
                ])
              }
            } else {
              // Untuk platform lain, gunakan metode standar
              if (bluetoothCharacteristic.properties.writeWithoutResponse) {
                console.log('Karakteristik mendukung writeWithoutResponse, tapi menggunakan writeValue standar')
              }
              
              // Menggunakan metode writeValue standar
              await bluetoothCharacteristic.writeValue(chunk)
            }
            
            success = true
            console.log(`Paket Bluetooth ${Math.floor(offset / BT_CHUNK_SIZE) + 1} berhasil dikirim`)
          } catch (error: unknown) {
            retries++
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            console.error(`Gagal mengirim paket Bluetooth ${Math.floor(offset / BT_CHUNK_SIZE) + 1} (percobaan ${retries}/${MAX_RETRIES}):`, errorMessage)
            
            // Increase wait time with each retry
            const waitTime = 1000 * retries
            console.log(`Menunggu ${waitTime}ms sebelum mencoba lagi...`)
            
            if (retries >= MAX_RETRIES) throw error
            
            // Wait before retrying with increasing delay
            await new Promise(resolve => setTimeout(resolve, waitTime))
          }
        }
        
        offset += BT_CHUNK_SIZE
        
        // Increased delay between chunks to allow printer to process
        // Use longer delay for Android devices
        if (offset < dataArray.length) {
          // Gunakan delay yang jauh lebih panjang untuk Android
          // Printer thermal pada Android sering membutuhkan waktu lebih lama untuk memproses data
          const chunkDelay = isAndroid ? 1200 : 500 // Delay lebih panjang untuk Android
          console.log(`Menunggu ${chunkDelay}ms sebelum mengirim paket berikutnya...`)
          await new Promise(resolve => setTimeout(resolve, chunkDelay))
          
          // Pada Android, tambahkan pengecekan status koneksi setelah setiap chunk
          if (isAndroid && bluetoothDevice && offset + BT_CHUNK_SIZE < dataArray.length) {
            // Periksa apakah perangkat masih terhubung
            // Karena kita tidak bisa langsung mengakses status koneksi, kita coba hubungkan kembali jika diperlukan
            try {
              // Coba hubungkan kembali jika gatt tersedia
              if (bluetoothDevice.gatt) {
                console.log('Memverifikasi koneksi Bluetooth...')
                try {
                  const gattServer = await bluetoothDevice.gatt.connect()
                  console.log('Koneksi dipertahankan atau berhasil menghubungkan kembali')
                  
                  // Verifikasi bahwa karakteristik masih valid
                  if (!bluetoothCharacteristic) {
                    console.log('Karakteristik hilang, mencoba mendapatkan kembali...')
                    // Coba dapatkan kembali karakteristik jika hilang
                    // Ini adalah implementasi sederhana, dalam kasus nyata mungkin perlu logika yang lebih kompleks
                    throw new Error('Karakteristik Bluetooth hilang, perlu menghubungkan ulang')
                  }
                } catch (verifyError) {
                  console.error('Error saat memverifikasi koneksi:', verifyError)
                  
                  // Jika terjadi error, coba hubungkan ulang sepenuhnya
                  console.log('Mencoba menghubungkan ulang sepenuhnya...')
                  await connectBluetoothPrinter()
                  
                  // Jika sampai di sini berarti koneksi berhasil, lanjutkan pengiriman
                  console.log('Berhasil menghubungkan ulang, melanjutkan pengiriman data')
                }
              }
            } catch (reconnectError) {
              console.error('Gagal menghubungkan kembali:', reconnectError)
              throw new Error('Koneksi Bluetooth terputus saat mengirim data dan tidak dapat menghubungkan ulang')
            }
          }
        }
      }
      
      console.log(`Semua paket data berhasil dikirim ke printer ${printerName} melalui Bluetooth`)
      
      setIsConnected(true)
      setErrorMessage('')
      setIsLoading(false)
      console.log('Pencetakan selesai')
      if (onPrintSuccess) onPrintSuccess()
      return true
    } catch (error: unknown) {
      let errorMsg = `Gagal mengirim data ke printer ${printerName || 'thermal'}`
      
      if (error instanceof Error) {
        // Analisis error untuk memberikan pesan yang lebih spesifik
        const errorLower = error.message.toLowerCase()
        
        if (isAndroid) {
          if (errorLower.includes('gatt') && errorLower.includes('error')) {
            errorMsg = 'GATT Error: Koneksi Bluetooth terputus. Pastikan printer tetap menyala selama pencetakan dan coba lagi.'
          } else if (errorLower.includes('not paired') || errorLower.includes('pairing')) {
            errorMsg = 'Printer tidak dipasangkan: Buka pengaturan Bluetooth Android, pasangkan printer terlebih dahulu, lalu coba lagi.'
          } else if (errorLower.includes('timeout')) {
            errorMsg = 'Timeout: Printer tidak merespon. Pastikan printer menyala, dalam jangkauan, dan baterai mencukupi.'
          } else if (errorLower.includes('disconnected') || errorLower.includes('closed')) {
            errorMsg = 'Koneksi terputus: Printer mungkin mati atau di luar jangkauan. Pastikan printer tetap menyala selama pencetakan.'
          } else if (errorLower.includes('karakteristik') || errorLower.includes('characteristic')) {
            errorMsg = 'Karakteristik Bluetooth hilang: Coba matikan dan nyalakan printer, lalu hubungkan kembali.'
          } else {
            errorMsg += `: ${error.message}`
          }
        } else {
          errorMsg += `: ${error.message}`
        }
        
        console.error(errorMsg, error)
      } else {
        console.error(errorMsg, error)
      }
      
      setErrorMessage(errorMsg)
      if (onPrintError) onPrintError(errorMsg)
      setIsLoading(false)
      
      // Try to reconnect if the error is related to connection
      if (error instanceof Error) {
        const errorLower = error.message.toLowerCase()
        if (errorLower.includes('disconnected') || 
            errorLower.includes('closed') || 
            errorLower.includes('timeout') ||
            errorLower.includes('gatt') ||
            errorLower.includes('karakteristik') ||
            errorLower.includes('characteristic')) {
          console.log('Mencoba menghubungkan kembali printer...')
          setIsConnected(false)
          setBluetoothDevice(null)
          setBluetoothCharacteristic(null)
          setPrinterName('')
          
          // Attempt to reconnect after a delay
          setTimeout(() => {
            connectPrinter()
          }, 2000)
        }
      }
      return false
    }
  }

  // Print receipt
  const printReceipt = async () => {
    console.log('Memulai proses cetak struk...')
    
    if (!isConnected) {
      console.log('Printer belum terhubung, mencoba menghubungkan...')
      try {
        await connectPrinter()
        // If connection successful but we return here, we won't print
        // So we only return if not connected after the attempt
        if (!isConnected) return
      } catch (err) {
        console.error('Gagal menghubungkan printer:', err)
        return
      }
    }
    
    console.log('Printer terhubung, mempersiapkan data ESC/POS...')
    const escposCommands = convertHTMLToESCPOS(receiptHTML)
    console.log('Mengirim data ke printer...')
    await sendToPrinter(escposCommands)
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-sm text-gray-700">
        <p>
          <strong>Printer:</strong> {printerName || 'Thermal Printer'}
          {isConnected && (
            <span className="ml-2 text-green-600">
              (Bluetooth)
            </span>
          )}
          {isAndroid && (
            <span className="ml-2 text-blue-600">
              (Android)
            </span>
          )}
        </p>
        {isAndroid && (
          <div className="mt-1 text-xs">
            <p className="text-blue-600">
              <strong>Perangkat Android terdeteksi.</strong> Pastikan Anda:
            </p>
            <ol className="list-decimal pl-5 mt-1 text-blue-600">
              <li>Menggunakan Chrome versi terbaru</li>
              <li>Telah mengaktifkan Bluetooth</li>
              <li><strong>Sudah memasangkan (pair) printer di pengaturan Bluetooth Android</strong></li>
              <li>Memberikan izin Lokasi saat diminta (diperlukan untuk pemindaian Bluetooth)</li>
            </ol>
          </div>
        )}
      </div>
      
      {/* Print button */}
      <button
        onClick={printReceipt}
        disabled={isLoading || !isWebBluetoothSupported}
        className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center w-full ${isConnected ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-500 hover:bg-blue-600'} text-white ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Memproses...
          </>
        ) : (
          <>
            <PrinterIcon className="h-5 w-5 mr-2" />
            Cetak Struk
          </>
        )}
      </button>

      {errorMessage && (
        <div className="mt-2 text-red-600 text-sm">
          <p>{errorMessage}</p>
          <p className="mt-1">Pastikan printer thermal sudah dinyalakan dan dalam jangkauan koneksi Bluetooth.</p>
          {isAndroid && (
            <div className="mt-1">
              <p><strong>Untuk pengguna Android:</strong></p>
              <ol className="list-decimal pl-5 mt-1">
                <li><strong>Pastikan printer sudah dipasangkan (paired) di pengaturan Bluetooth Android</strong> sebelum mencoba menghubungkan di aplikasi.</li>
                <li>Berikan izin Bluetooth dan Lokasi saat diminta. Android memerlukan izin lokasi untuk pemindaian Bluetooth.</li>
                <li>Jika masih gagal, coba matikan dan nyalakan kembali printer dan Bluetooth di perangkat Android.</li>
                <li>Pada beberapa perangkat, Anda mungkin perlu membuka pengaturan Bluetooth dan memilih printer secara manual terlebih dahulu.</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {isConnected && !errorMessage && (
        <div className="mt-2 text-sm text-green-600">
          <p>{printerName ? `Printer ${printerName}` : 'Printer thermal'} terhubung dan siap digunakan</p>
          <p className="mt-1">Pastikan kertas termal sudah terpasang dengan benar.</p>
        </div>
      )}
    </div>
  )
}