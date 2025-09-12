import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verify user session
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Sesi pengguna tidak valid. Silakan login ulang.' },
        { status: 401 }
      )
    }
    
    // Verify that the user exists and has admin role
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Pengguna tidak ditemukan.' },
        { status: 401 }
      )
    }
    
    // Only admin can confirm bank transfer payments
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Hanya admin yang dapat mengkonfirmasi pembayaran.' },
        { status: 403 }
      )
    }

    // Get transaction ID from request body
    const body = await request.json()
    const { transactionId } = body
    
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'ID transaksi diperlukan.' },
        { status: 400 }
      )
    }
    
    // Find the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    })
    
    if (!transaction) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Transaksi tidak ditemukan.' },
        { status: 404 }
      )
    }
    
    // Verify transaction is a bank transfer and is pending
    if (transaction.paymentMethod !== 'BANK_TRANSFER') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Transaksi ini bukan pembayaran transfer bank.' },
        { status: 400 }
      )
    }
    
    if (transaction.status !== 'PENDING' || transaction.paymentStatus !== 'PENDING') {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Transaksi ini tidak dalam status pending.' },
        { status: 400 }
      )
    }
    
    // Update transaction status
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paidAt: new Date()
      }
    })
    
    // Update product stock
    for (const item of transaction.items) {
      if (item.product) {
        await prisma.product.update({
          where: { id: item.product.id },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Pembayaran berhasil dikonfirmasi',
      transaction: updatedTransaction
    })
    
  } catch (error: any) {
    console.error('Error confirming bank transfer payment:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: error.message || 'Terjadi kesalahan saat mengkonfirmasi pembayaran.'
      },
      { status: 500 }
    )
  }
}