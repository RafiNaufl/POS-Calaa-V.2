import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
// NextResponse and NextRequest are already imported on line 1
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
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7days'
    const analysisType = searchParams.get('analysisType') || 'basic' // basic, advanced, rfm, trends, segments
    
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
        startDate = startOfDay(subDays(endDate, 7))
    }
    
    // Determine if we need to fetch additional data for advanced analytics
    let memberTransactions: any[] = []
    let hourlyTransactions: any = []
    let weekdayTransactions: any = []
    let paymentMethods: any = []
    let hourlyData: any = []
    let weekdayData: any = []
    let paymentMethodTrends: any = []
    
    // Set RFM analysis start date (default to 1 year ago)
    const rfmStartDate = analysisType !== 'basic' ? subYears(startOfDay(new Date()), 1) : startDate
    
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
        member: true,
        user: true,
        voucherUsages: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    }))
    
    // Get returned transactions for the selected period
    const returnedTransactions = await withRetry(() => prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        status: 'RETURNED'
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
        member: true,
        user: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    }))
    
    // Fetch additional data for advanced analytics if requested
    if (analysisType !== 'basic') {
      // Get member transactions for RFM analysis (going back further in time)
      memberTransactions = await withRetry(() => prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: rfmStartDate,
            lte: endDate
          },
          status: 'COMPLETED',
          memberId: {
            not: null
          }
        },
        include: {
          member: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      }))
      
      // Get hourly transaction trends using raw SQL for better performance
      const hourlyQuery = await withRetry(() => prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM "createdAt") as hour,
          COUNT(*) as count,
          SUM("finalTotal") as sales
        FROM "Transaction"
        WHERE 
          "createdAt" >= ${startDate} AND 
          "createdAt" <= ${endDate} AND
          "status" = 'COMPLETED'
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour
      `)
      hourlyTransactions = hourlyQuery as any[]
      
      // Get weekday transaction trends using raw SQL
      const weekdayQuery = await withRetry(() => prisma.$queryRaw`
        SELECT 
          EXTRACT(DOW FROM "createdAt") as weekday,
          COUNT(*) as count,
          SUM("finalTotal") as sales
        FROM "Transaction"
        WHERE 
          "createdAt" >= ${startDate} AND 
          "createdAt" <= ${endDate} AND
          "status" = 'COMPLETED'
        GROUP BY EXTRACT(DOW FROM "createdAt")
        ORDER BY weekday
      `)
      weekdayTransactions = weekdayQuery as any[]
      
      // Get payment method distribution
      const paymentQuery = await withRetry(() => prisma.$queryRaw`
        SELECT 
          "paymentMethod",
          COUNT(*) as count,
          SUM("finalTotal") as sales,
          (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM "Transaction" 
            WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate} AND "status" = 'COMPLETED')) as percentage
        FROM "Transaction"
        WHERE 
          "createdAt" >= ${startDate} AND 
          "createdAt" <= ${endDate} AND
          "status" = 'COMPLETED'
        GROUP BY "paymentMethod"
        ORDER BY count DESC
      `)
      paymentMethods = paymentQuery as any[]
    }
    
    // Process the transaction data
    
    if (analysisType !== 'basic') {
      // Get all transactions for RFM analysis (1 year period)
      memberTransactions = await withRetry(() => prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: rfmStartDate,
            lte: endDate
          },
          status: 'COMPLETED',
          memberId: { not: null } // Only transactions with members
        },
        include: {
          member: true
        },
        orderBy: {
          createdAt: 'asc'
        }
      }))
      
      // Get hourly transaction distribution
      const hourlyTransactions = await withRetry(() => prisma.$queryRaw`
        SELECT 
          EXTRACT(HOUR FROM "createdAt") as hour,
          COUNT(*) as count,
          SUM("finalTotal") as total
        FROM "Transaction"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
        AND "status" = 'COMPLETED'
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour
      `)
      
      // Get weekday transaction distribution
      const weekdayTransactions = await withRetry(() => prisma.$queryRaw`
        SELECT 
          EXTRACT(DOW FROM "createdAt") as weekday,
          COUNT(*) as count,
          SUM("finalTotal") as total
        FROM "Transaction"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
        AND "status" = 'COMPLETED'
        GROUP BY EXTRACT(DOW FROM "createdAt")
        ORDER BY weekday
      `)
      
      // Get payment method trends
      const paymentMethods = await withRetry(() => prisma.$queryRaw`
        SELECT 
          "paymentMethod",
          COUNT(*) as count,
          SUM("finalTotal") as sales
        FROM "Transaction"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
        AND "status" = 'COMPLETED'
        GROUP BY "paymentMethod"
        ORDER BY count DESC
      `)
      
      hourlyData = hourlyTransactions
      weekdayData = weekdayTransactions
      paymentMethodTrends = paymentMethods
    }

    // Process sales data by date with additional metrics
    const salesByDate = new Map<string, { 
      sales: number; 
      transactions: number; 
      avgTicket: number;
      items: number;
      newCustomers: number;
      returningCustomers: number;
      returnedItems: number;
      returnedAmount: number;
    }>()
    
    // Track unique customers per day
    const customersByDate = new Map<string, Set<string>>()
    // Track first purchase date for each customer
    const customerFirstPurchase = new Map<string, string>()
    // Track returned items and amounts by date
    const returnsByDate = new Map<string, { items: number, amount: number }>()
    
    // Process returned transactions first
    returnedTransactions.forEach((transaction: any) => {
      const dateKey = transaction.createdAt.toISOString().split('T')[0]
      
      // Initialize returns for this date if it doesn't exist
      if (!returnsByDate.has(dateKey)) {
        returnsByDate.set(dateKey, { items: 0, amount: 0 })
      }
      
      // Count returned items and amount
      const returnData = returnsByDate.get(dateKey)!
      const returnedItemCount = transaction.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
      
      returnData.items += returnedItemCount
      returnData.amount += transaction.finalTotal
    })
    
    // Process regular transactions
    transactions.forEach((transaction: any) => {
      const dateKey = transaction.createdAt.toISOString().split('T')[0]
      const existing = salesByDate.get(dateKey) || { 
        sales: 0, 
        transactions: 0, 
        avgTicket: 0,
        items: 0,
        newCustomers: 0,
        returningCustomers: 0,
        returnedItems: returnsByDate.get(dateKey)?.items || 0,
        returnedAmount: returnsByDate.get(dateKey)?.amount || 0
      }
      
      // Count total items sold in this transaction
      const itemCount = transaction.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
      
      // Track customer for this date
      if (transaction.memberId) {
        // Initialize set of customers for this date if it doesn't exist
        if (!customersByDate.has(dateKey)) {
          customersByDate.set(dateKey, new Set())
        }
        customersByDate.get(dateKey)?.add(transaction.memberId)
        
        // Check if this is customer's first purchase
        if (!customerFirstPurchase.has(transaction.memberId)) {
          customerFirstPurchase.set(transaction.memberId, dateKey)
          existing.newCustomers += 1
        } else if (customerFirstPurchase.get(transaction.memberId) !== dateKey) {
          existing.returningCustomers += 1
        }
      }
      
      salesByDate.set(dateKey, {
        sales: existing.sales + transaction.finalTotal,
        transactions: existing.transactions + 1,
        avgTicket: 0, // Will calculate after all transactions are processed
        items: existing.items + itemCount,
        newCustomers: existing.newCustomers,
        returningCustomers: existing.returningCustomers,
        returnedItems: existing.returnedItems,
        returnedAmount: existing.returnedAmount
      })
    })
    
    // Calculate average ticket size
    salesByDate.forEach((data, date) => {
      if (data.transactions > 0) {
        data.avgTicket = data.sales / data.transactions
      }
    })

    const salesData = Array.from(salesByDate.entries()).map(([date, data]) => ({
      date,
      sales: data.sales,
      transactions: data.transactions,
      avgTicket: data.avgTicket,
      items: data.items,
      newCustomers: data.newCustomers,
      returningCustomers: data.returningCustomers,
      returnedItems: data.returnedItems,
      returnedAmount: data.returnedAmount,
      // Add calculated metrics
      itemsPerTransaction: data.transactions > 0 ? data.items / data.transactions : 0,
      customerConversion: data.newCustomers + data.returningCustomers > 0 ? 
        data.transactions / (data.newCustomers + data.returningCustomers) : 0,
      returnRate: data.items > 0 ? (data.returnedItems / data.items) * 100 : 0
    }))

    // Process sales by category with additional metrics
    const salesByCategory = new Map<string, { 
      sales: number; 
      quantity: number; 
      transactions: number;
      customers: Set<string>;
    }>()
    
    // Track which categories were purchased in each transaction
    const categoriesByTransaction = new Map<string, Set<string>>()
    
    transactions.forEach((transaction: any) => {
      const transactionId = transaction.id
      categoriesByTransaction.set(transactionId, new Set())
      
      transaction.items.forEach((item: any) => {
        if (item.product?.category) {
          const categoryName = item.product.category.name
          const saleAmount = item.subtotal
          
          // Initialize category data if it doesn't exist
          if (!salesByCategory.has(categoryName)) {
            salesByCategory.set(categoryName, { 
              sales: 0, 
              quantity: 0, 
              transactions: 0,
              customers: new Set()
            })
          }
          
          const categoryData = salesByCategory.get(categoryName)!
          categoryData.sales += saleAmount
          categoryData.quantity += item.quantity
          
          // Mark this category as included in this transaction
          categoriesByTransaction.get(transactionId)?.add(categoryName)
          
          // Track unique customers for this category
          if (transaction.memberId) {
            categoryData.customers.add(transaction.memberId)
          }
        }
      })
    })
    
    // Count transactions per category
    categoriesByTransaction.forEach((categories, transactionId) => {
      categories.forEach(category => {
        const data = salesByCategory.get(category)!
        data.transactions += 1
      })
    })

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316']
    let colorIndex = 0
    
    const totalCategoryQuantity = Array.from(salesByCategory.values())
      .reduce((sum: number, cat) => sum + cat.quantity, 0)

    const categoryData = Array.from(salesByCategory.entries()).map(([name, stats]) => ({
      name,
      value: totalCategoryQuantity > 0 ? Math.round((stats.quantity / totalCategoryQuantity) * 100) : 0,
      color: colors[colorIndex++ % colors.length],
      sales: stats.sales,
      quantity: stats.quantity,
      transactions: stats.transactions,
      uniqueCustomers: stats.customers.size,
      avgTicket: stats.transactions > 0 ? stats.sales / stats.transactions : 0,
      avgQuantityPerTransaction: stats.transactions > 0 ? stats.quantity / stats.transactions : 0
    }))

    // Process top products with enhanced metrics
    const productStats = new Map<string, { 
      quantity: number; 
      revenue: number; 
      transactions: number;
      customers: Set<string>;
      dates: Set<string>;
    }>()
    
    // Track which products were purchased in each transaction
    const productsByTransaction = new Map<string, Set<string>>()
    
    transactions.forEach((transaction: any) => {
      const transactionId = transaction.id
      const dateKey = transaction.createdAt.toISOString().split('T')[0]
      productsByTransaction.set(transactionId, new Set())
      
      transaction.items.forEach((item: any) => {
        if (item.product) {
          const productId = item.product.id
          const productName = item.product.name
          
          // Initialize product data if it doesn't exist
          if (!productStats.has(productName)) {
            productStats.set(productName, { 
              quantity: 0, 
              revenue: 0, 
              transactions: 0,
              customers: new Set(),
              dates: new Set()
            })
          }
          
          const productData = productStats.get(productName)!
          productData.quantity += item.quantity
          productData.revenue += item.subtotal
          productData.dates.add(dateKey)
          
          // Mark this product as included in this transaction
          productsByTransaction.get(transactionId)?.add(productName)
          
          // Track unique customers for this product
          if (transaction.memberId) {
            productData.customers.add(transaction.memberId)
          }
        }
      })
    })
    
    // Count transactions per product
    productsByTransaction.forEach((products, transactionId) => {
      products.forEach(product => {
        const data = productStats.get(product)!
        data.transactions += 1
      })
    })

    const totalRevenue = Array.from(productStats.values())
      .reduce((sum: number, product) => sum + product.revenue, 0)

    const topProducts = Array.from(productStats.entries())
      .map(([name, stats]) => ({
        name,
        quantity: stats.quantity,
        revenue: stats.revenue,
        transactions: stats.transactions,
        uniqueCustomers: stats.customers.size,
        availabilityDays: stats.dates.size,
        avgQuantityPerTransaction: stats.transactions > 0 ? stats.quantity / stats.transactions : 0,
        avgRevenuePerTransaction: stats.transactions > 0 ? stats.revenue / stats.transactions : 0,
        contribution: totalRevenue > 0 ? Math.round((stats.revenue / totalRevenue) * 100) : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Calculate summary with enhanced metrics
    const totalSales = transactions.reduce((sum: number, t: any) => sum + t.finalTotal, 0)
    const totalTransactions = transactions.length
    const avgTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0
    
    // Count unique customers
    const uniqueCustomers = new Set()
    transactions.forEach((t: any) => {
      if (t.memberId) uniqueCustomers.add(t.memberId)
    })
    const totalUniqueCustomers = uniqueCustomers.size
    
    // Count total items sold
    const totalItems = transactions.reduce((sum: number, t: any) => {
      return sum + t.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0)
    }, 0)
    
    // Calculate total returns and return rate
    const totalReturns = returnedTransactions.length
    const totalReturnAmount = returnedTransactions.reduce((sum: number, t: any) => sum + t.finalTotal, 0)
    const returnRate = totalSales > 0 ? (totalReturnAmount / totalSales) * 100 : 0

    // Calculate growth (compare with previous period)
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
        items: true,
        member: true
      }
    }))
    
    const previousSales = previousTransactions.reduce((sum: number, t: any) => sum + t.finalTotal, 0)
    const previousTransactionCount = previousTransactions.length
    
    // Count unique customers in previous period
    const previousUniqueCustomers = new Set()
    previousTransactions.forEach((t: any) => {
      if (t.memberId) previousUniqueCustomers.add(t.memberId)
    })
    
    // Calculate growth metrics
    const salesGrowth = previousSales > 0 ? ((totalSales - previousSales) / previousSales) * 100 : 0
    const transactionGrowth = previousTransactionCount > 0 ? 
      ((totalTransactions - previousTransactionCount) / previousTransactionCount) * 100 : 0
    const customerGrowth = previousUniqueCustomers.size > 0 ? 
      ((totalUniqueCustomers - previousUniqueCustomers.size) / previousUniqueCustomers.size) * 100 : 0

    const summary = {
      totalSales,
      totalTransactions,
      averageTransaction: Math.round(avgTransaction),
      growth: Math.round(salesGrowth * 100) / 100,
      transactionGrowth: Math.round(transactionGrowth * 100) / 100,
      customerGrowth: Math.round(customerGrowth * 100) / 100,
      totalUniqueCustomers,
      totalItems,
      itemsPerTransaction: totalTransactions > 0 ? totalItems / totalTransactions : 0,
      salesPerCustomer: totalUniqueCustomers > 0 ? totalSales / totalUniqueCustomers : 0,
      transactionsPerCustomer: totalUniqueCustomers > 0 ? totalTransactions / totalUniqueCustomers : 0
    }

    // Define types for advanced analytics
    type RFMCustomer = {
      memberId: string;
      name: string;
      recency: number;
      frequency: number;
      monetary: number;
      transactionCount: number;
      totalSpent: number;
      rfmScore: number;
      segment: string;
    }
    
    type RFMAnalysis = {
      customers: RFMCustomer[];
      averages: {
        recency: number;
        frequency: number;
        monetary: number;
      };
      distribution: {
        recency: Record<number, number>;
        frequency: Record<number, number>;
        monetary: Record<number, number>;
      };
      thresholds: {
        recency: Record<number, number>;
        frequency: Record<number, number>;
        monetary: Record<number, number>;
      };
    }
    
    type CustomerSegment = {
      segment: string;
      count: number;
      totalSpent: number;
      avgSpent: number;
    }
    
    type HourlyAnalysisItem = {
      hour: number;
      count: number;
      sales: number;
    }
    
    type WeekdayAnalysisItem = {
      day: string;
      dayNumber: number;
      count: number;
      sales: number;
    }
    
    type PaymentMethodAnalysisItem = {
      method: string;
      count: number;
      sales: number;
      percentage: number;
    }
    
    // Initialize advanced analytics with proper types
    let rfmAnalysis: RFMAnalysis | null = null
    let customerSegmentation: CustomerSegment[] | null = null
    let hourlyAnalysis: HourlyAnalysisItem[] | null = null
    let weekdayAnalysis: WeekdayAnalysisItem[] | null = null
    let paymentMethodAnalysis: PaymentMethodAnalysisItem[] | null = null
    
    console.log(`Analysis type: ${analysisType}, Member transactions: ${memberTransactions.length}`)
    
    if (analysisType !== 'basic') {
      console.log('Performing advanced analysis...')
      // RFM Analysis
      const now = new Date()
      const memberRFM = new Map()
      
      console.log(`Member transactions count: ${memberTransactions.length}`)
      
      // Calculate RFM scores for each member
      if (memberTransactions.length > 0) {
        memberTransactions.forEach((transaction) => {
          if (!transaction.memberId) return
          
          const memberId = transaction.memberId
          if (!memberRFM.has(memberId)) {
            memberRFM.set(memberId, {
              memberId,
              memberName: transaction.member?.name || 'Unknown',
              lastPurchaseDate: transaction.createdAt,
              totalSpent: transaction.finalTotal,
              transactionCount: 1,
              recency: 0, // Will calculate later
              frequency: 0, // Will calculate later
              monetary: 0, // Will calculate later
              rfmScore: 0, // Will calculate later
              segment: '' // Will calculate later
            })
          } else {
            const memberData = memberRFM.get(memberId)
            memberData.totalSpent += transaction.finalTotal
            memberData.transactionCount += 1
            
            // Update last purchase date if this transaction is more recent
            if (transaction.createdAt > memberData.lastPurchaseDate) {
              memberData.lastPurchaseDate = transaction.createdAt
            }
          }
        })
        
        // Calculate recency in days
        memberRFM.forEach((data) => {
          data.recency = Math.floor(differenceInDays(now, data.lastPurchaseDate))
        })
      } else {
        console.log('No member transactions found for RFM analysis')
      }
      
      // Get quartiles for RFM values
      const recencyValues = Array.from(memberRFM.values()).map(m => m.recency).sort((a, b) => a - b)
      const frequencyValues = Array.from(memberRFM.values()).map(m => m.transactionCount).sort((a, b) => a - b)
      const monetaryValues = Array.from(memberRFM.values()).map(m => m.totalSpent).sort((a, b) => a - b)
      
      console.log(`RFM values count - Recency: ${recencyValues.length}, Frequency: ${frequencyValues.length}, Monetary: ${monetaryValues.length}`)
      
      const getQuartiles = (sortedArray: number[]) => {
        if (sortedArray.length === 0) return [0, 0, 0]
        const q1Index = Math.floor(sortedArray.length * 0.25)
        const q2Index = Math.floor(sortedArray.length * 0.5)
        const q3Index = Math.floor(sortedArray.length * 0.75)
        return [sortedArray[q1Index], sortedArray[q2Index], sortedArray[q3Index]]
      }
      
      // Use default values if arrays are empty
      const [r1, r2, r3] = recencyValues.length > 0 ? getQuartiles(recencyValues) : [7, 14, 30]
      const [f1, f2, f3] = frequencyValues.length > 0 ? getQuartiles(frequencyValues) : [2, 3, 5]
      const [m1, m2, m3] = monetaryValues.length > 0 ? getQuartiles(monetaryValues) : [100000, 300000, 500000]
      
      console.log('RFM Quartiles:', {
        recency: [r1, r2, r3],
        frequency: [f1, f2, f3],
        monetary: [m1, m2, m3]
      })
      
      // Initialize RFM analysis with default values in case there are no customers
      let averageRecency = 0
      let averageFrequency = 0
      let averageMonetary = 0
      
      const recencyDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      const frequencyDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      const monetaryDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
      
      // Only process RFM scores if we have member data
      if (memberRFM.size > 0) {
        console.log(`Processing RFM scores for ${memberRFM.size} members`)
        
        // Assign RFM scores (1-4) to each customer
        memberRFM.forEach((data) => {
          // Recency score (lower is better, so scoring is inverted)
          if (data.recency <= r1) data.recency = 4
          else if (data.recency <= r2) data.recency = 3
          else if (data.recency <= r3) data.recency = 2
          else data.recency = 1
          
          // Frequency score
          if (data.transactionCount >= f3) data.frequency = 4
          else if (data.transactionCount >= f2) data.frequency = 3
          else if (data.transactionCount >= f1) data.frequency = 2
          else data.frequency = 1
          
          // Monetary score
          if (data.totalSpent >= m3) data.monetary = 4
          else if (data.totalSpent >= m2) data.monetary = 3
          else if (data.totalSpent >= m1) data.monetary = 2
          else data.monetary = 1
          
          // Calculate combined RFM score
          data.rfmScore = data.recency * 100 + data.frequency * 10 + data.monetary
          
          // Assign segment based on RFM score
          if (data.recency >= 4 && data.frequency >= 4 && data.monetary >= 4) {
            data.segment = 'Champions'
          } else if (data.recency >= 3 && data.frequency >= 3 && data.monetary >= 3) {
            data.segment = 'Loyal Customers'
          } else if (data.recency >= 3 && data.frequency >= 1 && data.monetary >= 2) {
            data.segment = 'Potential Loyalists'
          } else if (data.recency >= 4 && data.frequency <= 2 && data.monetary <= 2) {
            data.segment = 'New Customers'
          } else if (data.recency >= 3 && data.frequency <= 2 && data.monetary <= 2) {
            data.segment = 'Promising'
          } else if (data.recency <= 2 && data.frequency >= 3 && data.monetary >= 3) {
            data.segment = 'At Risk'
          } else if (data.recency <= 2 && data.frequency >= 2 && data.monetary >= 2) {
            data.segment = 'Need Attention'
          } else if (data.recency <= 1 && data.frequency >= 1 && data.monetary >= 1) {
            data.segment = 'About to Sleep'
          } else if (data.recency <= 1 && data.frequency <= 1 && data.monetary <= 1) {
            data.segment = 'Lost'
          } else {
            data.segment = 'Others'
          }
        })
        
        // Calculate average RFM values
        averageRecency = recencyValues.length > 0 ? recencyValues.reduce((a, b) => a + b, 0) / recencyValues.length : 0
        averageFrequency = frequencyValues.length > 0 ? frequencyValues.reduce((a, b) => a + b, 0) / frequencyValues.length : 0
        averageMonetary = monetaryValues.length > 0 ? monetaryValues.reduce((a, b) => a + b, 0) / monetaryValues.length : 0
        
        // Calculate distribution of customers across RFM scores
      memberRFM.forEach((data) => {
        const r = data.recency as number
        const f = data.frequency as number
        const m = data.monetary as number
        
        if (r >= 1 && r <= 4) recencyDistribution[r]++
        if (f >= 1 && f <= 4) frequencyDistribution[f]++
        if (m >= 1 && m <= 4) monetaryDistribution[m]++
      })
      } else {
        console.log('No members found for RFM analysis, using default values')
      }
      
      // Prepare RFM analysis for frontend
      const averages = {
        recency: averageRecency,
        frequency: averageFrequency,
        monetary: averageMonetary
      }
      
      const distribution = {
        recency: recencyDistribution,
        frequency: frequencyDistribution,
        monetary: monetaryDistribution
      }
      
      const thresholds = {
        recency: {
          1: r3, // Threshold for score 1
          2: r2, // Threshold for score 2
          3: r1  // Threshold for score 3
        },
        frequency: {
          1: f1, // Threshold for score 1
          2: f2, // Threshold for score 2
          3: f3  // Threshold for score 3
        },
        monetary: {
          1: m1, // Threshold for score 1
          2: m2, // Threshold for score 2
          3: m3  // Threshold for score 3
        }
      }
      
      // Create RFM analysis object with default values even if there are no customers
      rfmAnalysis = {
        customers: Array.from(memberRFM.values()),
        averages,
        distribution,
        thresholds
      }
      
      console.log('RFM Analysis created:', {
        hasCustomers: rfmAnalysis.customers.length > 0,
        averages: rfmAnalysis.averages,
        distribution: rfmAnalysis.distribution
      })
      
      // Customer Segmentation Summary
      const segments = new Map()
      
      // Initialize with default segments even if there are no customers
      const defaultSegments = [
        'Champions', 'Loyal Customers', 'Potential Loyalists', 'New Customers',
        'Promising', 'Need Attention', 'About to Sleep', 'At Risk',
        'Lost', 'Others'
      ]
      
      defaultSegments.forEach(segment => {
        segments.set(segment, {
          segment: segment,
          count: 0,
          totalSpent: 0,
          avgSpent: 0
        })
      })
      
      // Process actual customer data if available
      if (rfmAnalysis.customers && rfmAnalysis.customers.length > 0) {
        rfmAnalysis.customers.forEach((customer) => {
          if (!segments.has(customer.segment)) {
            segments.set(customer.segment, {
              segment: customer.segment,
              count: 0,
              totalSpent: 0,
              avgSpent: 0
            })
          }
          
          const segmentData = segments.get(customer.segment)
          segmentData.count += 1
          segmentData.totalSpent += customer.totalSpent
        })
      }
      
      // Calculate average spent per segment
      segments.forEach((data) => {
        data.avgSpent = data.count > 0 ? data.totalSpent / data.count : 0
      })
      
      customerSegmentation = Array.from(segments.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
        
      console.log('Customer Segmentation created:', {
        segmentCount: customerSegmentation.length,
        hasCustomers: customerSegmentation.some(seg => seg.count > 0)
      })
      
      // Initialize hourly analysis with default values (0-23 hours)
       hourlyAnalysis = Array.from({ length: 24 }, (_, i) => ({
         hour: i,
         count: 0,
         sales: 0
       })) as HourlyAnalysisItem[]
      
      // Process hourly analysis if available
      if (hourlyTransactions && hourlyTransactions.length > 0 && hourlyAnalysis) {
        hourlyTransactions.forEach((row: any) => {
          const hour = parseInt(row.hour as string)
          if (hour >= 0 && hour < 24 && hourlyAnalysis) {
            hourlyAnalysis[hour].count = parseInt(row.count as string)
            hourlyAnalysis[hour].sales = parseFloat(row.sales as string)
          }
        })
      }
      
      // Initialize weekday analysis with default values (0-6 days, Sunday-Saturday)
       const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
       weekdayAnalysis = Array.from({ length: 7 }, (_, i) => ({
         day: weekdayNames[i],
         dayNumber: i,
         count: 0,
         sales: 0
       })) as WeekdayAnalysisItem[]
      
      // Process weekday analysis if available
      if (weekdayTransactions && weekdayTransactions.length > 0 && weekdayAnalysis) {
        weekdayTransactions.forEach((row: any) => {
          const day = parseInt(row.weekday as string)
          if (day >= 0 && day < 7 && weekdayAnalysis) {
            weekdayAnalysis[day].count = parseInt(row.count as string)
            weekdayAnalysis[day].sales = parseFloat(row.sales as string)
          }
        })
      }
      
      // Initialize payment method analysis with default values
       paymentMethodAnalysis = [
         { method: 'CASH', count: 0, sales: 0, percentage: 0 },
         { method: 'TRANSFER', count: 0, sales: 0, percentage: 0 },
         { method: 'QRIS', count: 0, sales: 0, percentage: 0 },
         { method: 'CREDIT_CARD', count: 0, sales: 0, percentage: 0 },
         { method: 'DEBIT_CARD', count: 0, sales: 0, percentage: 0 }
       ] as PaymentMethodAnalysisItem[]
      
      // Process payment method analysis if available
      if (paymentMethods && paymentMethods.length > 0) {
        // Create a map to store payment method data
        const methodMap = new Map<string, { count: number, sales: number }>()
        
        // Initialize with default methods
        paymentMethodAnalysis.forEach(item => {
          methodMap.set(item.method, { count: 0, sales: 0 })
        })
        
        // Safely log BigInt values by converting them to strings first
        console.log('Raw payment methods data:', JSON.stringify(paymentMethods, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ));
        
        // Process payment methods data
        paymentMethods.forEach((method: any) => {
          const methodName = method.paymentMethod as string
          const count = typeof method.count === 'bigint' ? Number(method.count) : Number(method.count || 0)
          let sales = 0
          
          // Handle BigInt, null, undefined, or other types for sales
          if (typeof method.sales === 'bigint') {
            sales = Number(method.sales)
          } else if (method.sales !== null && method.sales !== undefined) {
            sales = Number(method.sales)
          }
          
          if (methodMap.has(methodName)) {
            const current = methodMap.get(methodName)!
            methodMap.set(methodName, {
              count: current.count + count,
              sales: current.sales + sales
            })
          } else {
            methodMap.set(methodName, { count, sales })
          }
        })
        
        // Calculate total sales for percentage
        const totalSales = Array.from(methodMap.values()).reduce((sum, method) => sum + method.sales, 0)
        
        // Convert map to array and calculate percentages
        paymentMethodAnalysis = Array.from(methodMap.entries()).map(([method, data]) => ({
          method,
          count: data.count,
          sales: data.sales,
          percentage: totalSales > 0 ? (data.sales / totalSales) * 100 : 0
        })) as PaymentMethodAnalysisItem[]
        
        // Sort by sales
        paymentMethodAnalysis.sort((a, b) => b.sales - a.sales)
        
        console.log('Final payment method analysis:', JSON.stringify(paymentMethodAnalysis, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ));
      }
      
      console.log('Time-based analyses created:', {
        hourlyAnalysisLength: hourlyAnalysis.length,
        weekdayAnalysisLength: weekdayAnalysis.length,
        paymentMethodAnalysisLength: paymentMethodAnalysis.length
      })
    }

    // Create a custom serializer to handle BigInt values
    const bigIntSerializer = (key: string, value: any) => 
      typeof value === 'bigint' ? value.toString() : value;
    
    // Process product variant data (size and color)
    const sizeStats = new Map<string, { quantity: number; revenue: number; }>()
    const colorStats = new Map<string, { quantity: number; revenue: number; }>()
    
    // Process all transactions (including regular and returned)
    const allTransactions = [...transactions, ...returnedTransactions]
    
    allTransactions.forEach((transaction: any) => {
      transaction.items.forEach((item: any) => {
        if (item.product) {
          const size = item.product.size || 'Unknown'
          const color = item.product.color || 'Unknown'
          const quantity = item.quantity
          const revenue = item.subtotal
          
          // Process size data
          if (!sizeStats.has(size)) {
            sizeStats.set(size, { quantity: 0, revenue: 0 })
          }
          const sizeData = sizeStats.get(size)!
          sizeData.quantity += quantity
          sizeData.revenue += revenue
          
          // Process color data
          if (!colorStats.has(color)) {
            colorStats.set(color, { quantity: 0, revenue: 0 })
          }
          const colorData = colorStats.get(color)!
          colorData.quantity += quantity
          colorData.revenue += revenue
        }
      })
    })
    
    // Convert maps to arrays for the response
    const sizeData = Array.from(sizeStats.entries())
      .map(([size, stats]) => ({
        name: size,
        quantity: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
    
    const colorData = Array.from(colorStats.entries())
      .map(([color, stats]) => ({
        name: color,
        quantity: stats.quantity,
        revenue: stats.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
    
    // Process cashier performance data
    const cashierStats = new Map<string, { 
      name: string;
      transactions: number;
      sales: number;
      items: number;
      avgTicket: number;
      returns: number;
      returnAmount: number;
    }>()
    
    allTransactions.forEach((transaction: any) => {
      if (transaction.user) {
        const userId = transaction.user.id
        const userName = transaction.user.name
        
        if (!cashierStats.has(userId)) {
          cashierStats.set(userId, { 
            name: userName,
            transactions: 0,
            sales: 0,
            items: 0,
            avgTicket: 0,
            returns: 0,
            returnAmount: 0
          })
        }
        
        const cashierData = cashierStats.get(userId)!
        const itemCount = transaction.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
        
        if (transaction.status === 'COMPLETED') {
          cashierData.transactions += 1
          cashierData.sales += transaction.finalTotal
          cashierData.items += itemCount
        } else if (transaction.status === 'RETURNED') {
          cashierData.returns += 1
          cashierData.returnAmount += transaction.finalTotal
        }
      }
    })
    
    // Calculate average ticket for each cashier
    cashierStats.forEach((data) => {
      if (data.transactions > 0) {
        data.avgTicket = data.sales / data.transactions
      }
    })
    
    const cashierPerformance = Array.from(cashierStats.values())
      .sort((a, b) => b.sales - a.sales)
    
    // Define promotion analysis item type
    type PromotionAnalysisItem = {
      name: string;
      type: string;
      discountValue: number;
      discountType: string;
      totalDiscount: number;
      usageCount: number;
      affectedTransactions: number;
      averageDiscount: number;
      discountedProducts?: DiscountedProductItem[];
    }
    
    // Define discounted product item type
    type DiscountedProductItem = {
      productId: string;
      productName: string;
      quantity: number;
      totalDiscount: number;
      categoryName: string;
    }

    // Define response data type
    type ResponseData = {
      salesData: any[];
      categoryData: any[];
      topProducts: any[];
      summary: any;
      rfmAnalysis?: RFMAnalysis;
      customerSegmentation?: CustomerSegment[];
      hourlyAnalysis?: HourlyAnalysisItem[];
      weekdayAnalysis?: WeekdayAnalysisItem[];
      paymentMethodAnalysis?: PaymentMethodAnalysisItem[];
      productVariantAnalysis?: {
        sizeData: any[];
        colorData: any[];
      };
      cashierPerformance?: any[];
      returnData?: {
        totalReturns: number;
        totalReturnAmount: number;
        returnRate: number;
      };
      promotionAnalysis?: PromotionAnalysisItem[];
    }
    
    // Process promotion data
    const promotionStats = new Map<string, {
      name: string;
      type: string;
      discountValue: number;
      discountType: string;
      totalDiscount: number;
      usageCount: number;
      affectedTransactions: number;
      averageDiscount: number;
      discountedProducts: Map<string, DiscountedProductItem>;
    }>();

    // Process all transactions to gather promotion data
    transactions.forEach((transaction: any) => {
      if (transaction.promoDiscount > 0) {
        // Try to extract promotion info from transaction metadata or related tables
        // This is a simplified approach - in a real implementation, you would need to
        // fetch the actual promotion data that was applied to each transaction
        
        // For now, we'll create a generic "Unknown Promotion" entry if we can't identify the specific promotion
        const promoId = 'unknown';
        const promoName = 'Promosi';
        const promoType = 'UNKNOWN';
        const discountValue = transaction.promoDiscount;
        const discountType = 'FIXED';
        
        if (!promotionStats.has(promoId)) {
          promotionStats.set(promoId, {
            name: promoName,
            type: promoType,
            discountValue: discountValue,
            discountType: discountType,
            totalDiscount: 0,
            usageCount: 0,
            affectedTransactions: 0,
            averageDiscount: 0,
            discountedProducts: new Map<string, DiscountedProductItem>()
          });
        }
        
        const promoData = promotionStats.get(promoId)!;
        promoData.totalDiscount += transaction.promoDiscount;
        promoData.usageCount += 1;
        promoData.affectedTransactions += 1;
        
        // Calculate discount per item proportionally based on item price
        const totalTransactionValue = transaction.items.reduce((sum: number, item: any) => sum + item.subtotal, 0);
        
        // Only process if there are items and a valid total
        if (transaction.items.length > 0 && totalTransactionValue > 0) {
          transaction.items.forEach((item: any) => {
            if (item.product) {
              const productId = item.product.id;
              const productName = item.product.name;
              const categoryName = item.product.category?.name || 'Uncategorized';
              
              // Calculate proportional discount for this item
              const itemProportion = item.subtotal / totalTransactionValue;
              const itemDiscount = transaction.promoDiscount * itemProportion;
              
              // Add or update product in the discounted products map
              if (!promoData.discountedProducts.has(productId)) {
                promoData.discountedProducts.set(productId, {
                  productId,
                  productName,
                  quantity: 0,
                  totalDiscount: 0,
                  categoryName
                });
              }
              
              const productData = promoData.discountedProducts.get(productId)!;
              productData.quantity += item.quantity;
              productData.totalDiscount += itemDiscount;
            }
          });
        }
      }
    });
    
    // Calculate average discount for each promotion
    promotionStats.forEach((data) => {
      if (data.usageCount > 0) {
        data.averageDiscount = data.totalDiscount / data.usageCount;
      }
    });
    
    // Convert map to array for the response
    const promotionAnalysis = Array.from(promotionStats.values())
      .map(promo => {
        // Convert discounted products map to array and sort by total discount
        const discountedProducts = Array.from(promo.discountedProducts.values())
          .sort((a, b) => b.totalDiscount - a.totalDiscount);
        
        // Return promotion with discounted products array
        return {
          name: promo.name,
          type: promo.type,
          discountValue: promo.discountValue,
          discountType: promo.discountType,
          totalDiscount: promo.totalDiscount,
          usageCount: promo.usageCount,
          affectedTransactions: promo.affectedTransactions,
          averageDiscount: promo.averageDiscount,
          discountedProducts: discountedProducts
        };
      })
      .sort((a, b) => b.totalDiscount - a.totalDiscount);

    // Prepare response data
    const responseData: ResponseData = {
      salesData,
      categoryData,
      topProducts,
      summary,
      // Always include product variant analysis and cashier performance
      productVariantAnalysis: {
        sizeData,
        colorData
      },
      cashierPerformance,
      returnData: {
        totalReturns: returnedTransactions.length,
        totalReturnAmount,
        returnRate
      },
      promotionAnalysis
    };
    
    // Add advanced analytics if requested
    if (analysisType !== 'basic') {
      // Always include these fields, even if they contain default/empty values
      responseData.rfmAnalysis = rfmAnalysis || {
        customers: [],
        averages: { recency: 0, frequency: 0, monetary: 0 },
        distribution: { recency: {}, frequency: {}, monetary: {} },
        thresholds: { recency: {}, frequency: {}, monetary: {} }
      };
      
      responseData.customerSegmentation = customerSegmentation || [];
      responseData.hourlyAnalysis = hourlyAnalysis || [];
      responseData.weekdayAnalysis = weekdayAnalysis || [];
      responseData.paymentMethodAnalysis = paymentMethodAnalysis || [];
      
      console.log('Advanced analytics included in response:', {
        hasRfmAnalysis: !!responseData.rfmAnalysis,
        hasCustomerSegmentation: !!responseData.customerSegmentation,
        hasHourlyAnalysis: !!responseData.hourlyAnalysis,
        hasWeekdayAnalysis: !!responseData.weekdayAnalysis,
        hasPaymentMethodAnalysis: !!responseData.paymentMethodAnalysis,
        hasProductVariantAnalysis: !!responseData.productVariantAnalysis,
        hasCashierPerformance: !!responseData.cashierPerformance,
        hasReturnData: !!responseData.returnData
      });
    }
    
    // Log the analysis type and advanced analytics data
    console.log(`API Response for analysisType=${analysisType}:`, {
      hasRfmAnalysis: rfmAnalysis !== null,
      hasCustomerSegmentation: customerSegmentation !== null,
      hasHourlyAnalysis: hourlyAnalysis !== null,
      hasWeekdayAnalysis: weekdayAnalysis !== null,
      hasPaymentMethodAnalysis: paymentMethodAnalysis !== null
    });
    
    // Apply BigInt serialization before passing to NextResponse
    const serializedData = JSON.parse(JSON.stringify(responseData, bigIntSerializer));
    return NextResponse.json(serializedData, { status: 200 })
  } catch (error) {
    console.error('Error fetching report data:', error)
    
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
      { error: 'Failed to fetch report data' },
      { status: 500 }
    )
  }
}