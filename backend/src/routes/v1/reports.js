const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const db = require('../../../../models')
const { Op } = require('sequelize')

const router = Router()

// Safe numeric coercion that avoids relying on a possibly shadowed global Number
function asNumber(v, def = 0) {
  const n = +(v ?? def)
  return isFinite(n) ? n : def
}

async function ensureOperationalExpenseTable() {
  try {
    await db.sequelize.getQueryInterface().describeTable('operational_expense')
  } catch (error) {
    try {
      await db.OperationalExpense.sync()
      console.log('[Express] operational_expense table created via sync (reports)')
    } catch (syncError) {
      console.warn('[Express] Failed to ensure operational_expense table:', syncError)
    }
  }
}

function computeStartDate(range, endDate) {
  const days = range === '7days' ? 7 : range === '30days' ? 30 : range === '3months' ? 90 : range === '1year' ? 365 : 30
  const start = new Date(endDate)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return start
}

function computePrevPeriod(startDate, endDate) {
  // Align to midnight boundaries
  const startMid = new Date(startDate); startMid.setHours(0,0,0,0)
  const endMid = new Date(endDate); endMid.setHours(0,0,0,0)
  // Compute inclusive day span of current period
  const ms = Math.max(0, endMid.getTime() - startMid.getTime())
  const days = Math.max(1, Math.round(ms / (24*3600*1000)) + 1)
  // Previous period ends just before current period starts
  const prevEnd = new Date(startMid.getTime() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1)); prevStart.setHours(0,0,0,0)
  return { prevStart, prevEnd }
}

