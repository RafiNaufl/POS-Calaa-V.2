import { NextRequest, NextResponse } from 'next/server'
const db = require('@/models')
const { Op } = require('sequelize')

// GET - Search member by phone or email
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get('phone')
    const email = searchParams.get('email')

    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Phone or email is required' },
        { status: 400 }
      )
    }

    const whereConditions = []
    if (phone) whereConditions.push({ phone })
    if (email) whereConditions.push({ email })

    const member = await db.Member.findOne({
      where: {
        [Op.or]: whereConditions
      },
      include: [{
        model: db.Transaction,
        as: 'transactions',
        attributes: []
      }],
      attributes: {
        include: [
          [db.sequelize.fn('COUNT', db.sequelize.col('transactions.id')), 'transactionCount']
        ]
      },
      group: ['Member.id'],
      subQuery: false
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    // Serialize and sanitize numeric fields to avoid [object Object] on frontend
    const m = (member as any)?.get ? (member as any).get({ plain: true }) : (member as any)
    const pointsNum = typeof m.points === 'number' ? m.points : parseInt(String(m.points ?? '0'), 10)
    const totalSpentNum = typeof m.totalSpent === 'number' ? m.totalSpent : parseFloat(String(m.totalSpent ?? '0'))

    return NextResponse.json({
      ...m,
      points: Number.isNaN(pointsNum) ? 0 : pointsNum,
      totalSpent: Number.isNaN(totalSpentNum) ? 0 : totalSpentNum
    })
  } catch (error) {
    console.error('Error searching member:', error)
    return NextResponse.json(
      { error: 'Failed to search member' },
      { status: 500 }
    )
  }
}