import { NextRequest, NextResponse } from 'next/server'
const db = require('@/models')
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  
  try {
    // Check if users already exist
    const existingUsers = await db.User.count()
    
    if (existingUsers > 0) {
      return NextResponse.json(
        { message: 'Users already exist' },
        { status: 400 }
      )
    }

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 12)
    const cashierPassword = await bcrypt.hash('kasir123', 12)

    // Create admin user
    const admin = await db.User.create({
      email: 'admin@pos.com',
      name: 'Administrator',
      password: adminPassword,
      role: 'ADMIN'
    })

    // Create cashier user
    const cashier = await db.User.create({
      email: 'kasir@pos.com',
      name: 'Kasir',
      password: cashierPassword,
      role: 'CASHIER'
    })

    return NextResponse.json({
      message: 'Users created successfully',
      users: [
        { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
        { id: cashier.id, email: cashier.email, name: cashier.name, role: cashier.role }
      ]
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}