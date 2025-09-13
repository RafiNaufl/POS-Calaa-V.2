import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { startOfDay, endOfDay, subDays, subMonths, subYears, format, parseISO, differenceInDays } from 'date-fns'

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
    
    // Get transactions for the selected period with retry mechanism
    const transactions = await withRetry(() => prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'COMPLETED'
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true
              }
            }
          }
        },
        voucherUsages: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    }))
    
    // Calculate revenue metrics
    const grossSales = transactions.reduce((sum: number, t: any) => sum + t.total, 0)
    const discounts = transactions.reduce((sum: number, t: any) => sum + t.discount, 0)
    const voucherDiscounts = transactions.reduce((sum: number, t: any) => sum + t.voucherDiscount, 0)
    const promoDiscounts = transactions.reduce((sum: number, t: any) => sum + t.promoDiscount, 0)
    const totalDiscounts = discounts + voucherDiscounts + promoDiscounts
    const netSales = grossSales - totalDiscounts
    // Taxes removed - no longer calculating tax
    const totalRevenue = transactions.reduce((sum: number, t: any) => sum + t.finalTotal, 0)
    
    // Calculate cost of goods sold (COGS) using actual cost price data
    let costOfGoodsSold = 0
    let grossProfit = 0
    
    // Calculate COGS by category
    const cogsByCategory: Record<string, number> = {}
    const revenueByCategory: Record<string, number> = {}
    const profitByCategory: Record<string, number> = {}
    const marginByCategory: Record<string, number> = {}
    
    transactions.forEach((transaction: any) => {
      transaction.items.forEach((item: any) => {
        if (item.product?.category) {
          const categoryName = item.product.category.name
          const revenue = item.subtotal
          const quantity = item.quantity
          const costPrice = item.product.costPrice || 0
          const cost = costPrice * quantity
          
          // Calculate margin for this product
          const unitPrice = item.price
          const margin = unitPrice > 0 ? (unitPrice - costPrice) / unitPrice : 0
          
          // Add to total COGS
          costOfGoodsSold += cost
          
          // Track by category
          if (!cogsByCategory[categoryName]) {
            cogsByCategory[categoryName] = 0
            revenueByCategory[categoryName] = 0
            profitByCategory[categoryName] = 0
            marginByCategory[categoryName] = 0
          }
          
          cogsByCategory[categoryName] += cost
          revenueByCategory[categoryName] += revenue
          profitByCategory[categoryName] += (revenue - cost)
          
          // Update the average margin for this category
          // We need to recalculate the weighted average margin
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
    
    // Dapatkan data biaya operasional dari database untuk periode yang sama
    const operationalExpenses = await withRetry(() => prisma.$queryRaw`
      SELECT id, name, amount, category, date, description, receipt, "createdBy", "createdAt", "updatedAt"
      FROM "operational_expense"
      WHERE date >= ${startDate} AND date <= ${endDate}
    ` as Promise<Array<{
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
    }>>)
    
    // Kelompokkan biaya operasional berdasarkan nama
    const operatingExpenses: Record<string, number> = {}
    operationalExpenses.forEach((expense) => {
      if (!operatingExpenses[expense.name]) {
        operatingExpenses[expense.name] = 0
      }
      operatingExpenses[expense.name] += expense.amount
    })
    
    // Jika tidak ada data biaya operasional, gunakan estimasi sebagai fallback
    if (Object.keys(operatingExpenses).length === 0) {
      // Fallback ke estimasi jika tidak ada data aktual
      operatingExpenses['Gaji Karyawan'] = grossSales * 0.15 // 15% of gross sales
      operatingExpenses['Sewa'] = grossSales * 0.10 // 10% of gross sales
      operatingExpenses['Utilitas'] = grossSales * 0.05 // 5% of gross sales
      operatingExpenses['Pemasaran'] = grossSales * 0.03 // 3% of gross sales
      operatingExpenses['Lain-lain'] = grossSales * 0.02 // 2% of gross sales
    }
    
    const totalOperatingExpenses = Object.values(operatingExpenses).reduce((sum, expense) => sum + expense, 0)
    const operatingProfit = grossProfit - totalOperatingExpenses
    const netProfit = operatingProfit // Assuming no other income/expenses or taxes
    const profitMargin = (netProfit / grossSales) * 100
    
    // Calculate previous period metrics for comparison
    const previousStartDate = new Date(startDate)
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    previousStartDate.setDate(previousStartDate.getDate() - periodDays)
    
    const previousEndDate = new Date(startDate)
    previousEndDate.setDate(previousEndDate.getDate() - 1)
    
    const previousTransactions = await withRetry(() => prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: previousStartDate,
          lte: previousEndDate
        },
        status: 'COMPLETED'
      },
      include: {
        items: true
      }
    }))
    
    const previousGrossSales = previousTransactions.reduce((sum: number, t: any) => sum + t.total, 0)
    const previousNetProfit = previousGrossSales * (profitMargin / 100) // Estimate using same profit margin
    
    // Calculate growth
    const salesGrowth = previousGrossSales > 0 ? ((grossSales - previousGrossSales) / previousGrossSales) * 100 : 0
    const profitGrowth = previousNetProfit > 0 ? ((netProfit - previousNetProfit) / previousNetProfit) * 100 : 0
    
    // Prepare response data
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
        // taxes field removed
        totalRevenue
      },
      costs: {
        costOfGoodsSold,
        cogsByCategory
      },
      profitability: {
        grossProfit,
        grossProfitMargin: (grossProfit / grossSales) * 100,
        operatingExpenses,
        totalOperatingExpenses,
        operatingProfit,
        operatingProfitMargin: (operatingProfit / grossSales) * 100,
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
      transactionCount: transactions.length
    }
    
    // Create a custom serializer to handle BigInt values
    const bigIntSerializer = (key: string, value: any) => 
      typeof value === 'bigint' ? value.toString() : value;
    
    // Apply BigInt serialization before passing to NextResponse
    const serializedData = JSON.parse(JSON.stringify(financialData, bigIntSerializer));
    return NextResponse.json(serializedData, { status: 200 })
  } catch (error) {
    console.error('Error fetching financial report data:', error)
    
    // Handle specific Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Connection errors (P5010)
      if (error.code === 'P5010') {
        return NextResponse.json(
          { error: 'Database connection error. Please try again later.' },
          { status: 503 } // Service Unavailable
        )
      }
      
      // Other known Prisma errors
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      )
    }
    
    // Handle other errors
    return NextResponse.json(
      { error: 'Failed to fetch financial report data' },
      { status: 500 }
    )
  }
}