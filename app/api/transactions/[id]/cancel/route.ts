import { NextRequest, NextResponse } from 'next/server'
const db = require('@/models')
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const transactionId = params.id

    // Find the transaction
    const transaction = await db.Transaction.findByPk(transactionId, {
      include: [
        {
          model: db.TransactionItem,
          as: 'items',
          include: [{
            model: db.Product,
            as: 'product'
          }]
        },
        {
          model: db.VoucherUsage,
          as: 'voucherUsages',
          include: [{
            model: db.Voucher,
            as: 'voucher'
          }]
        }
      ]
    })

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Check if transaction can be cancelled
    if (transaction.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Transaction is already cancelled' },
        { status: 400 }
      )
    }

    if (transaction.status !== 'COMPLETED' && transaction.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Only completed or pending transactions can be cancelled' },
        { status: 400 }
      )
    }

    // Start transaction to ensure data consistency
    const result = await (db.sequelize as any).transaction(async (t: any) => {
      // Update transaction status to CANCELLED
      const updatedTransaction = await db.Transaction.update({
        status: 'CANCELLED',
        updatedAt: new Date()
      }, {
        where: { id: transactionId },
        returning: true,
        transaction: t
      })

      // Restore product stock only if transaction was completed
      if (transaction.status === 'COMPLETED') {
        for (const item of transaction.items) {
          await db.Product.update({
            stock: db.sequelize.literal(`stock + ${item.quantity}`)
          }, {
            where: { id: item.productId },
            transaction: t
          })
        }
      }

      // Restore voucher usage if any
      if (transaction.voucherUsages.length > 0) {
        for (const voucherUsage of transaction.voucherUsages) {
          // Delete the voucher usage record
          await db.VoucherUsage.destroy({
            where: { id: voucherUsage.id },
            transaction: t
          })

          // Increment voucher usage count back
          await db.Voucher.update({
            usageCount: db.sequelize.literal('usageCount - 1')
          }, {
            where: { id: voucherUsage.voucherId },
            transaction: t
          })
        }
      }

      return updatedTransaction
    })

    return NextResponse.json({
      message: 'Transaction cancelled successfully',
      transaction: result
    })

  } catch (error) {
    console.error('Error cancelling transaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}