import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'
import { Op } from 'sequelize'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const active = searchParams.get('active')
    const name = searchParams.get('name')

    // Build where conditions compatible with SQLite (case-insensitive LIKE)
    const conditions: any[] = []

    if (code) {
      conditions.push(
        db.sequelize.where(
          db.sequelize.fn('lower', db.sequelize.col('code')),
          { [Op.like]: `%${code.toLowerCase()}%` }
        )
      )
    }

    if (name) {
      conditions.push(
        db.sequelize.where(
          db.sequelize.fn('lower', db.sequelize.col('name')),
          { [Op.like]: `%${name.toLowerCase()}%` }
        )
      )
    }

    if (active !== null) {
      conditions.push({ isActive: active === 'true' })
    }

    const whereClause = conditions.length > 0 ? { [Op.and]: conditions } : undefined

    // Check if user is admin or manager to see all details
    const isAdminOrManager = session.user.role === 'ADMIN' || session.user.role === 'MANAGER'

    const vouchers = await db.Voucher.findAll({
      where: whereClause,
      attributes: [
        'id', 'code', 'name', 'description', 'type', 'value',
        'minPurchase', 'maxDiscount', 'maxUses', 'usedCount',
        'startDate', 'endDate', 'isActive', 'createdAt', 'updatedAt'
      ],
      ...(isAdminOrManager && {
        include: [{
          model: (db as any).VoucherUsage,
          as: 'usages',
          include: [
            { model: (db as any).Transaction, as: 'transaction' },
            { model: (db as any).User, as: 'user' },
            { model: (db as any).Member, as: 'member' }
          ],
          required: false
        }]
      }),
      order: [['createdAt', 'DESC']]
    } as any)

    return NextResponse.json(vouchers)
  } catch (error) {
    console.error('Error fetching vouchers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      code,
      name,
      description,
      type,
      value,
      minPurchase,
      maxDiscount,
      maxUses,
      startDate,
      endDate
    } = body

    // Validate required fields
    if (!code || !name || !type || value === undefined || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate voucher type
    if (!['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid voucher type' },
        { status: 400 }
      )
    }

    // Validate percentage value
    if (type === 'PERCENTAGE' && (value < 0 || value > 100)) {
      return NextResponse.json(
        { error: 'Percentage value must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Check if voucher code already exists
    const existingVoucher = await db.Voucher.findOne({
      where: { code },
      attributes: ['id', 'code']
    })

    if (existingVoucher) {
      return NextResponse.json(
        { error: 'Voucher code already exists' },
        { status: 400 }
      )
    }

    // Create voucher - ensure we only use fields that exist in the database
    const voucher = await db.Voucher.create({
      code: code.toUpperCase(),
      name,
      description,
      type,
      value,
      minPurchase: minPurchase ? Number(minPurchase) : null,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      maxUses: maxUses ? Number(maxUses) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    })

    return NextResponse.json(voucher, { status: 201 })
  } catch (error) {
    console.error('Error creating voucher:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}