router.get('/financial', authMiddleware, async (req, res) => {
  try {
    const range = String(req.query.range || '30days')
    const endDate = new Date(); endDate.setHours(23,59,59,999)
    const startDate = computeStartDate(range, endDate)
    // Local numeric helper to avoid any accidental shadowing of global helpers
    const num = (v, def = 0) => { const n = +(v ?? def); return isFinite(n) ? n : def }

    // Preload category id->name map for robust fallback when association is missing
    const allCategories = await db.Category.findAll({ attributes: ['id', 'name'] })
    const categoryIdToName = new Map(allCategories.map(c => [String(c.id), String(c.name)]))

    // Current period transactions
    const transactions = await db.Transaction.findAll({
      where: {
        createdAt: { [Op.gte]: startDate, [Op.lte]: endDate },
        status: 'COMPLETED'
      },
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product', include: [{ model: db.Category, as: 'category' }] }] }
      ],
      order: [['createdAt', 'ASC']]
    })

    // Revenue metrics
    const grossSales = transactions.reduce((sum, t) => sum + num(t.total, 0), 0)
    const discountsRegular = transactions.reduce((sum, t) => sum + num(t.discount, 0), 0)
    const discountsVoucher = transactions.reduce((sum, t) => sum + num(t.voucherDiscount, 0), 0)
    const discountsPromo = transactions.reduce((sum, t) => sum + num(t.promoDiscount, 0), 0)
    const totalDiscounts = discountsRegular + discountsVoucher + discountsPromo
    const netSales = grossSales - totalDiscounts
    const taxes = transactions.reduce((sum, t) => sum + num(t.tax, 0), 0)
    const totalRevenue = transactions.reduce((sum, t) => sum + num(t.finalTotal, 0), 0)

    // Costs / COGS
    let costOfGoodsSold = 0
    const cogsByCategory = {}
    const revenueByCategory = {}
    const profitByCategory = {}
    // Additional per-category metrics for frontend fallback
    const quantityByCategory = {}
    const txPerCategoryFin = {}
    const customersPerCategoryFin = {}
    transactions.forEach((t) => {
      (t.items || []).forEach((item) => {
        const costPrice = num(item.product?.costPrice, 0)
        const qty = num(item.quantity, 0)
        const subtotal = num(item.subtotal ?? (qty * num(item.price, 0)), 0)
        const catName = item.product?.category?.name || (categoryIdToName.get(String(item.product?.categoryId)) || 'Uncategorized')
        const itemCogs = num(costPrice, 0) * qty
        costOfGoodsSold += itemCogs
        cogsByCategory[catName] = (cogsByCategory[catName] || 0) + itemCogs
        revenueByCategory[catName] = (revenueByCategory[catName] || 0) + subtotal
        profitByCategory[catName] = (profitByCategory[catName] || 0) + (subtotal - itemCogs)
        quantityByCategory[catName] = (quantityByCategory[catName] || 0) + qty
        // Track transactions and unique customers per category (avoid double count using Set)
        const txId = String(t.id)
        const custId = typeof t.get === 'function' ? (t.get('memberId') ?? t.get('userId')) : (t.memberId ?? t.userId)
        if (!txPerCategoryFin[catName]) txPerCategoryFin[catName] = new Set()
        txPerCategoryFin[catName].add(txId)
        if (!customersPerCategoryFin[catName]) customersPerCategoryFin[catName] = new Set()
        if (custId) customersPerCategoryFin[catName].add(String(custId))
      })
    })

    // Convert Sets to counts for response
    const transactionsByCategory = Object.fromEntries(Object.entries(txPerCategoryFin).map(([k, v]) => [k, v.size]))
    const uniqueCustomersByCategory = Object.fromEntries(Object.entries(customersPerCategoryFin).map(([k, v]) => [k, v.size]))

    // Operating expenses
    await ensureOperationalExpenseTable()
    const expenses = await db.OperationalExpense.findAll({
      where: { date: { [Op.gte]: startDate, [Op.lte]: endDate } },
      order: [['date', 'ASC']]
    })
    const operatingExpenses = {}
    let totalOperatingExpenses = 0
    expenses.forEach((e) => {
      const cat = String(e.category || 'Other')
      const amt = num(e.amount, 0)
      operatingExpenses[cat] = (operatingExpenses[cat] || 0) + amt
      totalOperatingExpenses += amt
    })

    // Daily breakdown
    const dailyMap = new Map()
    // Helper: get date key at midnight
    const toDateKey = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x.toISOString() }
    // Pre-aggregate operating expenses per day
    const expenseByDate = new Map()
    expenses.forEach(e => {
      const key = toDateKey(e.date)
      const amt = num(e.amount, 0)
      expenseByDate.set(key, (expenseByDate.get(key) || 0) + amt)
    })
    // Aggregate transactions per day
    transactions.forEach(t => {
      const key = toDateKey(t.createdAt)
      const cur = dailyMap.get(key) || {
        date: key,
        grossSales: 0,
        discounts: 0,
        netSales: 0,
        taxes: 0,
        cogs: 0,
        operatingExpenses: 0,
        grossProfit: 0,
        operatingProfit: 0
      }
      const gross = num(t.total, 0)
      const disc = num(t.discount, 0) + num(t.voucherDiscount, 0) + num(t.promoDiscount, 0)
      const net = gross - disc
      cur.grossSales += gross
      cur.discounts += disc
      cur.netSales += net
      cur.taxes += num(t.tax, 0)
      // COGS by items for this transaction date
      ;(t.items || []).forEach(item => {
        try {
          const costPrice = +((item.product?.costPrice) ?? 0);
          const qty = +((item.quantity) ?? 0);
          const cp = isFinite(costPrice) ? costPrice : 0;
          const q = isFinite(qty) ? qty : 0;
          cur.cogs += cp * q;
        } catch (err) {
          console.error('[Express] items loop error:', err)
        }
      })
      dailyMap.set(key, cur)
    })
    // Attach operating expenses and compute profits per day
    dailyMap.forEach((v, key) => {
      const opx = num(expenseByDate.get(key) ?? 0, 0)
      v.operatingExpenses = opx
      v.grossProfit = v.netSales - v.cogs
      v.operatingProfit = v.grossProfit - opx
    })
    const daily = Array.from(dailyMap.values()).sort((a, b) => (new Date(a.date)) - (new Date(b.date)))

    // Profitability
    const grossProfit = netSales - costOfGoodsSold
    const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0
    const operatingProfit = grossProfit - totalOperatingExpenses
    const operatingProfitMargin = netSales > 0 ? (operatingProfit / netSales) * 100 : 0
    const netProfit = operatingProfit
    const profitMargin = netSales > 0 ? (netProfit / netSales) * 100 : 0

    // Growth vs previous period (simple sales/profit % change)
    const { prevStart, prevEnd } = computePrevPeriod(startDate, endDate)
    const prevTransactions = await db.Transaction.findAll({
      where: { createdAt: { [Op.gte]: prevStart, [Op.lte]: prevEnd }, status: 'COMPLETED' },
      include: [{ model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] }]
    })
    const prevGrossSales = prevTransactions.reduce((sum, t) => sum + num(t.total, 0), 0)
    const prevDiscounts = prevTransactions.reduce((sum, t) => sum + num(t.discount, 0) + num(t.voucherDiscount, 0) + num(t.promoDiscount, 0), 0)
    const prevNetSales = prevGrossSales - prevDiscounts
    let prevCogs = 0
    prevTransactions.forEach((t) => (t.items || []).forEach((item) => { prevCogs += num(item.product?.costPrice, 0) * num(item.quantity, 0) }))
    const prevGrossProfit = prevNetSales - prevCogs
    const growthSales = prevNetSales > 0 ? ((netSales - prevNetSales) / prevNetSales) * 100 : (netSales > 0 ? 100 : 0)
    const growthProfit = prevGrossProfit > 0 ? ((grossProfit - prevGrossProfit) / prevGrossProfit) * 100 : (grossProfit > 0 ? 100 : 0)

    res.json({
      period: { startDate, endDate },
      revenue: {
        grossSales,
        discounts: {
          regular: discountsRegular,
          voucher: discountsVoucher,
          promo: discountsPromo,
          total: totalDiscounts
        },
        netSales,
        taxes,
        totalRevenue
      },
      costs: {
        costOfGoodsSold,
        cogsByCategory
      },
      profitability: {
        grossProfit,
        grossProfitMargin,
        operatingExpenses,
        totalOperatingExpenses,
        operatingProfit,
        operatingProfitMargin,
        netProfit,
        profitMargin
      },
      categoryAnalysis: {
        revenue: revenueByCategory,
        profit: profitByCategory,
        quantity: quantityByCategory,
        transactions: transactionsByCategory,
        uniqueCustomers: uniqueCustomersByCategory
      },
      growth: {
        sales: growthSales,
        profit: growthProfit
      },
      daily
    })
  } catch (err) {
    console.error('[Express] Error generating financial report:', err)
    res.status(500).json({ error: 'Failed to generate financial report' })
  }
})

