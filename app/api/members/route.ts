import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'
import { Op } from 'sequelize'

// GET - Fetch all members
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    const where = search ? {
      [Op.or]: [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ]
    } : {}

    const [members, total] = await Promise.all([
      db.Member.findAll({
        where,
        offset,
        limit,
        order: [["createdAt", "DESC"]],
        attributes: {
          include: [
            [
              db.sequelize.literal('(SELECT COUNT(*) FROM "Transaction" AS t WHERE t.memberId = "Member"."id")'),
              'transactionCount'
            ]
          ]
        }
      }),
      db.Member.count({ where })
    ])

    // Sanitize numeric fields for each member
    const sanitizedMembers = members.map((member: any) => {
      const m = member?.get ? member.get({ plain: true }) : member
      const pointsNum = typeof m.points === 'number' ? m.points : parseInt(String(m.points ?? '0'), 10)
      const totalSpentNum = typeof m.totalSpent === 'number' ? m.totalSpent : parseFloat(String(m.totalSpent ?? '0'))
      const transactionCountNum = typeof m.transactionCount === 'number' ? m.transactionCount : parseInt(String(m.transactionCount ?? '0'), 10)
      return {
        ...m,
        points: Number.isNaN(pointsNum) ? 0 : pointsNum,
        totalSpent: Number.isNaN(totalSpentNum) ? 0 : totalSpentNum,
        transactionCount: Number.isNaN(transactionCountNum) ? 0 : transactionCountNum
      }
    })

    return NextResponse.json({
      members: sanitizedMembers,
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
    const { name, phone, email, address, dateOfBirth } = body

    // Validate required fields
    if (!name || !phone) {
      return NextResponse.json(
        { error: 'Name and phone are required' },
        { status: 400 }
      )
    }

    // Check if phone already exists
    const existingMember = await db.Member.findOne({
      where: { phone }
    })

    if (existingMember) {
      return NextResponse.json(
        { error: 'Phone number already exists' },
        { status: 400 }
      )
    }

    // Check if email already exists (if provided)
    if (email) {
      const existingEmail = await db.Member.findOne({
        where: { email }
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    const member = await db.Member.create({
      name,
      phone,
      email,
      address,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
    })

    // Sanitize before returning
    const m = (member as any)?.get ? (member as any).get({ plain: true }) : (member as any)
    const pointsNum = typeof m.points === 'number' ? m.points : parseInt(String(m.points ?? '0'), 10)
    const totalSpentNum = typeof m.totalSpent === 'number' ? m.totalSpent : parseFloat(String(m.totalSpent ?? '0'))

    return NextResponse.json({
      ...m,
      points: Number.isNaN(pointsNum) ? 0 : pointsNum,
      totalSpent: Number.isNaN(totalSpentNum) ? 0 : totalSpentNum
    }, { status: 201 })
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
    const { id, name, phone, email, address, dateOfBirth } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      )
    }

    // Check if phone already exists for another member
    if (phone) {
      const existingMember = await db.Member.findOne({
        where: { 
          phone,
          id: { [Op.ne]: id }
        }
      })

      if (existingMember) {
        return NextResponse.json(
          { error: 'Phone number already exists' },
          { status: 400 }
        )
      }
    }

    // Check if email already exists for another member (if provided)
    if (email) {
      const existingEmail = await db.Member.findOne({
        where: { 
          email,
          id: { [Op.ne]: id }
        }
      })

      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        )
      }
    }

    const [updatedRowsCount] = await db.Member.update(
      {
        name,
        phone,
        email,
        address,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
      },
      {
        where: { id }
      }
    )

    if (updatedRowsCount === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    const member = await db.Member.findByPk(id)
    const m = (member as any)?.get ? (member as any).get({ plain: true }) : (member as any)
    const pointsNum = typeof m.points === 'number' ? m.points : parseInt(String(m.points ?? '0'), 10)
    const totalSpentNum = typeof m.totalSpent === 'number' ? m.totalSpent : parseFloat(String(m.totalSpent ?? '0'))
    return NextResponse.json({
      ...m,
      points: Number.isNaN(pointsNum) ? 0 : pointsNum,
      totalSpent: Number.isNaN(totalSpentNum) ? 0 : totalSpentNum
    })
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
    const searchParams = request.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      )
    }

    // Check if member has transactions
    const transactionCount = await db.Transaction.count({
      where: { memberId: id }
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete member with existing transactions' },
        { status: 400 }
      )
    }

    const deletedRowsCount = await db.Member.destroy({
      where: { id }
    })

    if (deletedRowsCount === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Member deleted successfully' })
  } catch (error) {
    console.error('Error deleting member:', error)
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    )
  }
}