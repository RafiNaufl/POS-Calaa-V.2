import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
const db = require('@/models')
import { Op } from 'sequelize'

// Safe guard: ensure table exists in dev environments
async function ensureOperationalExpenseTable() {
  try {
    // Try describe table; if fails, create it
    await db.sequelize.getQueryInterface().describeTable('operational_expense')
  } catch (error) {
    try {
      await db.OperationalExpense.sync()
      console.log('operational_expense table created via sync')
    } catch (syncError) {
      console.error('Failed to create operational_expense table:', syncError)
    }
  }
}

// GET - Mendapatkan daftar biaya operasional dengan filter
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await ensureOperationalExpenseTable()
  
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate') as string) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate') as string) : undefined
    const category = searchParams.get('category') || undefined
    
    // Buat filter berdasarkan parameter yang diberikan
    const whereClause: any = {}
    
    if (startDate || endDate) {
      whereClause.date = {}
      if (startDate) whereClause.date[Op.gte] = startDate
      if (endDate) whereClause.date[Op.lte] = endDate
    }
    
    if (category) {
      whereClause.category = category
    }
    
    // Dapatkan data biaya operasional dengan join ke User
    const expenses = await db.OperationalExpense.findAll({
      where: whereClause,
      include: [{
        model: db.User,
        as: 'creator',
        attributes: ['name']
      }],
      order: [['date', 'DESC']]
    })
    
    // Transform data untuk mencocokkan format yang diharapkan
    const transformedExpenses = expenses.map((expense: any) => ({
      id: expense.id,
      name: expense.name,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      description: expense.description,
      receipt: expense.receipt,
      createdBy: expense.createdBy,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
      user_name: expense.creator?.name || null
    }))
    
    // Hitung total biaya
    const totalAmount = transformedExpenses.reduce((sum: number, expense: { amount: number }) => sum + expense.amount, 0)
    
    // Kelompokkan biaya berdasarkan kategori
    const expensesByCategory: Record<string, number> = {}
    transformedExpenses.forEach((expense: { category: string; amount: number }) => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = 0
      }
      expensesByCategory[expense.category] += expense.amount
    })
    
    return NextResponse.json({
      expenses: transformedExpenses,
      totalAmount,
      expensesByCategory
    }, { status: 200 })
  } catch (error) {
    console.error('Error fetching operational expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch operational expenses' }, { status: 500 })
  }
}

// POST - Menambahkan biaya operasional baru
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Hanya admin yang dapat menambahkan biaya operasional
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Only admins can add operational expenses' }, { status: 403 })
  }
  
  await ensureOperationalExpenseTable()

  try {
    const data = await request.json()
    
    // Validasi data yang diterima
    if (!data.name || !data.amount || !data.category || !data.date) {
      return NextResponse.json({ 
        error: 'Invalid data: name, amount, category, and date are required' 
      }, { status: 400 })
    }
    
    // Verifikasi bahwa user ID valid
    const userExists = await db.User.findByPk(session.user.id)
    
    if (!userExists) {
      console.error('User not found:', session.user.id)
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }
    
    // Buat biaya operasional baru
    const expense = await db.OperationalExpense.create({
      name: data.name,
      amount: parseFloat(data.amount),
      category: data.category,
      date: new Date(data.date),
      description: data.description || null,
      receipt: data.receipt || null,
      createdBy: session.user.id
    })
    
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating operational expense:', error)
    return NextResponse.json({ error: 'Failed to create operational expense' }, { status: 500 })
  }
}