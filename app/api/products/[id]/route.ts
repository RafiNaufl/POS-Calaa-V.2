import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'
import { Op } from 'sequelize'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  
  try {
    const { id } = params

    const product = await db.Product.findByPk(id, {
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  
  try {
    const { id } = params
    const body = await request.json()
    const { 
      name, 
      productCode, 
      price, 
      costPrice, 
      stock, 
      categoryId, 
      description, 
      size, 
      color, 
      image,
      isActive 
    } = body

    // Check if product code already exists for another product
    if (productCode) {
      const existingProduct = await db.Product.findOne({
        where: { 
          productCode,
          id: { [Op.ne]: id }
        }
      })

      if (existingProduct) {
        return NextResponse.json(
          { error: 'Product code already exists' },
          { status: 400 }
        )
      }
    }

    const [updatedRowsCount] = await db.Product.update(
      {
        name,
        productCode,
        price: price ? parseFloat(price) : undefined,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        categoryId,
        description,
        size,
        color,
        image,
        isActive
      },
      {
        where: { id }
      }
    )

    if (updatedRowsCount === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const product = await db.Product.findByPk(id, {
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ]
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  
  try {
    const { id } = params

    const deletedRowsCount = await db.Product.destroy({
      where: { id }
    })

    if (deletedRowsCount === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}