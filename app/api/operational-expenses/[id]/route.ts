import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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

// GET - Mendapatkan detail biaya operasional berdasarkan ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const id = params.id
    
    // Dapatkan detail biaya operasional
    const expense = await withRetry(() => prisma.$queryRaw`
      SELECT oe.*, u.name as user_name
      FROM "operational_expense" oe
      JOIN "User" u ON oe."createdBy" = u.id
      WHERE oe.id = ${id}
    `)
    
    if (!expense) {
      return NextResponse.json({ error: 'Operational expense not found' }, { status: 404 })
    }
    
    return NextResponse.json(expense, { status: 200 })
  } catch (error) {
    console.error('Error fetching operational expense:', error)
    return NextResponse.json({ error: 'Failed to fetch operational expense' }, { status: 500 })
  }
}

// PUT - Memperbarui biaya operasional berdasarkan ID
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Hanya admin yang dapat memperbarui biaya operasional
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Only admins can update operational expenses' }, { status: 403 })
  }
  
  try {
    const id = params.id
    const data = await request.json()
    
    // Validasi data yang diterima
    if (!data.name || !data.amount || !data.category || !data.date) {
      return NextResponse.json({ 
        error: 'Invalid data: name, amount, category, and date are required' 
      }, { status: 400 })
    }
    
    // Periksa apakah biaya operasional ada
    const existingExpense = await withRetry(() => prisma.$queryRaw`
      SELECT * FROM "operational_expense" WHERE id = ${id}
    `)
    
    if (!existingExpense) {
      return NextResponse.json({ error: 'Operational expense not found' }, { status: 404 })
    }
    
    // Perbarui biaya operasional
    const updatedExpense = await withRetry(() => prisma.$executeRaw`
      UPDATE "operational_expense"
      SET name = ${data.name},
          amount = ${parseFloat(data.amount)},
          category = ${data.category},
          date = ${new Date(data.date)},
          description = ${data.description},
          receipt = ${data.receipt},
          "updatedAt" = ${new Date()}
      WHERE id = ${id}
      RETURNING *
    `)
    
    return NextResponse.json(updatedExpense, { status: 200 })
  } catch (error) {
    console.error('Error updating operational expense:', error)
    return NextResponse.json({ error: 'Failed to update operational expense' }, { status: 500 })
  }
}

// DELETE - Menghapus biaya operasional berdasarkan ID
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Hanya admin yang dapat menghapus biaya operasional
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden: Only admins can delete operational expenses' }, { status: 403 })
  }
  
  try {
    const id = params.id
    
    // Periksa apakah biaya operasional ada
    const existingExpense = await withRetry(() => prisma.$queryRaw`
      SELECT * FROM "operational_expense" WHERE id = ${id}
    `)
    
    if (!existingExpense) {
      return NextResponse.json({ error: 'Operational expense not found' }, { status: 404 })
    }
    
    // Hapus biaya operasional
    await withRetry(() => prisma.$executeRaw`
      DELETE FROM "operational_expense" WHERE id = ${id}
    `)
    
    return NextResponse.json({ message: 'Operational expense deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting operational expense:', error)
    return NextResponse.json({ error: 'Failed to delete operational expense' }, { status: 500 })
  }
}