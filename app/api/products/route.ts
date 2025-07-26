import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  
  try {
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    
    const whereClause = includeInactive ? {} : { isActive: true }
    
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(products)
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
      price, 
      categoryId, 
      stock, 
      description, 
      image,
      isActive = true // Default to active if not provided
    } = body

    // Validate required fields
    if (!name || !categoryId) {
      return NextResponse.json(
        { error: 'Name and category are required fields' },
        { status: 400 }
      )
    }

    // Create the product with proper type conversion
    const product = await prisma.product.create({
      data: {
        name,
        price: typeof price === 'number' ? price : parseFloat(price),
        categoryId,
        stock: typeof stock === 'number' ? stock : parseInt(stock),
        description: description || '',
        image: image || '',
        isActive
      },
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
    const { id, name, price, categoryId, stock, description } = body

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        price: parseFloat(price),
        categoryId,
        stock: parseInt(stock),
        description
      },
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
    const { searchParams } = new URL(request.url)
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