// Sales and analytics report (root) - compatible with Next API /app/api/reports
router.get('/', authMiddleware, async (req, res) => {
  try {
    const range = String(req.query.range || '7days')
    const analysisType = String(req.query.analysisType || 'basic')
    const endDate = new Date(); endDate.setHours(23,59,59,999)
    const startDate = computeStartDate(range, endDate)

    // Preload category id->name map for robust fallback when association is missing
    const allCategories = await db.Category.findAll({ attributes: ['id', 'name'] })
    const categoryIdToName = new Map(allCategories.map(c => [String(c.id), String(c.name)]))

    const transactions = await db.Transaction.findAll({
      where: {
        createdAt: { [Op.gte]: startDate, [Op.lte]: endDate },
        status: 'COMPLETED'
      },
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product', include: [{ model: db.Category, as: 'category' }] }] },
        // Limit selected columns for member to avoid referencing non-existent columns (e.g., isActive)
        { model: db.Member, as: 'member', attributes: ['id', 'name', 'email', 'phone', 'points'] },
        { model: db.User, as: 'user' }
      ],
      order: [['createdAt', 'ASC']]
    })

    // Summary metrics
    const totalSales = transactions.reduce((sum, t) => sum + Number(t.finalTotal || 0), 0)
    const totalTransactions = transactions.length
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0

    // Previous period for growth
    const { prevStart, prevEnd } = computePrevPeriod(startDate, endDate)
    const prevTransactions = await db.Transaction.findAll({
      where: { createdAt: { [Op.gte]: prevStart, [Op.lte]: prevEnd }, status: 'COMPLETED' },
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product', include: [{ model: db.Category, as: 'category' }] }] }
      ]
    })
    const prevTotalSales = prevTransactions.reduce((sum, t) => sum + Number(t.finalTotal || 0), 0)
    const growth = prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : (totalSales > 0 ? 100 : 0)

    // Unique customers (members preferred, fallback to user)
    const customerIds = new Set()
    transactions.forEach(t => {
      const id = typeof t.get === 'function'
        ? (t.get('memberId') ?? t.get('userId'))
        : (t.memberId ?? t.userId)
      if (id) customerIds.add(String(id))
    })
    const totalUniqueCustomers = customerIds.size

    const summary = {
      totalSales,
      totalTransactions,
      averageTransaction,
      growth,
      salesGrowth: growth,
      transactionGrowth: (() => {
        const prevCount = prevTransactions.length
        const currCount = transactions.length
        return prevCount > 0 ? ((currCount - prevCount) / prevCount) * 100 : (currCount > 0 ? 100 : 0)
      })(),
      customerGrowth: (() => {
        const prevCustomers = new Set(prevTransactions.map(t => String((t.memberId ?? t.userId) || '')))
        prevCustomers.delete('')
        const currCustomers = new Set(transactions.map(t => String((t.memberId ?? t.userId) || '')))
        currCustomers.delete('')
        const prevUnique = prevCustomers.size
        const currUnique = currCustomers.size
        return prevUnique > 0 ? ((currUnique - prevUnique) / prevUnique) * 100 : (currUnique > 0 ? 100 : 0)
      })(),
      totalUniqueCustomers
    }

    // Sales by date
    const salesMap = new Map()
    transactions.forEach(t => {
      const d = new Date(t.createdAt)
      d.setHours(0,0,0,0)
      const key = d.toISOString()
      const cur = salesMap.get(key) || { sales: 0, transactions: 0 }
      cur.sales += Number(t.finalTotal || 0)
      cur.transactions += 1
      salesMap.set(key, cur)
    })
    const salesData = Array.from(salesMap.entries()).map(([date, v]) => ({ date, sales: v.sales, transactions: v.transactions }))

    // Category distribution
    const categoryStats = {}
    const txPerCategory = {}
    const customerPerCategory = {}
    transactions.forEach(t => {
      const txId = String(t.id)
      const custId = typeof t.get === 'function'
        ? (t.get('memberId') ?? t.get('userId'))
        : (t.memberId ?? t.userId)
      (t.items || []).forEach(item => {
        const catName = item.product?.category?.name || (categoryIdToName.get(String(item.product?.categoryId)) || 'Uncategorized')
        const qty = Number(item.quantity || 0)
        const subtotal = Number(item.subtotal || (qty * Number(item.price || 0)))
        if (!categoryStats[catName]) categoryStats[catName] = { sales: 0, quantity: 0, transactions: 0 }
        categoryStats[catName].sales += subtotal
        categoryStats[catName].quantity += qty
        if (!txPerCategory[catName]) txPerCategory[catName] = new Set()
        txPerCategory[catName].add(txId)
        if (!customerPerCategory[catName]) customerPerCategory[catName] = new Set()
        if (custId) customerPerCategory[catName].add(String(custId))
      })
    })
    const categoryData = Object.entries(categoryStats).map(([name, stat], idx) => {
      const txCount = txPerCategory[name]?.size || 0
      const uniqueCust = customerPerCategory[name]?.size || 0
      const percentage = totalSales > 0 ? (stat.sales / totalSales) * 100 : 0
      return {
        name,
        value: Number.isFinite(percentage) ? Number(percentage.toFixed(1)) : 0,
        sales: stat.sales,
        quantity: stat.quantity,
        transactions: txCount,
        uniqueCustomers: uniqueCust
      }
    })

    // Top products
    const productStats = {}
    const txPerProduct = {}
    const customerPerProduct = {}
    transactions.forEach(t => {
      const txId = String(t.id)
      const custId = typeof t.get === 'function'
        ? (t.get('memberId') ?? t.get('userId'))
        : (t.memberId ?? t.userId)
      ;(t.items || []).forEach(item => {
        const name = item.product?.name || 'Unknown Product'
        const qty = Number(item.quantity || 0)
        const revenue = Number(item.subtotal || (qty * Number(item.price || 0)))
        if (!productStats[name]) productStats[name] = { quantity: 0, revenue: 0 }
        productStats[name].quantity += qty
        productStats[name].revenue += revenue
        if (!txPerProduct[name]) txPerProduct[name] = new Set()
        txPerProduct[name].add(txId)
        if (!customerPerProduct[name]) customerPerProduct[name] = new Set()
        if (custId) customerPerProduct[name].add(String(custId))
      })
    })
    const topProducts = Object.entries(productStats)
      .map(([name, stat]) => ({
        name,
        quantity: stat.quantity,
        revenue: stat.revenue,
        transactions: txPerProduct[name]?.size || 0,
        uniqueCustomers: customerPerProduct[name]?.size || 0
      }))
      .sort((a, b) => (b.quantity - a.quantity) || (b.revenue - a.revenue))
      .slice(0, 10)

    // Product variant analysis: size and color distribution
    const sizeStats = {}
    const colorStats = {}
    const txPerSize = {}
    const txPerColor = {}
    transactions.forEach(t => {
      const txId = String(t.id)
      ;(t.items || []).forEach(item => {
        const qty = Number(item.quantity || 0)
        const revenue = Number(item.subtotal || (qty * Number(item.price || 0)))
        const sizeName = String(item.product?.size || 'UNKNOWN')
        const colorName = String(item.product?.color || 'UNKNOWN')

        if (!sizeStats[sizeName]) sizeStats[sizeName] = { quantity: 0, revenue: 0 }
        sizeStats[sizeName].quantity += qty
        sizeStats[sizeName].revenue += revenue
        if (!txPerSize[sizeName]) txPerSize[sizeName] = new Set()
        txPerSize[sizeName].add(txId)

        if (!colorStats[colorName]) colorStats[colorName] = { quantity: 0, revenue: 0 }
        colorStats[colorName].quantity += qty
        colorStats[colorName].revenue += revenue
        if (!txPerColor[colorName]) txPerColor[colorName] = new Set()
        txPerColor[colorName].add(txId)
      })
    })
    const sizeData = Object.entries(sizeStats)
      .map(([name, stat]) => ({
        name,
        quantity: stat.quantity,
        revenue: stat.revenue,
        transactions: txPerSize[name]?.size || 0
      }))
      .sort((a, b) => (b.revenue - a.revenue) || (b.quantity - a.quantity))
    const colorData = Object.entries(colorStats)
      .map(([name, stat]) => ({
        name,
        quantity: stat.quantity,
        revenue: stat.revenue,
        transactions: txPerColor[name]?.size || 0
      }))
      .sort((a, b) => (b.revenue - a.revenue) || (b.quantity - a.quantity))

    // Returns within period (optional)
    const returnedTransactions = await db.Transaction.findAll({
      where: { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate }, status: 'REFUNDED' }
    })
    const totalReturns = returnedTransactions.length
    const totalReturnAmount = returnedTransactions.reduce((sum, t) => sum + Number(t.finalTotal || 0), 0)
    const returnRate = (totalReturns + totalTransactions) > 0 ? (totalReturns * 100) / (totalReturns + totalTransactions) : 0

    const baseResponse = {
      summary,
      salesData,
      categoryData,
      topProducts,
      productVariantAnalysis: { sizeData, colorData, period: { startDate, endDate } },
      returnData: { totalReturns, totalReturnAmount, returnRate },
      promotionAnalysis: []
    }

    // Advanced analytics: hourly/weekday trends, payment methods, and RFM
    if (analysisType !== 'basic') {
      // Hourly analysis (0-23)
      const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, transactions: 0, sales: 0 }))
      transactions.forEach(t => {
        const d = new Date(t.createdAt)
        const h = d.getHours()
        if (h >= 0 && h < 24) {
          hourlyBuckets[h].transactions += 1
          hourlyBuckets[h].sales += Number(t.finalTotal || 0)
        }
      })

      // Weekday analysis (0=Sunday .. 6=Saturday)
      const weekdayBuckets = Array.from({ length: 7 }, (_, i) => ({ day: i, transactions: 0, sales: 0 }))
      transactions.forEach(t => {
        const d = new Date(t.createdAt)
        const w = d.getDay()
        weekdayBuckets[w].transactions += 1
        weekdayBuckets[w].sales += Number(t.finalTotal || 0)
      })

      // Payment method distribution
      const methodMap = new Map()
      const defaultMethods = ['CASH', 'CARD', 'QRIS', 'BANK_TRANSFER', 'MIDTRANS', 'VIRTUAL_ACCOUNT', 'CONVENIENCE_STORE', 'PAYLATER']
      defaultMethods.forEach(m => methodMap.set(m, { method: m, count: 0, sales: 0 }))
      transactions.forEach(t => {
        const method = String(t.paymentMethod || 'CASH').toUpperCase()
        const cur = methodMap.get(method) || { method, count: 0, sales: 0 }
        cur.count += 1
        cur.sales += Number(t.finalTotal || 0)
        methodMap.set(method, cur)
      })
      const totalSalesAll = Array.from(methodMap.values()).reduce((s, m) => s + Number(m.sales || 0), 0)
      const paymentMethodAnalysis = Array.from(methodMap.values())
        .map(m => ({ ...m, percentage: totalSalesAll > 0 ? (Number(m.sales || 0) * 100) / totalSalesAll : 0 }))
        .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))

      // RFM analysis (use up to 1 year history for members)
      const rfmStart = new Date(endDate)
      rfmStart.setFullYear(rfmStart.getFullYear() - 1)
      const memberTx = await db.Transaction.findAll({
        where: { createdAt: { [Op.gte]: rfmStart, [Op.lte]: endDate }, status: 'COMPLETED', memberId: { [Op.ne]: null } },
        // Limit selected columns for member to avoid referencing non-existent columns (e.g., isActive)
        include: [{ model: db.Member, as: 'member', attributes: ['id', 'name', 'email', 'phone', 'points'] }],
        order: [['createdAt', 'ASC']]
      })

      const rfmByMember = new Map()
      memberTx.forEach(t => {
        const id = String(t.memberId)
        if (!rfmByMember.has(id)) {
          rfmByMember.set(id, {
            memberId: id,
            name: t.member?.name || 'Unknown',
            lastPurchase: new Date(t.createdAt),
            frequency: 1,
            monetary: Number(t.finalTotal || 0)
          })
        } else {
          const cur = rfmByMember.get(id)
          cur.frequency += 1
          cur.monetary += Number(t.finalTotal || 0)
          if (new Date(t.createdAt) > cur.lastPurchase) cur.lastPurchase = new Date(t.createdAt)
        }
      })

      const now = endDate
      const customers = Array.from(rfmByMember.values()).map(c => {
        const recencyDays = Math.max(0, Math.floor((now - c.lastPurchase) / (24 * 3600 * 1000)))
        return { memberId: c.memberId, name: c.name, recency: recencyDays, frequency: c.frequency, monetary: c.monetary }
      })

      // Compute simple 1-5 scores based on quantiles for each dimension
      function score(values, v) {
        if (values.length === 0) return 0
        const sorted = [...values].sort((a, b) => a - b)
        const q1 = sorted[Math.floor(0.2 * (sorted.length - 1))]
        const q2 = sorted[Math.floor(0.4 * (sorted.length - 1))]
        const q3 = sorted[Math.floor(0.6 * (sorted.length - 1))]
        const q4 = sorted[Math.floor(0.8 * (sorted.length - 1))]
        let s = 1
        if (v <= q1) s = 5
        else if (v <= q2) s = 4
        else if (v <= q3) s = 3
        else if (v <= q4) s = 2
        else s = 1
        return s
      }

      const recVals = customers.map(c => c.recency)
      const freqVals = customers.map(c => c.frequency)
      const monVals = customers.map(c => c.monetary)
      const rfmCustomers = customers.map(c => {
        const r = score(recVals, c.recency)
        const f = score(freqVals, c.frequency)
        const m = score(monVals, c.monetary)
        const rfmScore = r + f + m
        let segment = 'Others'
        if (r >= 4 && f >= 4 && m >= 4) segment = 'Champions'
        else if (r >= 3 && f >= 3 && m >= 3) segment = 'Loyal'
        else if (r <= 2 && f <= 2 && m <= 2) segment = 'At Risk'
        else if (r >= 4 && f <= 2) segment = 'New Customers'
        return { memberId: c.memberId, name: c.name, recency: c.recency, frequency: c.frequency, monetary: c.monetary, rfmScore, segment }
      })

      const avg = {
        recency: recVals.length ? recVals.reduce((a, b) => a + b, 0) / recVals.length : 0,
        frequency: freqVals.length ? freqVals.reduce((a, b) => a + b, 0) / freqVals.length : 0,
        monetary: monVals.length ? monVals.reduce((a, b) => a + b, 0) / monVals.length : 0
      }
      const dist = {
        recency: {}, frequency: {}, monetary: {}
      }
      rfmCustomers.forEach(c => {
        dist.recency[c.recency] = (dist.recency[c.recency] || 0) + 1
        dist.frequency[c.frequency] = (dist.frequency[c.frequency] || 0) + 1
        const bucket = Math.round(c.monetary / 10000) * 10000 // bucket by 10k
        dist.monetary[bucket] = (dist.monetary[bucket] || 0) + 1
      })

      const segmentationMap = new Map()
      rfmCustomers.forEach(c => {
        const seg = c.segment
        const cur = segmentationMap.get(seg) || { segment: seg, count: 0, totalSpent: 0 }
        cur.count += 1
        cur.totalSpent += c.monetary
        segmentationMap.set(seg, cur)
      })
      const customerSegmentation = Array.from(segmentationMap.values()).map(s => ({
        segment: s.segment,
        count: s.count,
        totalSpent: s.totalSpent,
        avgSpent: s.count > 0 ? s.totalSpent / s.count : 0
      }))

      Object.assign(baseResponse, {
        hourlyAnalysis: hourlyBuckets,
        weekdayAnalysis: weekdayBuckets,
        paymentMethodAnalysis,
        rfmAnalysis: {
          customers: rfmCustomers,
          averages: avg,
          distribution: dist,
          thresholds: { recency: {}, frequency: {}, monetary: {} }
        },
        customerSegmentation
      })
    }

    res.json(baseResponse)
  } catch (err) {
    console.error('[Express] Error generating sales report:', err)
    res.status(500).json({ error: 'Failed to generate sales report' })
  }
})

module.exports = router
