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

    const { searchParams } = new URL(request.url)
    const active = searchParams.get('active')
    const type = searchParams.get('type')

    let whereClause: any = {}
    
    if (active !== null) {
      whereClause.isActive = active === 'true'
      
      // Also check if promotion is within valid date range
      if (active === 'true') {
        const now = new Date()
        whereClause.AND = [
          { startDate: { lte: now } },
          { endDate: { gte: now } }
        ]
      }
    }
    
    if (type) {
      whereClause.type = type
    }

    const promotions = await prisma.promotion.findMany({
      where: whereClause,
      include: {
        productPromotions: {
          include: {
            product: true
          }
        },
        categoryPromotions: {
          include: {
            category: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json(promotions)
  } catch (error) {
    console.error('Error fetching promotions:', error)
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
      name,
      description,
      type,
      discountValue,
      discountType,
      minQuantity,
      buyQuantity,
      getQuantity,
      startDate,
      endDate,
      productIds,
      categoryIds
    } = body

    // Validate required fields
    if (!name || !type || discountValue === undefined || !discountType || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate promotion type
    if (!['BUY_X_GET_Y', 'BULK_DISCOUNT', 'CATEGORY_DISCOUNT', 'PRODUCT_DISCOUNT'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid promotion type' },
        { status: 400 }
      )
    }

    // Validate discount type
    if (!['PERCENTAGE', 'FIXED'].includes(discountType)) {
      return NextResponse.json(
        { error: 'Invalid discount type' },
        { status: 400 }
      )
    }

    // Create promotion with related products and categories
    const promotion = await prisma.promotion.create({
      data: {
        name,
        description,
        type,
        discountValue,
        discountType,
        minQuantity,
        buyQuantity,
        getQuantity,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        productPromotions: productIds ? {
          create: productIds.map((productId: string) => ({
            productId
          }))
        } : undefined,
        categoryPromotions: categoryIds ? {
          create: categoryIds.map((categoryId: string) => ({
            categoryId
          }))
        } : undefined
      },
      include: {
        productPromotions: {
          include: {
            product: true
          }
        },
        categoryPromotions: {
          include: {
            category: true
          }
        }
      }
    })

    return NextResponse.json(promotion, { status: 201 })
  } catch (error) {
    console.error('Error creating promotion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}