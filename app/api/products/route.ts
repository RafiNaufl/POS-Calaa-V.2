import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'
import { Op } from 'sequelize'

export async function GET(request: NextRequest) {
  
  try {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    
    const whereClause = includeInactive ? {} : { isActive: true }
    
    // Get total count for pagination info
    const totalCount = await db.Product.count({
      where: whereClause
    })
    
    // Get paginated products with selected fields only
    const products = await db.Product.findAll({
      where: whereClause,
      attributes: [
        'id',
        'name',
        'productCode',
        'price',
        'costPrice',
        'stock',
        'isActive',
        'size',
        'color',
        'image',
        'createdAt',
        'categoryId'
      ],
      include: [
        {
          model: db.Category,
          as: 'category',
          attributes: ['id', 'name']
        }
      ],
      order: [['name', 'ASC']],
      offset,
      limit
    })

    return NextResponse.json({
      products,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  
  try {
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
      isActive = true 
    } = body

    // Validate required fields
    if (!name || !price || !categoryId) {
      return NextResponse.json(
        { error: 'Name, price, and category are required' },
        { status: 400 }
      )
    }

    // Check if product code already exists (if provided)
    if (productCode) {
      const existingProduct = await db.Product.findOne({
        where: { productCode }
      })

      if (existingProduct) {
        return NextResponse.json(
          { error: 'Product code already exists' },
          { status: 400 }
        )
      }
    }

    // Generate product code if not provided
    let finalProductCode = productCode
    if (!finalProductCode) {
      const timestamp = Date.now().toString().slice(-6)
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      finalProductCode = `PRD${timestamp}${randomNum}`
    }

    // Normalize image: allow null when empty string
    const normalizedImage = image && String(image).trim() !== '' ? image : null

    const product = await db.Product.create({
      name,
      productCode: finalProductCode,
      price: parseFloat(price),
      costPrice: costPrice ? parseFloat(costPrice) : null,
      stock: parseInt(stock) || 0,
      categoryId,
      description,
      size,
      color,
      image: normalizedImage,
      isActive
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  
  try {
    const body = await request.json()
    const { 
      id,
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

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

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

    // Normalize image before update
    const normalizedImage = image && String(image).trim() !== '' ? image : null

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
        image: normalizedImage,
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

export async function DELETE(request: NextRequest) {
  
  try {
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

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