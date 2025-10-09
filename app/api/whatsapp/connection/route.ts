import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import WhatsAppManager from '@/lib/whatsapp'

// GET - Check connection status and get QR code
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only admin can manage WhatsApp connection
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const whatsappManager = WhatsAppManager.getInstance()
    const status = whatsappManager.getConnectionStatus()

    return NextResponse.json({
      isConnected: status.isConnected,
      qrCode: status.qrCode,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error getting WhatsApp connection status:', error)
    return NextResponse.json(
      { error: 'Failed to get connection status' },
      { status: 500 }
    )
  }
}

// POST - Initialize WhatsApp connection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only admin can manage WhatsApp connection
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const whatsappManager = WhatsAppManager.getInstance()
    
    // Initialize WhatsApp connection
    await whatsappManager.initialize()

    // Get initial status
    const status = whatsappManager.getConnectionStatus()

    return NextResponse.json({
      success: true,
      message: 'WhatsApp connection initialized',
      isConnected: status.isConnected,
      qrCode: status.qrCode,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error initializing WhatsApp connection:', error)
    return NextResponse.json(
      { error: 'Failed to initialize WhatsApp connection' },
      { status: 500 }
    )
  }
}

// DELETE - Disconnect WhatsApp
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only admin can manage WhatsApp connection
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const whatsappManager = WhatsAppManager.getInstance()
    await whatsappManager.disconnect()

    return NextResponse.json({
      success: true,
      message: 'WhatsApp disconnected successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect WhatsApp' },
      { status: 500 }
    )
  }
}