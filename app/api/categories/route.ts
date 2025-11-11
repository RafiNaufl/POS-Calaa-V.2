import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'

export async function GET() {
  try {
    console.log('API /api/categories GET invoked')
    const categories = await db.Category.findAll({
      include: [{ model: db.Product, as: 'products', attributes: [], required: false }],
      attributes: { include: [[db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('products.id'))), 'productCount']] },
      group: ['Category.id'],
      order: [['name', 'ASC']],
      subQuery: false
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
export async function POST(request: NextRequest) {
  
  try {
    const body = await request.json()
    const { name, description } = body

    const category = await db.Category.create({
      name,
      description
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error) {
      console.error('Error creating category:', error)
      return NextResponse.json(
        { error: 'Failed to create category' },
        { status: 500 }
      )
    }
  }

export async function PUT(request: NextRequest) {
  
  try {
    const body = await request.json()
    const { id, name, description } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    const [updatedRowsCount] = await db.Category.update(
      {
        name,
        description
      },
      {
        where: { id }
      }
    )

    if (updatedRowsCount === 0) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    const category = await db.Category.findByPk(id)
    return NextResponse.json(category)
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  
  try {
    // Check if ID is in URL params first
    const searchParams = request.nextUrl.searchParams
    let id = searchParams.get('id')

    // If not in URL params, try to get from request body
    if (!id) {
      try {
        const body = await request.json()
        id = body.id
      } catch (e) {
        // If parsing body fails, continue with null id
      }
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    // Check if category has products
    const productsCount = await db.Product.count({
      where: { categoryId: id }
    })

    if (productsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with existing products' },
        { status: 400 }
      )
    }

    const deletedRowsCount = await db.Category.destroy({
      where: { id }
    })

    if (deletedRowsCount === 0) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
      console.error('Error deleting category:', error)
      return NextResponse.json(
        { error: 'Failed to delete category' },
        { status: 500 }
      )
    }
  }
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
