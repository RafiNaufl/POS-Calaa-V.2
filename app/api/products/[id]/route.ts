import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    
    if (!id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true
      }
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
  } finally {
    await prisma.$disconnect()
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const body = await request.json()
    console.log('Received update data:', body) // Log the received data
    const { name, productCode, price, costPrice, categoryId, stock, description, image, isActive, size, color } = body
    
    // Validate required fields
    if (!name || !categoryId || !productCode || !size || !color) {
      return NextResponse.json(
        { error: 'Name, product code, category, size, and color are required fields' },
        { status: 400 }
      )
    }
    
    // If productCode is provided, check if it already exists for another product
    if (productCode) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          productCode: productCode,
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

    // Prepare update data with proper type handling
    const updateData: any = {}
    
    // Add all fields in a specific order to avoid Prisma validation errors
    // First add the category relationship if provided
    if (categoryId !== undefined) {
      updateData.category = {
        connect: { id: categoryId }
      }
    }
    
    // Then add all other fields
    if (name !== undefined) updateData.name = name
    if (price !== undefined) updateData.price = parseFloat(price)
    if (stock !== undefined) updateData.stock = parseInt(stock)
    if (description !== undefined) updateData.description = description
    if (size !== undefined) updateData.size = size
    if (color !== undefined) updateData.color = color
    if (productCode !== undefined) updateData.productCode = productCode
    if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice)
    if (image !== undefined) updateData.image = image
    if (isActive !== undefined) updateData.isActive = isActive
    
    console.log('Update data being sent to Prisma:', updateData) // Log the processed data
    
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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id

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