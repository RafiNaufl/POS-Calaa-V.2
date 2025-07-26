import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      include: {
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
      include: {
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
    const topProducts = await prisma.transactionItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 5
    })

    const topProductsWithDetails = await Promise.all(
      topProducts.map(async (item: any) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        })
        return {
          product,
          totalSold: item._sum.quantity
        }
      })
    )

    // Get sales by category
    const salesByCategory = await prisma.transactionItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
        subtotal: true
      }
    })

    const categoryStats = new Map()
    
    for (const item of salesByCategory) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: { category: true }
      })
      
      if (product && product.category) {
        const categoryName = product.category.name
        const existing = categoryStats.get(categoryName) || { quantity: 0, revenue: 0 }
        categoryStats.set(categoryName, {
          quantity: existing.quantity + (item._sum.quantity || 0),
          revenue: existing.revenue + (item._sum.subtotal || 0)
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
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
