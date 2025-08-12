import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get today's sales
    const todayTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      select: {
        id: true,
        total: true,
        items: true
      }
    })

    const todaySales = todayTransactions.reduce((total: number, transaction: any) => {
      return total + transaction.total
    }, 0)

    // Get total products
    const totalProducts = await prisma.product.count()

    // Get today's transaction count
    const totalTransactions = todayTransactions.length

    // Get low stock items (stock <= 5)
    const lowStockItems = await prisma.product.count({
      where: {
        stock: {
          lte: 5
        }
      }
    })

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        total: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
        userId: true,
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            name: true
          }
        }
      }
    })

    // Get top selling products
    const topProducts = await prisma.$queryRaw`
      SELECT "productId", SUM(quantity) as total_quantity
      FROM "TransactionItem"
      GROUP BY "productId"
      ORDER BY total_quantity DESC
      LIMIT 5
    `

    const topProductsWithDetails = await Promise.all(
      (topProducts as any[]).map(async (item: any) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        })
        return {
          product,
          totalSold: Number(item.total_quantity)
        }
      })
    )

    // Get sales by category
    const salesByCategory = await prisma.$queryRaw`
      SELECT "productId", SUM(quantity) as total_quantity, SUM(subtotal) as total_subtotal
      FROM "TransactionItem"
      GROUP BY "productId"
    `

    const categoryStats = new Map()
    
    for (const item of salesByCategory as any[]) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { category: true }
      })
      
      if (product && product.category) {
        const categoryName = product.category.name
        const existing = categoryStats.get(categoryName) || { quantity: 0, revenue: 0 }
        categoryStats.set(categoryName, {
          quantity: existing.quantity + (Number(item.total_quantity) || 0),
          revenue: existing.revenue + (Number(item.total_subtotal) || 0)
        })
      }
    }

    const categoryStatsArray = Array.from(categoryStats.entries()).map(([name, stats]) => ({
      category: name,
      ...stats
    }))

    const stats = {
      todaySales,
      totalProducts,
      totalTransactions,
      lowStockItems,
      recentTransactions,
      topProducts: topProductsWithDetails,
      salesByCategory: categoryStatsArray,
      timestamp: new Date().getTime() // Tambahkan timestamp untuk memastikan data selalu baru
    }

    // Set header untuk mencegah caching
    const response = NextResponse.json(stats)
    response.headers.set('Cache-Control', 'no-store, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    return response
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    
    // Handle Prisma-specific errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2022 is the error code for "Column does not exist"
      if (error.code === 'P2022') {
        console.log('Column does not exist error. Attempting to continue without the problematic column.')
        // Return a more specific error message
        return NextResponse.json(
          { error: 'Database schema issue detected. Please contact administrator.', code: error.code },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
