import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
const db = require('@/models')

// GET - Mendapatkan detail biaya operasional berdasarkan ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const id = params.id
    
    // Dapatkan detail biaya operasional
    const expense = await db.OperationalExpense.findByPk(id, {
      include: [{
        model: db.User,
        as: 'creator',
        attributes: ['name']
      }]
    })
    
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
    const existingExpense = await db.OperationalExpense.findByPk(id)
    
    if (!existingExpense) {
      return NextResponse.json({ error: 'Operational expense not found' }, { status: 404 })
    }
    
    // Perbarui biaya operasional
    const updatedExpense = await db.OperationalExpense.update({
      name: data.name,
      amount: parseFloat(data.amount),
      category: data.category,
      date: new Date(data.date),
      description: data.description,
      receipt: data.receipt
    }, {
      where: { id },
      returning: true
    })
    
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
    const existingExpense = await db.OperationalExpense.findByPk(id)
    
    if (!existingExpense) {
      return NextResponse.json({ error: 'Operational expense not found' }, { status: 404 })
    }
    
    // Hapus biaya operasional
    await db.OperationalExpense.destroy({ where: { id } })
    
    return NextResponse.json({ message: 'Operational expense deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting operational expense:', error)
    return NextResponse.json({ error: 'Failed to delete operational expense' }, { status: 500 })
  }
}