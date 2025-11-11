import { NextRequest, NextResponse } from 'next/server'
const db = require('@/models')
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    // Hapus semua data transaksi
    await db.TransactionItem.destroy({ where: {} })
    await db.VoucherUsage.destroy({ where: {} })
    await db.Transaction.destroy({ where: {} })
    
    // Revalidate dashboard path to clear cache
    revalidatePath('/dashboard')
    
    // Set cache control headers to prevent caching
    const response = NextResponse.json({
      success: true,
      message: 'Data transaksi berhasil direset'
    })
    
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    return response
  } catch (error) {
    console.error('Error resetting transaction data:', error)
    return NextResponse.json(
      { error: 'Gagal mereset data transaksi' },
      { status: 500 }
    )
  }
}