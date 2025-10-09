import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        },
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            points: true
          }
        },
        voucherUsages: {
          include: {
            voucher: {
              select: {
                code: true,
                name: true
              }
            }
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

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id } = params
    const body = await request.json()
    const { status, paymentStatus } = body

    // Verify transaction exists
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id }
    })

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(status === 'COMPLETED' && { paidAt: new Date() })
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        },
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            points: true
          }
        }
      }
    })
    
    // WhatsApp receipt sending is now handled manually through the transaction history page
    // Automatic sending has been disabled to allow manual control
    if (status === 'COMPLETED') {
      console.log(`[TransactionUpdate] Transaction ${id} updated to COMPLETED. WhatsApp receipt can be sent manually from transaction history.`);
    }

    return NextResponse.json(updatedTransaction)
  } catch (error) {
    console.error('Error updating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to update transaction' },
      { status: 500 }
    )
  }
}