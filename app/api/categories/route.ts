import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}  

export async function POST(request: NextRequest) {
  
  try {
    const body = await request.json()
    const { name, description } = body

    const category = await prisma.category.create({
      data: {
        name,
        description
      }
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

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        description
      }
    })

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
    const productsCount = await prisma.product.count({
      where: { categoryId: id }
    })

    if (productsCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with existing products' },
        { status: 400 }
      )
    }

    await prisma.category.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Category deleted successfully' })
  } catch (error) {
      console.error('Error deleting category:', error)
      return NextResponse.json(
        { error: 'Failed to delete category' },
        { status: 500 }
      )
    }
  }
