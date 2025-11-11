import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'
import { Op } from 'sequelize'

export async function GET(request: NextRequest) {
  try {
    console.log('API /api/promotions GET invoked')
    const session = await getServerSession(authOptions)
    console.log('API /api/promotions GET session', !!session)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const active = searchParams.get('active')
    const type = searchParams.get('type')

    let whereClause: any = {}
    
    if (active !== null) {
      whereClause.isActive = active === 'true'
      
      // Also check if promotion is within valid date range
      if (active === 'true') {
        const now = new Date()
        whereClause[Op.and] = [
          { startDate: { [Op.lte]: now } },
          { endDate: { [Op.gte]: now } }
        ]
      }
    }
    
    if (type) {
      whereClause.type = type
    }

    const promotions = await db.Promotion.findAll({
      where: whereClause,
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
      ],
      order: [
        ['createdAt', 'DESC']
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

    // Create promotion with related products and categories using transaction
    const result = await db.sequelize.transaction(async (t: any) => {
      // Create the promotion
      const promotion = await db.Promotion.create({
        name,
        description,
        type,
        discountValue,
        discountType,
        minQuantity,
        buyQuantity,
        getQuantity,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : new Date(),
      }, { transaction: t })
      const promotionId = (promotion as any).id

      // Create product promotions if provided
      if (productIds && productIds.length > 0) {
        const productPromotions = productIds.map((productId: string) => ({
          promotionId: promotionId,
          productId
        }))
        await db.ProductPromotion.bulkCreate(productPromotions, { transaction: t })
      }

      // Create category promotions if provided
      if (categoryIds && categoryIds.length > 0) {
        const categoryPromotions = categoryIds.map((categoryId: string) => ({
          promotionId: promotionId,
          categoryId
        }))
        await db.CategoryPromotion.bulkCreate(categoryPromotions, { transaction: t })
      }

      // Fetch the created promotion with associations
      const createdPromotion = await db.Promotion.findByPk(promotionId, {
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
        ],
        transaction: t
      })

      return createdPromotion
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating promotion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'