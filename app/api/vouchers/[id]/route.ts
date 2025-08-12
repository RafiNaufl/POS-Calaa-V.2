import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    
    const voucher = await prisma.voucher.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        type: true,
        value: true,
        minPurchase: true,
        maxDiscount: true,
        usageLimit: true,
        usageCount: true,
        perUserLimit: true,
        startDate: true,
        endDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Only include transactions data for admin/manager users
        ...(isAdminOrManager && {
          transactions: {
            include: {
              transaction: true,
              user: true,
              member: true
            }
          }
        })
      }
    })

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
    const existingVoucher = await prisma.voucher.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        code: true,
        isActive: true
      }
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
    if (code !== existingVoucher.code) {
      const duplicateVoucher = await prisma.voucher.findUnique({
        where: { code }
      })

      if (duplicateVoucher) {
        return NextResponse.json(
          { error: 'Voucher code already exists' },
          { status: 400 }
        )
      }
    }

    // Remove restrictedToProducts and restrictedToCategories from the data if they exist
    const { restrictedToProducts, restrictedToCategories, ...safeVoucherData } = body;
    
    const updatedVoucher = await prisma.voucher.update({
      where: { id: params.id },
      data: {
        ...safeVoucherData,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: isActive !== undefined ? isActive : existingVoucher.isActive
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        type: true,
        value: true,
        minPurchase: true,
        maxDiscount: true,
        usageLimit: true,
        usageCount: true,
        perUserLimit: true,
        startDate: true,
        endDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
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
    const existingVoucher = await prisma.voucher.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        code: true,
        name: true,
        transactions: true
      }
    })

    if (!existingVoucher) {
      return NextResponse.json({ error: 'Voucher not found' }, { status: 404 })
    }

    // Check if voucher has been used in transactions
    if (existingVoucher.transactions.length > 0) {
      return NextResponse.json(
        { error: `Cannot delete voucher "${existingVoucher.name}" (${existingVoucher.code}) because it has been used in transactions` },
        { status: 400 }
      )
    }

    await prisma.voucher.delete({
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