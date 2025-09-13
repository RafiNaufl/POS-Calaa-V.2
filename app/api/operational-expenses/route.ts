import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import cuid from 'cuid'

// Helper function to retry database operations
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Only retry on connection errors
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P5010') {
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        // Increase delay for next attempt (exponential backoff)
        delay *= 2;
      } else {
        // Don't retry on other errors
        throw error;
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
}

// GET - Mendapatkan daftar biaya operasional dengan filter
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate') as string) : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate') as string) : undefined
    const category = searchParams.get('category') || undefined
    
    // Buat filter berdasarkan parameter yang diberikan
    const filter: any = {}
    
    if (startDate || endDate) {
      filter.date = {}
      if (startDate) filter.date.gte = startDate
      if (endDate) filter.date.lte = endDate
    }
    
    if (category) {
      filter.category = category
    }
    
    // Dapatkan data biaya operasional menggunakan raw query karena model name berbeda
    const expenses = await withRetry(() => prisma.$queryRaw`
      SELECT oe.*, u.name as user_name
      FROM "operational_expense" oe
      LEFT JOIN "User" u ON oe."createdBy" = u.id
      WHERE ${Object.keys(filter).length > 0 ? Prisma.sql`
        ${startDate ? Prisma.sql`oe.date >= ${startDate}` : Prisma.sql``}
        ${startDate && endDate ? Prisma.sql` AND ` : Prisma.sql``}
        ${endDate ? Prisma.sql`oe.date <= ${endDate}` : Prisma.sql``}
        ${(startDate || endDate) && category ? Prisma.sql` AND ` : Prisma.sql``}
        ${category ? Prisma.sql`oe.category = ${category}` : Prisma.sql``}
      ` : Prisma.sql`1=1`}
      ORDER BY oe.date DESC
    `);
    
    // Hasil query sudah dalam format yang diharapkan
    const transformedExpenses = expenses as Array<{
      id: string;
      name: string;
      amount: number;
      category: string;
      date: Date;
      description: string | null;
      receipt: string | null;
      createdBy: string;
      createdAt: Date;
      updatedAt: Date;
      user_name: string;
    }>;
    
    // Hitung total biaya
    const totalAmount = transformedExpenses.reduce((sum: number, expense: { amount: number }) => sum + expense.amount, 0)
    
    // Kelompokkan biaya berdasarkan kategori
    const expensesByCategory: Record<string, number> = {}
    transformedExpenses.forEach((expense: { name: string; amount: number }) => {
      if (!expensesByCategory[expense.name]) {
        expensesByCategory[expense.name] = 0
      }
      expensesByCategory[expense.name] += expense.amount
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
  
  try {
    const data = await request.json()
    
    // Validasi data yang diterima
    if (!data.name || !data.amount || !data.category || !data.date) {
      return NextResponse.json({ 
        error: 'Invalid data: name, amount, category, and date are required' 
      }, { status: 400 })
    }
    
    // Buat biaya operasional baru menggunakan raw query
    const newExpense = {
      name: data.name,
      amount: parseFloat(data.amount),
      category: data.category,
      date: new Date(data.date),
      description: data.description || null,
      receipt: data.receipt || null,
      createdBy: session.user.id
    }
    
    // Gunakan Prisma query builder untuk insert
    // Pertama, verifikasi bahwa user ID valid
    const userExists = await prisma.user.findUnique({
      where: {
        id: session.user.id
      },
      select: { id: true }
    });
    
    if (!userExists) {
      console.error('User not found:', session.user.id);
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }
    
    // Gunakan cuid untuk menghasilkan ID yang valid
    
    // Gunakan raw query untuk membuat expense baru dengan ID yang valid
    const validId = cuid();
    const expense = await withRetry(() => prisma.$queryRaw`
      INSERT INTO "operational_expense" (
        id, name, amount, category, date, description, receipt, "createdBy", "createdAt", "updatedAt"
      ) VALUES (
        ${validId},
        ${newExpense.name},
        ${newExpense.amount},
        ${newExpense.category},
        ${newExpense.date},
        ${newExpense.description},
        ${newExpense.receipt},
        ${session.user.id},
        ${new Date()},
        ${new Date()}
      )
      RETURNING *
    `)
    
    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Error creating operational expense:', error)
    return NextResponse.json({ error: 'Failed to create operational expense' }, { status: 500 })
  }
}