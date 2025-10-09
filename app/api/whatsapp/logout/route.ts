import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import WhatsAppManager from '@/lib/whatsapp'

// POST - Logout WhatsApp (disconnect and remove session files)
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
    await whatsappManager.logout()

    return NextResponse.json({
      success: true,
      message: 'WhatsApp logout successful - session files removed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error logging out WhatsApp:', error)
    return NextResponse.json(
      { error: 'Failed to logout WhatsApp' },
      { status: 500 }
    )
  }
}