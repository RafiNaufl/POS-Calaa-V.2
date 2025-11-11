import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or manager to see all details
    const isAdminOrManager = session.user.role === 'ADMIN' || session.user.role === 'MANAGER'
    
    const voucher = await db.Voucher.findByPk(params.id, {
      attributes: [
        'id', 'code', 'name', 'description', 'type', 'value',
        'minPurchase', 'maxDiscount', 'maxUses', 'usedCount',
        'startDate', 'endDate', 'isActive',
        'createdAt', 'updatedAt'
      ],
      ...(isAdminOrManager && {
        include: [{
          model: (db as any).VoucherUsage,
          as: 'usages',
          include: [
            { model: (db as any).Transaction, as: 'transaction' },
            { model: (db as any).User, as: 'user' },
            { model: (db as any).Member, as: 'member' }
          ]
        }]
      })
    } as any)

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }

    return NextResponse.json(voucher)
  } catch (error) {
    console.error('Error fetching voucher:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      usageLimit,
      perUserLimit,
      startDate,
      endDate,
      isActive
    } = body

    // Check if voucher exists
    const existingVoucher = await db.Voucher.findByPk(params.id, {
      attributes: ['id', 'code', 'isActive']
    })

    if (!existingVoucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }

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

    // Check if voucher code already exists (excluding current voucher)
    if (code !== (existingVoucher as any).code) {
      const duplicateVoucher = await db.Voucher.findOne({
        where: { code }
      })

      if (duplicateVoucher) {
        return NextResponse.json(
          { error: 'Voucher code already exists' },
          { status: 400 }
        )
      }
    }

    // Whitelist only known voucher columns for update
    const updateData: any = {
      code,
      name,
      description,
      type,
      value,
      minPurchase: minPurchase ? Number(minPurchase) : null,
      maxDiscount: maxDiscount ? Number(maxDiscount) : null,
      maxUses: body.maxUses ? Number(body.maxUses) : null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive: isActive !== undefined ? isActive : (existingVoucher as any).isActive
    }

    await db.Voucher.update(updateData, {
      where: { id: params.id }
    })

    const updatedVoucher = await db.Voucher.findByPk(params.id, {
      attributes: [
        'id', 'code', 'name', 'description', 'type', 'value',
        'minPurchase', 'maxDiscount', 'maxUses', 'usedCount',
        'startDate', 'endDate', 'isActive',
        'createdAt', 'updatedAt'
      ]
    })

    return NextResponse.json(updatedVoucher)
  } catch (error) {
    console.error('Error updating voucher:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if voucher exists
    const existingVoucher = await db.Voucher.findByPk(params.id, {
      attributes: ['id', 'code', 'name'],
      include: [{
        model: (db as any).VoucherUsage,
        as: 'usages'
      }]
     } as any)

    if ((existingVoucher as any).usages && (existingVoucher as any).usages.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete voucher "${(existingVoucher as any).name}" (${(existingVoucher as any).code}) because it has been used in transactions` },
        { status: 400 }
      )
    }

    await db.Voucher.destroy({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Voucher deleted successfully' })
  } catch (error) {
    console.error('Error deleting voucher:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}