import { NextRequest, NextResponse } from 'next/server'
const db = require('@/models')

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    
    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    const category = await db.Category.findByPk(id, {
      include: [{
        model: db.Product,
        as: 'products',
        attributes: []
      }],
      attributes: {
        include: [
          [db.sequelize.fn('COUNT', db.sequelize.col('products.id')), 'productCount']
        ]
      },
      group: ['Category.id'],
      subQuery: false
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error fetching category:', error)
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    )
  }
}