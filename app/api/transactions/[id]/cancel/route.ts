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
    const result = await prisma.$transaction(async (tx) => {
      // Update transaction status to CANCELLED
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      })

      // Restore product stock only if transaction was completed
      if (transaction.status === 'COMPLETED') {
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