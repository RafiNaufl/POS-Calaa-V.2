import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import WhatsAppManager from '@/lib/whatsapp'
import ReceiptFormatter from '@/lib/receiptFormatter'
const db = require('@/models')

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
    const user = await db.User.findByPk(session.user.id, {
      attributes: ['id', 'role']
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
    const transaction = await db.Transaction.findByPk(transactionId, {
      include: [{
        model: db.TransactionItem,
        as: 'items',
        include: [{
          model: db.Product,
          as: 'product'
        }]
      }]
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
    const updatedTransaction = await db.Transaction.update({
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      paidAt: new Date()
    }, {
      where: { id: transactionId },
      returning: true
    })
    
    // Update product stock
    for (const item of transaction.items) {
      if (item.product) {
        await db.Product.update({
          stock: db.sequelize.literal(`stock - ${item.quantity}`)
        }, {
          where: { id: item.product.id }
        })
      }
    }
    
    // Send WhatsApp receipt automatically when bank transfer confirmed
    try {
      if (transaction.customerPhone) {
        const fullTransaction = await db.Transaction.findByPk(transactionId, {
          include: [
            {
              model: db.TransactionItem,
              as: 'items',
              include: [{ model: db.Product, as: 'product' }]
            },
            { model: db.Member, as: 'member' },
            { model: db.User, as: 'user' }
          ]
        })
        if (fullTransaction) {
          const receiptData = {
            id: fullTransaction.id,
            createdAt: fullTransaction.createdAt,
            items: fullTransaction.items.map((item: any) => ({
              id: item.id,
              name: item.product?.name || 'Unknown Product',
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              productCode: item.product?.code || undefined,
              size: item.product?.size || undefined,
              color: item.product?.color || undefined
            })),
            subtotal: fullTransaction.subtotal,
            tax: fullTransaction.tax,
            finalTotal: fullTransaction.finalTotal,
            paymentMethod: fullTransaction.paymentMethod,
            status: fullTransaction.status,
            cashier: undefined,
            customer: fullTransaction.customerName || undefined,
            customerPhone: fullTransaction.customerPhone || undefined,
            customerEmail: fullTransaction.customerEmail || undefined,
            pointsUsed: fullTransaction.pointsUsed,
            pointsEarned: fullTransaction.pointsEarned,
            voucherCode: undefined,
            voucherDiscount: fullTransaction.voucherDiscount,
            promotionDiscount: fullTransaction.promoDiscount,
            member: fullTransaction.member ? {
              name: fullTransaction.member.name,
              phone: fullTransaction.member.phone || '',
              email: fullTransaction.member.email || undefined
            } : undefined,
            user: fullTransaction.user ? { name: fullTransaction.user.name } : undefined
          }
          const phoneValidation = ReceiptFormatter.validatePhoneNumber(fullTransaction.customerPhone || '')
          const receiptMessage = ReceiptFormatter.formatReceiptForWhatsApp(receiptData)
          if (phoneValidation.isValid) {
            const wa = WhatsAppManager.getInstance()
            if (!wa.isConnected()) {
              await wa.initialize()
              await new Promise(res => setTimeout(res, 2000))
            }
            const result = await wa.sendMessage(phoneValidation.formatted || fullTransaction.customerPhone, receiptMessage)
            if (result.success) {
              console.log(`[BankTransfer] WhatsApp receipt sent for transaction ${transactionId}`)
            } else {
              console.warn(`[BankTransfer] Failed to send WhatsApp receipt for transaction ${transactionId}: ${result.error}`)
            }
          } else {
            console.warn(`[BankTransfer] Invalid phone number for WhatsApp receipt: ${fullTransaction.customerPhone}`)
          }
        }
      }
    } catch (waErr) {
      console.warn(`[BankTransfer] WhatsApp receipt sending error for transaction ${transactionId}:`, waErr)
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