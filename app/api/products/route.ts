import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  
  try {
    const searchParams = request.nextUrl.searchParams
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit
    
    const whereClause = includeInactive ? {} : { isActive: true }
    
    // Get total count for pagination info
    const totalCount = await prisma.product.count({
      where: whereClause
    })
    
    // Get paginated products with selected fields only
    const products = await prisma.product.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        productCode: true,
        price: true,
        costPrice: true,
        stock: true,
        isActive: true,
        size: true,
        color: true,
        image: true,
        createdAt: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      },
      skip,
      take: limit
    })

    return NextResponse.json({
      products,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function POST(request: NextRequest) {
  
  try {
    const body = await request.json()
    console.log('Received product data:', body)
    
    // Extract data with proper validation
    const { 
      name, 
      productCode,
      price, 
      categoryId, 
      stock, 
      description, 
      image,
      costPrice = 0, // Default cost price to 0 if not provided
      isActive = true, // Default to active if not provided
      size = '',
      color = ''
    } = body

    // Validate required fields
    if (!name || !categoryId || !productCode || !size || !color) {
      return NextResponse.json(
        { error: 'Name, product code, category, size, and color are required fields' },
        { status: 400 }
      )
    }
    
    // Check if product code already exists
    const existingProduct = await prisma.product.findFirst({
      where: {
        productCode: {
          equals: productCode
        }
      }
    })
    
    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product code already exists' },
        { status: 400 }
      )
    }

    // Create the product with proper type conversion
    const productData = {
      name,
      productCode,
      price: typeof price === 'number' ? price : parseFloat(price),
      categoryId,
      stock: typeof stock === 'number' ? stock : parseInt(stock),
      description: description || '',
      image: image || '',
      size,
      color,
      isActive
    }

    // Add costPrice separately to avoid TypeScript errors
    if (costPrice !== undefined) {
      (productData as any).costPrice = typeof costPrice === 'number' ? costPrice : parseFloat(costPrice || '0')
    }

    const product = await prisma.product.create({
      data: productData,
      include: {
        category: true
      }
    })

    console.log('Created product:', product)
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: `Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

export async function PUT(request: NextRequest) {
  
  try {
    const body = await request.json()
    const { id, name, price, costPrice, categoryId, stock, description, size, color, image, isActive, productCode } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!name || !categoryId || !productCode || !size || !color) {
      return NextResponse.json(
        { error: 'Name, product code, category, size, and color are required fields' },
        { status: 400 }
      )
    }
    
    // Check if product code already exists for another product
    if (productCode) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          productCode: {
            equals: productCode
          },
          id: { not: id }
        }
      })
      
      if (existingProduct) {
        return NextResponse.json(
          { error: 'Product code already exists for another product' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      name,
      price: parseFloat(price),
      categoryId,
      stock: parseInt(stock),
      description: description || '',
      size,
      color,
      productCode
    }

    // Add optional fields
    if (costPrice !== undefined) {
      updateData.costPrice = parseFloat(costPrice)
    }
    
    if (image !== undefined) {
      updateData.image = image
    }
    
    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true
      }
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
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

    await prisma.product.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}