import { NextRequest, NextResponse } from 'next/server'
import db from '@/models'
import { Op, QueryTypes } from 'sequelize'

export async function GET(request: NextRequest) {
  
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get today's sales
    const todayTransactions = await db.Transaction.findAll({
      where: {
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow
        }
      },
      attributes: ['id', 'total', 'finalTotal'],
      include: [
        {
          model: db.TransactionItem,
          as: 'items'
        }
      ]
    })

    const todaySales = todayTransactions.reduce((total: number, transaction: any) => {
      return total + (transaction.finalTotal || transaction.total || 0)
    }, 0)

    // Get total products
    const totalProducts = await db.Product.count()

    // Get today's transaction count
    const totalTransactions = todayTransactions.length

    // Get low stock items (stock <= 5)
    const lowStockItems = await db.Product.count({
      where: {
        stock: {
          [Op.lte]: 5
        }
      }
    })

    // Get recent transactions
    const recentTransactions = await db.Transaction.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: [
        'id',
        'total',
        'finalTotal',
        'status',
        'paymentStatus',
        'paymentMethod',
        'createdAt',
        'updatedAt',
        'paidAt',
        'userId',
        'customerName',
        'customerPhone',
        'customerEmail',
        'memberId'
      ],
      include: [
        {
          model: db.TransactionItem,
          as: 'items',
          include: [
            {
              model: db.Product,
              as: 'product'
            }
          ]
        },
        {
          model: db.User,
          as: 'user',
          attributes: ['name']
        },
        {
          model: db.Member,
          as: 'member',
          attributes: ['name']
        }
      ]
    })

    // Get top selling products using Sequelize query
    const topProductsQuery = await db.sequelize.query(`
      SELECT "productId", SUM(quantity) as total_quantity
      FROM "TransactionItem"
      GROUP BY "productId"
      ORDER BY total_quantity DESC
      LIMIT 5
    `, { type: QueryTypes.SELECT })

    // Get product details for top products
    const topProducts: any[] = []
    for (const item of topProductsQuery as any[]) {
      const product = await db.Product.findByPk(item.productId, {
        attributes: ['id', 'name', 'price']
      })
      if (product) {
        topProducts.push({
          product: product.toJSON(),
          totalSold: parseInt(item.total_quantity)
        })
      }
    }

    // Get sales trend for the last 7 days
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const salesTrend = await db.Transaction.findAll({
      where: {
        createdAt: {
          [Op.gte]: sevenDaysAgo,
          [Op.lt]: tomorrow
        },
        status: 'COMPLETED'
      },
      attributes: [
        [db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'date'],
        [db.sequelize.fn('SUM', db.sequelize.col('finalTotal')), 'total']
      ],
      group: [db.sequelize.fn('DATE', db.sequelize.col('createdAt'))],
      order: [[db.sequelize.fn('DATE', db.sequelize.col('createdAt')), 'ASC']]
    })

    return NextResponse.json({
      todaySales,
      totalProducts,
      totalTransactions,
      lowStockItems,
      recentTransactions,
      topProducts,
      salesTrend
    })

  } catch (error) {
    console.error('Dashboard stats error:', error)
    
    // Handle connection errors
    if (error instanceof Error && error.message.includes('connection')) {
      console.log('Database connection error, retrying...')
      // Could implement retry logic here
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}
