import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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

    let whereClause: any = {}
    
    if (code) {
      whereClause.code = {
        contains: code,
        mode: 'insensitive'
      }
    }
    
    if (name) {
      whereClause.name = {
        contains: name,
        mode: 'insensitive'
      }
    }
    
    if (active !== null) {
      whereClause.isActive = active === 'true'
    }

    // Check if user is admin or manager to see all details
    const isAdminOrManager = session.user.role === 'ADMIN' || session.user.role === 'MANAGER'

    const vouchers = await prisma.voucher.findMany({
      where: whereClause,
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

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
      usageLimit,
      perUserLimit,
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
    const existingVoucher = await prisma.voucher.findUnique({
      where: { code },
      select: {
        id: true,
        code: true
      }
    })

    if (existingVoucher) {
      return NextResponse.json(
        { error: 'Voucher code already exists' },
        { status: 400 }
      )
    }

    // Create voucher - ensure we only use fields that exist in the database
    const voucher = await prisma.voucher.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        type,
        value,
        minPurchase: minPurchase ? Number(minPurchase) : null,
        maxDiscount: maxDiscount ? Number(maxDiscount) : null,
        usageLimit: usageLimit ? Number(usageLimit) : null,
        perUserLimit: perUserLimit ? Number(perUserLimit) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
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

    return NextResponse.json(voucher, { status: 201 })
  } catch (error) {
    console.error('Error creating voucher:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}