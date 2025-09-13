import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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

    const member = await prisma.member.findFirst({
      where: {
        OR: [
          phone ? { phone } : {},
          email ? { email } : {}
        ].filter(condition => Object.keys(condition).length > 0)
      },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(member)
  } catch (error) {
    console.error('Error searching member:', error)
    return NextResponse.json(
      { error: 'Failed to search member' },
      { status: 500 }
    )
  }
}