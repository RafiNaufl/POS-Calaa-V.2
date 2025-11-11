import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import db from '@/models'
import { Op } from 'sequelize'
import { startOfDay, endOfDay, subDays, subMonths, subYears } from 'date-fns'

// Helper function to retry database operations
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Only retry on connection errors
      if (error instanceof Error && error.name === 'SequelizeConnectionError') {
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

// Ensure OperationalExpense table exists (dev-safe)
async function ensureOperationalExpenseTable() {
  try {
    await db.sequelize.getQueryInterface().describeTable('operational_expense')
  } catch (err) {
    try {
      await db.OperationalExpense.sync()
      console.log('operational_expense table created via sync (financial report)')
    } catch (syncErr) {
      console.warn('Failed to ensure operational_expense table:', syncErr)
    }
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const searchParams = request.nextUrl.searchParams
    const range = searchParams.get('range') || '30days'
    
    // Calculate date range
    const endDate = endOfDay(new Date())
    
    let startDate
    switch (range) {
      case '7days':
        startDate = startOfDay(subDays(endDate, 7))
        break
      case '30days':
        startDate = startOfDay(subDays(endDate, 30))
        break
      case '3months':
        startDate = startOfDay(subMonths(endDate, 3))
        break
      case '1year':
        startDate = startOfDay(subYears(endDate, 1))
        break
      default:
        startDate = startOfDay(subDays(endDate, 30))
    }
    
    // Get transactions for the selected period
    const transactions = await withRetry(() => db.Transaction.findAll({
      where: {
        createdAt: {
          [(Op as any).gte]: startDate,
          [(Op as any).lte]: endDate
        },
        status: 'COMPLETED'
      },
      include: [
        {
          model: db.TransactionItem,
          as: 'items',
          include: [
            {
              model: db.Product,
              as: 'product',
              include: [
                {
                  model: db.Category,
                  as: 'category'
                }
              ]
            }
          ]
        },
        {
          model: db.Member,
          as: 'member'
        },
        {
          model: db.User,
          as: 'user'
        },
        {
          model: db.VoucherUsage,
          as: 'voucherUsages',
          include: [
            {
              model: db.Voucher,
              as: 'voucher'
            }
          ]
        }
      ],
      order: [['createdAt', 'ASC']]
    }))
    
    // Calculate revenue metrics
    const grossSales = (transactions as any).reduce((sum: number, t: any) => sum + t.total, 0)
    const discounts = (transactions as any).reduce((sum: number, t: any) => sum + t.discount, 0)
    const voucherDiscounts = (transactions as any).reduce((sum: number, t: any) => sum + t.voucherDiscount, 0)
    const promoDiscounts = (transactions as any).reduce((sum: number, t: any) => sum + t.promoDiscount, 0)
    const totalDiscounts = discounts + voucherDiscounts + promoDiscounts
    const netSales = grossSales - totalDiscounts
    const totalRevenue = (transactions as any).reduce((sum: number, t: any) => sum + t.finalTotal, 0)
    
    // Calculate cost of goods sold (COGS)
    let costOfGoodsSold = 0
    let grossProfit = 0
    
    const cogsByCategory: Record<string, number> = {}
    const revenueByCategory: Record<string, number> = {}
    const profitByCategory: Record<string, number> = {}
    const marginByCategory: Record<string, number> = {}
    
    ;(transactions as any).forEach((transaction: any) => {
      (transaction as any).items.forEach((item: any) => {
        if (item.product?.category) {
          const categoryName = item.product.category.name
          const revenue = item.subtotal
          const quantity = item.quantity
          const costPrice = item.product.costPrice || 0
          const cost = costPrice * quantity
          
          const unitPrice = item.price
          const margin = unitPrice > 0 ? (unitPrice - costPrice) / unitPrice : 0
          
          costOfGoodsSold += cost
          
          if (!cogsByCategory[categoryName]) {
            cogsByCategory[categoryName] = 0
            revenueByCategory[categoryName] = 0
            profitByCategory[categoryName] = 0
            marginByCategory[categoryName] = 0
          }
          
          cogsByCategory[categoryName] += cost
          revenueByCategory[categoryName] += revenue
          profitByCategory[categoryName] += (revenue - cost)
          
          const currentRevenue = revenueByCategory[categoryName]
          const currentMargin = marginByCategory[categoryName]
          const previousRevenue = currentRevenue - revenue
          
          if (currentRevenue > 0) {
            marginByCategory[categoryName] = previousRevenue > 0 ?
              ((previousRevenue * currentMargin) + (revenue * margin)) / currentRevenue :
              margin
          }
        }
      })
    })
    
    // Calculate gross profit
    grossProfit = netSales - costOfGoodsSold
    
    // Ensure expenses table exists before querying
    await ensureOperationalExpenseTable()
    
    // Operational expenses from table
    const expenses = await withRetry(() => db.OperationalExpense.findAll({
      where: {
        date: {
          [(Op as any).gte]: startDate,
          [(Op as any).lte]: endDate
        }
      }
    }))
    
    const operatingExpenses: Record<string, number> = {}
    ;(expenses as any).forEach((expense: any) => {
      const key = expense.category || expense.name || 'Lain-lain'
      operatingExpenses[key] = (operatingExpenses[key] || 0) + (Number(expense.amount) || 0)
    })
    
    if (Object.keys(operatingExpenses).length === 0) {
      operatingExpenses['Gaji Karyawan'] = grossSales * 0.15
      operatingExpenses['Sewa'] = grossSales * 0.10
      operatingExpenses['Utilitas'] = grossSales * 0.05
      operatingExpenses['Pemasaran'] = grossSales * 0.03
      operatingExpenses['Lain-lain'] = grossSales * 0.02
    }
    
    const totalOperatingExpenses = Object.values(operatingExpenses).reduce((sum, v) => sum + v, 0)
    const operatingProfit = grossProfit - totalOperatingExpenses
    const netProfit = operatingProfit
    const profitMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0
    
    // Previous period
    const previousStartDate = new Date(startDate)
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    previousStartDate.setDate(previousStartDate.getDate() - periodDays)
    
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)
    
    const previousTransactions = await withRetry(() => db.Transaction.findAll({
      where: {
        createdAt: {
          [(Op as any).gte]: previousStartDate,
          [(Op as any).lte]: previousEndDate
        },
        status: 'COMPLETED'
      },
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
        }
      ]
    }))
    
    const previousGrossSales = (previousTransactions as any).reduce((sum: number, t: any) => sum + t.total, 0)
    const previousNetProfit = previousGrossSales > 0 ? previousGrossSales * (profitMargin / 100) : 0
    
    const salesGrowth = previousGrossSales > 0 ? ((grossSales - previousGrossSales) / previousGrossSales) * 100 : 0
    const profitGrowth = previousNetProfit > 0 ? ((netProfit - previousNetProfit) / previousNetProfit) * 100 : 0
    
    const financialData = {
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days: periodDays
      },
      revenue: {
        grossSales,
        discounts: {
          regular: discounts,
          voucher: voucherDiscounts,
          promo: promoDiscounts,
          total: totalDiscounts
        },
        netSales,
        totalRevenue
      },
      costs: {
        costOfGoodsSold,
        cogsByCategory
      },
      profitability: {
        grossProfit,
        grossProfitMargin: grossSales > 0 ? (grossProfit / grossSales) * 100 : 0,
        operatingExpenses,
        totalOperatingExpenses,
        operatingProfit,
        operatingProfitMargin: grossSales > 0 ? (operatingProfit / grossSales) * 100 : 0,
        netProfit,
        profitMargin
      },
      categoryAnalysis: {
        revenue: revenueByCategory,
        cogs: cogsByCategory,
        profit: profitByCategory,
        margin: marginByCategory
      },
      growth: {
        sales: salesGrowth,
        profit: profitGrowth
      },
      transactionCount: (transactions as any).length
    }
    
    const bigIntSerializer = (key: string, value: any) => typeof value === 'bigint' ? value.toString() : value
    const serializedData = JSON.parse(JSON.stringify(financialData, bigIntSerializer))
    return NextResponse.json(serializedData, { status: 200 })
  } catch (error) {
    console.error('Error fetching financial report data:', error)
    
    if (error instanceof Error && error.name === 'SequelizeConnectionError') {
      return NextResponse.json(
        { error: 'Database connection error. Please try again later.' },
        { status: 503 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch financial report data' },
      { status: 500 }
    )
  }
}