import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function POST(request: NextRequest) {
  try {
    // Hapus semua data transaksi
    await prisma.transactionItem.deleteMany({})
    await prisma.voucherUsage.deleteMany({})
    await prisma.pointHistory.deleteMany({})
    await prisma.transaction.deleteMany({})
    
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
  } finally {
    await prisma.$disconnect()
  }
}