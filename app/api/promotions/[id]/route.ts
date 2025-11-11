import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
const db = require('@/models')

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const promotion = await db.Promotion.findByPk(params.id, {
      include: [
        {
          model: db.ProductPromotion,
          as: 'productPromotions',
          include: [{
            model: db.Product,
            as: 'product'
          }]
        },
        {
          model: db.CategoryPromotion,
          as: 'categoryPromotions',
          include: [{
            model: db.Category,
            as: 'category'
          }]
        }
      ]
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
    const existingPromotion = await db.Promotion.findByPk(params.id, {
      include: [
        { model: db.ProductPromotion, as: 'productPromotions' },
        { model: db.CategoryPromotion, as: 'categoryPromotions' }
      ]
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
    const updatedPromotion = await (db.sequelize as any).transaction(async (t: any) => {
      // Delete existing product and category associations
      await db.ProductPromotion.destroy({
        where: { promotionId: params.id },
        transaction: t
      })
      
      await db.CategoryPromotion.destroy({
        where: { promotionId: params.id },
        transaction: t
      })

      // Update promotion
      const promotion = await db.Promotion.update({
        name: body.name,
        description: body.description,
        type: body.type,
        discountValue: body.discountValue,
        discountType: body.discountType,
        minQuantity: body.minQuantity,
        buyQuantity: body.buyQuantity,
        getQuantity: body.getQuantity,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : new Date(),
        isActive: body.isActive
      }, {
        where: { id: params.id },
        transaction: t,
        returning: true
      })

      // Create new product associations
      if (productIds && productIds.length > 0) {
        await db.ProductPromotion.bulkCreate(
          productIds.map((productId: string) => ({
            promotionId: params.id,
            productId
          })),
          { transaction: t }
        )
      }

      // Create new category associations
      if (categoryIds && categoryIds.length > 0) {
        await db.CategoryPromotion.bulkCreate(
          categoryIds.map((categoryId: string) => ({
            promotionId: params.id,
            categoryId
          })),
          { transaction: t }
        )
      }

      return promotion
    })

    // Fetch updated promotion with associations
    const promotionWithAssociations = await db.Promotion.findByPk(params.id, {
      include: [
        {
          model: db.ProductPromotion,
          as: 'productPromotions',
          include: [{
            model: db.Product,
            as: 'product'
          }]
        },
        {
          model: db.CategoryPromotion,
          as: 'categoryPromotions',
          include: [{
            model: db.Category,
            as: 'category'
          }]
        }
      ]
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
    const existingPromotion = await db.Promotion.findByPk(params.id, {
      include: [
        { model: db.ProductPromotion, as: 'productPromotions' },
        { model: db.CategoryPromotion, as: 'categoryPromotions' }
      ]
    })

    if (!existingPromotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 })
    }

    // Delete promotion and its associations using transaction
    await (db.sequelize as any).transaction(async (t: any) => {
      // Delete product associations
      await db.ProductPromotion.destroy({
        where: { promotionId: params.id },
        transaction: t
      })
      
      // Delete category associations
      await db.CategoryPromotion.destroy({
        where: { promotionId: params.id },
        transaction: t
      })

      // Delete promotion
      await db.Promotion.destroy({
        where: { id: params.id },
        transaction: t
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