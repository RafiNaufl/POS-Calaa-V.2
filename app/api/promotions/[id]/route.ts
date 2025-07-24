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

    const promotion = await prisma.promotion.findUnique({
      where: { id: params.id },
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

    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    return NextResponse.json(promotion)
  } catch (error) {
    console.error('Error fetching promotion:', error)
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
      isActive,
      productIds,
      categoryIds
    } = body

    // Check if promotion exists
    const existingPromotion = await prisma.promotion.findUnique({
      where: { id: params.id },
      include: {
        productPromotions: true,
        categoryPromotions: true
      }
    })

    if (!existingPromotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

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

    // Validate percentage value
    if (discountType === 'PERCENTAGE' && (discountValue < 0 || discountValue > 100)) {
      return NextResponse.json(
        { error: 'Percentage value must be between 0 and 100' },
        { status: 400 }
      )
    }

    // Validate type-specific fields
    if (type === 'BULK_DISCOUNT' && !minQuantity) {
      return NextResponse.json(
        { error: 'Minimum quantity is required for bulk discount' },
        { status: 400 }
      )
    }

    if (type === 'BUY_X_GET_Y' && (!buyQuantity || !getQuantity)) {
      return NextResponse.json(
        { error: 'Buy quantity and get quantity are required for Buy X Get Y promotion' },
        { status: 400 }
      )
    }

    // Update promotion using transaction
    const updatedPromotion = await prisma.$transaction(async (tx) => {
      // Delete existing product and category associations
      await tx.productPromotion.deleteMany({
        where: { promotionId: params.id }
      })
      
      await tx.categoryPromotion.deleteMany({
        where: { promotionId: params.id }
      })

      // Update promotion
      const promotion = await tx.promotion.update({
        where: { id: params.id },
        data: {
          name: body.name,
          description: body.description,
          type: body.type,
          discountValue: body.discountValue,
          discountType: body.discountType,
          minQuantity: body.minQuantity,
          buyQuantity: body.buyQuantity,
          getQuantity: body.getQuantity,
          startDate: body.startDate,
          endDate: body.endDate,
          isActive: body.isActive
        }
      })

      // Create new product associations
      if (productIds && productIds.length > 0) {
        await tx.productPromotion.createMany({
          data: productIds.map((productId: string) => ({
            promotionId: params.id,
            productId
          }))
        })
      }

      // Create new category associations
      if (categoryIds && categoryIds.length > 0) {
        await tx.categoryPromotion.createMany({
          data: categoryIds.map((categoryId: string) => ({
            promotionId: params.id,
            categoryId
          }))
        })
      }

      return promotion
    })

    // Fetch updated promotion with associations
    const promotionWithAssociations = await prisma.promotion.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(promotionWithAssociations)
  } catch (error) {
    console.error('Error updating promotion:', error)
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

    // Check if promotion exists
    const existingPromotion = await prisma.promotion.findUnique({
      where: { id: params.id },
      include: {
        productPromotions: true,
        categoryPromotions: true
      }
    })

    if (!existingPromotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // Delete promotion and its associations using transaction
    await prisma.$transaction(async (tx) => {
      // Delete product associations
      await tx.productPromotion.deleteMany({
        where: { promotionId: params.id }
      })
      
      // Delete category associations
      await tx.categoryPromotion.deleteMany({
        where: { promotionId: params.id }
      })

      // Delete promotion
      await tx.promotion.delete({
        where: { id: params.id }
      })
    })

    return NextResponse.json({ message: 'Promotion deleted successfully' })
  } catch (error) {
    console.error('Error deleting promotion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}