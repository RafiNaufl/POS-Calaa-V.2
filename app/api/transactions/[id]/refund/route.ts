import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'
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
          model: (db as any).TransactionItem,
          as: 'items',
          include: [
            {
              model: (db as any).Product,
              as: 'product'
            }
          ]
        },
        {
          model: (db as any).VoucherUsage,
          as: 'voucherUsages',
          include: [
            {
              model: (db as any).Voucher,
              as: 'voucher'
            }
          ]
        }
      ]
    } as any)

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Check if transaction can be refunded
    if (transaction.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Only completed transactions can be refunded' },
        { status: 400 }
      )
    }

    // Start transaction to ensure data consistency
    const result = await (db.sequelize as any).transaction(async (t: any) => {
      // Update transaction status to REFUNDED
      const updatedTransaction = await (db as any).Transaction.update({
        status: 'REFUNDED',
        updatedAt: new Date()
      }, {
        where: { id: transactionId },
        transaction: t,
        returning: true
      })

      // Restore product stock
      for (const item of transaction.items) {
        await (db as any).Product.update({
          stock: db.sequelize.literal(`stock + ${item.quantity}`)
        }, {
          where: { id: item.productId },
          transaction: t
        })
      }

      // Restore voucher usage if any
      if (transaction.voucherUsages.length > 0) {
        for (const voucherUsage of transaction.voucherUsages) {
          // Delete the voucher usage record
          await (db as any).VoucherUsage.destroy({
            where: { id: voucherUsage.id },
            transaction: t
          })

          // Increment voucher usage count back
          await (db as any).Voucher.update({
            usageCount: db.sequelize.literal('usageCount - 1')
          }, {
            where: { id: voucherUsage.voucherId },
            transaction: t
          })
        }
      }

      // Note: We don't create a separate refund record to avoid duplication
      // The original transaction status is already changed to 'REFUNDED'
      // Stock restoration and voucher handling is already done above

      return { updatedTransaction }
    })

    return NextResponse.json({
      message: 'Transaction refunded successfully',
      transaction: result.updatedTransaction
    })

  } catch (error) {
    console.error('Error refunding transaction:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}