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
    }>()
    
    // Track unique customers per day
    const customersByDate = new Map<string, Set<string>>()
    // Track first purchase date for each customer
    const customerFirstPurchase = new Map<string, string>()
    
    transactions.forEach((transaction: any) => {
      const dateKey = transaction.createdAt.toISOString().split('T')[0]
      const existing = salesByDate.get(dateKey) || { 
        sales: 0, 
        transactions: 0, 
        avgTicket: 0,
        items: 0,
        newCustomers: 0,
        returningCustomers: 0
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
        returningCustomers: existing.returningCustomers
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
      // Add calculated metrics
      itemsPerTransaction: data.transactions > 0 ? data.items / data.transactions : 0,
      customerConversion: data.newCustomers + data.returningCustomers > 0 ? 
        data.transactions / (data.newCustomers + data.returningCustomers) : 0
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

    // Perform RFM Analysis if requested
    let rfmAnalysis = null
    let customerSegmentation = null
    let hourlyAnalysis = null
    let weekdayAnalysis = null
    let paymentMethodAnalysis = null
    
    if (analysisType !== 'basic' && memberTransactions.length > 0) {
      // RFM Analysis
      const now = new Date()
      const memberRFM = new Map()
      
      // Calculate RFM scores for each member
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
      
      // Get quartiles for RFM values
      const recencyValues = Array.from(memberRFM.values()).map(m => m.recency).sort((a, b) => a - b)
      const frequencyValues = Array.from(memberRFM.values()).map(m => m.transactionCount).sort((a, b) => a - b)
      const monetaryValues = Array.from(memberRFM.values()).map(m => m.totalSpent).sort((a, b) => a - b)
      
      const getQuartiles = (sortedArray: number[]) => {
        if (sortedArray.length === 0) return [0, 0, 0]
        const q1Index = Math.floor(sortedArray.length * 0.25)
        const q2Index = Math.floor(sortedArray.length * 0.5)
        const q3Index = Math.floor(sortedArray.length * 0.75)
        return [sortedArray[q1Index], sortedArray[q2Index], sortedArray[q3Index]]
      }
      
      const [r1, r2, r3] = getQuartiles(recencyValues)
      const [f1, f2, f3] = getQuartiles(frequencyValues)
      const [m1, m2, m3] = getQuartiles(monetaryValues)
      
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
      
      // Convert to array and sort by RFM score
      rfmAnalysis = Array.from(memberRFM.values())
        .sort((a, b) => b.rfmScore - a.rfmScore)
      
      // Calculate averages and prepare thresholds for frontend
      const averages = {
        recency: recencyValues.reduce((sum, val) => sum + val, 0) / recencyValues.length || 0,
        frequency: frequencyValues.reduce((sum, val) => sum + val, 0) / frequencyValues.length || 0,
        monetary: monetaryValues.reduce((sum, val) => sum + val, 0) / monetaryValues.length || 0
      }
      
      // Prepare distribution data
      const distribution: {
        recency: Record<number, number>,
        frequency: Record<number, number>,
        monetary: Record<number, number>
      } = {
        recency: {},
        frequency: {},
        monetary: {}
      }
      
      // Count distribution
      rfmAnalysis.forEach(customer => {
        // Count recency scores
        distribution.recency[customer.recency] = (distribution.recency[customer.recency] || 0) + 1
        // Count frequency scores
        distribution.frequency[customer.frequency] = (distribution.frequency[customer.frequency] || 0) + 1
        // Count monetary scores
        distribution.monetary[customer.monetary] = (distribution.monetary[customer.monetary] || 0) + 1
      })
      
      // Prepare thresholds for frontend display
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
      
      // Add the calculated data to rfmAnalysis object for frontend
      rfmAnalysis = {
        customers: rfmAnalysis,
        averages,
        distribution,
        thresholds
      }
      
      // Customer Segmentation Summary
      const segments = new Map()
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
      
      // Calculate average spent per segment
      segments.forEach((data) => {
        data.avgSpent = data.count > 0 ? data.totalSpent / data.count : 0
      })
      
      customerSegmentation = Array.from(segments.values())
        .sort((a, b) => b.totalSpent - a.totalSpent)
      
      // Process hourly analysis if available
      if (hourlyTransactions && hourlyTransactions.length > 0) {
        const hourlyData = new Array(24).fill(0).map((_, index) => ({
          hour: index,
          count: 0,
          sales: 0
        }))
        
        hourlyTransactions.forEach((row: any) => {
          const hour = parseInt(row.hour)
          if (hour >= 0 && hour < 24) {
            hourlyData[hour].count = parseInt(row.count)
            hourlyData[hour].sales = parseFloat(row.sales)
          }
        })
        
        hourlyAnalysis = hourlyData
      }
      
      // Process weekday analysis if available
      if (weekdayTransactions && weekdayTransactions.length > 0) {
        const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const weekdayData = new Array(7).fill(0).map((_, index) => ({
          day: weekdayNames[index],
          dayNumber: index,
          count: 0,
          sales: 0
        }))
        
        weekdayTransactions.forEach((row: any) => {
          const day = parseInt(row.weekday)
          if (day >= 0 && day < 7) {
            weekdayData[day].count = parseInt(row.count)
            weekdayData[day].sales = parseFloat(row.sales)
          }
        })
        
        weekdayAnalysis = weekdayData
      }
      
      // Process payment method analysis if available
      if (paymentMethods && paymentMethods.length > 0) {
        // Safely log BigInt values by converting them to strings first
        console.log('Raw payment methods data:', JSON.stringify(paymentMethods, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ));
        
        // Convert BigInt values to Number before logging and handle null values
        const safePaymentMethods = paymentMethods.map((row: any) => {
          console.log(`Processing payment method: ${row.paymentMethod}, count: ${row.count}, sales: ${row.sales}`);
          
          // Ensure we have valid numbers by using explicit defaults and Number conversion
          const count = typeof row.count === 'bigint' ? Number(row.count) : Number(row.count || 0);
          let total = 0;
          
          // Handle BigInt, null, undefined, or other types for sales
          if (typeof row.sales === 'bigint') {
            total = Number(row.sales);
          } else if (row.sales !== null && row.sales !== undefined) {
            total = Number(row.sales);
          }
          
          console.log(`Converted values - count: ${count}, total: ${total}`);
          
          return {
            paymentMethod: row.paymentMethod,
            count: isNaN(count) ? 0 : count,
            total: isNaN(total) ? 0 : total
          };
        });
        
        console.log('Safe payment methods:', JSON.stringify(safePaymentMethods, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ));
        
        // Calculate total sales across all payment methods
        const totalSales = safePaymentMethods.reduce((sum: number, row: any) => {
          return sum + row.total; // Already sanitized above
        }, 0);
        
        console.log(`Total sales across all payment methods: ${totalSales}`);
        
        paymentMethodAnalysis = safePaymentMethods.map((row: any) => {
          // Values are already sanitized, no need to check for NaN again
          const item = {
            method: row.paymentMethod,
            count: row.count,
            sales: row.total,
            percentage: totalSales > 0 ? (row.total / totalSales) * 100 : 0
          };
          console.log(`Processed payment method: ${row.paymentMethod}, count: ${row.count}, sales: ${row.total}`);
          return item;
        });
        
        console.log('Final payment method analysis:', JSON.stringify(paymentMethodAnalysis, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ));
      }
    }

    // Create a custom serializer to handle BigInt values
    const bigIntSerializer = (key: string, value: any) => 
      typeof value === 'bigint' ? value.toString() : value;
    
    // Use the serializer with NextResponse.json
    const responseData = {
      salesData,
      categoryData,
      topProducts,
      summary,
      rfmAnalysis,
      customerSegmentation,
      hourlyAnalysis,
      weekdayAnalysis,
      paymentMethodAnalysis
    };
    
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