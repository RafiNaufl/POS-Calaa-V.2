import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'
import { Op } from 'sequelize'

interface CartItem {
  productId: string
  quantity: number
  price: number
  categoryId: string
  name?: string
}

// Define the Voucher type
interface Voucher {
  id: string
  code: string
  name: string
  type: string
  value: number
  minPurchase?: number | null
  maxDiscount?: number | null
  maxUses?: number | null
  usedCount: number
  startDate: Date
  endDate: Date
  isActive: boolean
  usages?: any[]
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, subtotal, userId, memberId, cartItems } = body

    if (!code || subtotal === undefined) {
      return NextResponse.json(
        { error: 'Voucher code and subtotal are required' },
        { status: 400 }
      )
    }

    // Find voucher by code (case insensitive, SQLite-compatible)
    const voucher = await db.Voucher.findOne({
      where: (db as any).sequelize.where(
        (db as any).sequelize.fn('LOWER', (db as any).sequelize.col('code')),
        (code as string).toLowerCase()
      ),
      attributes: [
        'id',
        'code',
        'name',
        'type',
        'value',
        'minPurchase',
        'maxDiscount',
        'maxUses',
        'usedCount',
        'startDate',
        'endDate',
        'isActive'
      ],
      include: [
        {
          model: (db as any).VoucherUsage,
          as: 'usages',
          where: {
            [Op.or]: [
              { userId: userId || null },
              { memberId: memberId || null }
            ].filter(condition => Object.values(condition).some(value => value !== null))
          },
          required: false
        }
      ]
    } as any)
    
    // Ensure we have the voucher
    if (!voucher) {
      return NextResponse.json(
        { error: 'Voucher not found', valid: false },
        { status: 404 }
      )
    }

    // Check if voucher is active
    if (!(voucher as any).isActive) {
      return NextResponse.json(
        { error: 'Voucher is not active', valid: false },
        { status: 400 }
      )
    }

    // Check if voucher is within valid date range
    const now = new Date()
    if (now < (voucher as any).startDate || now > (voucher as any).endDate) {
      return NextResponse.json(
        { error: 'Voucher is expired or not yet valid', valid: false },
        { status: 400 }
      )
    }

    // Check minimum purchase requirement
    if ((voucher as any).minPurchase && subtotal < (voucher as any).minPurchase) {
      return NextResponse.json(
        {
          error: `Minimum purchase of ${(voucher as any).minPurchase} required`,
          valid: false,
          minPurchase: (voucher as any).minPurchase
        },
        { status: 400 }
      )
    }

    // Check total usage limit
    if ((voucher as any).maxUses && (voucher as any).usedCount >= (voucher as any).maxUses) {
      return NextResponse.json(
        { error: 'Voucher usage limit exceeded', valid: false },
        { status: 400 }
      )
    }

    // Check per-user usage limit (only for members, not for guest transactions)
    if ((voucher as any).usages && (userId || memberId)) {
      const userUsageCount = (voucher as any).usages.length
      if (userUsageCount >= 1) { // Simplified check for now
        return NextResponse.json(
          { error: `Personal usage limit exceeded`, valid: false },
          { status: 400 }
        )
      }
    }

    // Calculate discount amount
    let discountAmount = 0
    if ((voucher as any).type === 'PERCENTAGE') {
      discountAmount = (subtotal * (voucher as any).value) / 100
      if ((voucher as any).maxDiscount && discountAmount > (voucher as any).maxDiscount) {
        discountAmount = (voucher as any).maxDiscount
      }
    } else if ((voucher as any).type === 'FIXED_AMOUNT') {
      discountAmount = Math.min((voucher as any).value, subtotal)
    } else if ((voucher as any).type === 'FREE_SHIPPING') {
      // For POS system, this might be a fixed shipping cost
      discountAmount = (voucher as any).value
    }

    return NextResponse.json({
      valid: true,
      voucher: {
        id: (voucher as any).id,
        code: (voucher as any).code,
        name: (voucher as any).name,
        type: (voucher as any).type,
        value: (voucher as any).value,
        maxDiscount: (voucher as any).maxDiscount
      },
      discountAmount: Math.round(discountAmount * 100) / 100
    })
  } catch (error) {
    console.error('Error validating voucher:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}