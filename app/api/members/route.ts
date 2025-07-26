import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Fetch all members
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {}

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { transactions: true }
          }
        }
      }),
      prisma.member.count({ where })
    ])

    return NextResponse.json({
      members,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}

// POST - Create new member
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    // Check if member already exists
    const existingMember = await prisma.member.findFirst({
      where: {
        OR: [
          phone ? { phone } : {},
          email ? { email } : {}
        ].filter(condition => Object.keys(condition).length > 0)
      }
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'Member with this phone or email already exists' },
        { status: 400 }
      )
    }

    const member = await prisma.member.create({
      data: {
        name,
        phone: phone || null,
        email: email || null
      }
    })

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Error creating member:', error)
    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    )
  }
}

// PUT - Update member
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, phone, email, points } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      )
    }

    const member = await prisma.member.update({
      where: { id },
      data: {
        name,
        phone: phone || null,
        email: email || null,
        points: points !== undefined ? points : undefined,
        lastVisit: new Date()
      }
    })

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    )
  }
}

// DELETE - Delete member
export async function DELETE(request: NextRequest) {
  try {
    // Check if ID is in URL params first
    const { searchParams } = new URL(request.url)
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
        { error: 'Member ID is required' },
        { status: 400 }
      )
    }

    // Check if member has transactions before deleting
    const memberWithTransactions = await prisma.member.findUnique({
      where: { id },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    })

    if (memberWithTransactions && memberWithTransactions._count && memberWithTransactions._count.transactions > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member with transaction history' },
        { status: 400 }
      )
    }

    await prisma.member.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Member deleted successfully' })
  } catch (error) {
    console.error('Error deleting member:', error)
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    )
  }
}