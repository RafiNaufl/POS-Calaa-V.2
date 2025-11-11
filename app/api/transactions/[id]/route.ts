import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'

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

    const transaction = await db.Transaction.findByPk(id, {
      include: [
        {
          model: db.TransactionItem,
          as: 'items',
          include: [
            {
              model: db.Product,
              as: 'product'
            }
          ]
        },
        {
          model: db.User,
          as: 'user',
          attributes: ['name', 'email']
        },
        {
          model: db.Member,
          as: 'member',
          attributes: ['id', 'name', 'phone', 'email', 'points']
        },
        {
          model: db.VoucherUsage,
          as: 'voucherUsages',
          include: [
            {
              model: db.Voucher,
              as: 'voucher',
              attributes: ['code', 'name']
            }
          ]
        }
      ]
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
    const existingTransaction = await db.Transaction.findByPk(id)

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    // Update transaction
    const updatedTransaction = await db.Transaction.findByPk(id, {
      include: [
        {
          model: db.TransactionItem,
          as: 'items',
          include: [
            {
              model: db.Product,
              as: 'product'
            }
          ]
        },
        {
          model: db.User,
          as: 'user',
          attributes: ['name', 'email']
        },
        {
          model: db.Member,
          as: 'member',
          attributes: ['id', 'name', 'phone', 'email', 'points']
        }
      ]
    })

    // Update the transaction
    await db.Transaction.update({
      ...(status && { status }),
      ...(paymentStatus && { paymentStatus }),
      ...(status === 'COMPLETED' && { paidAt: new Date() })
    }, {
      where: { id }
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