import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          include: {
            product: true
          }
        },
        voucherUsages: {
          include: {
            voucher: true
          }
        }
      }
    })

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
    const result = await prisma.$transaction(async (tx) => {
      // Update transaction status to REFUNDED
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'REFUNDED',
          updatedAt: new Date()
        }
      })

      // Restore product stock
      for (const item of transaction.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity
            }
          }
        })
      }

      // Restore voucher usage if any
      if (transaction.voucherUsages.length > 0) {
        for (const voucherUsage of transaction.voucherUsages) {
          // Delete the voucher usage record
          await tx.voucherUsage.delete({
            where: { id: voucherUsage.id }
          })

          // Increment voucher usage count back
          await tx.voucher.update({
            where: { id: voucherUsage.voucherId },
            data: {
              usageCount: {
                decrement: 1
              }
            }
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