const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { Op } = require('sequelize')
const ReceiptFormatter = require('../../services/receiptFormatter')
const WhatsAppManager = require('../../services/whatsappManager')

const router = Router()

function computeStartDate(range, endDate) {
  const days = range === '7days' ? 7 : range === '30days' ? 30 : range === '3months' ? 90 : range === '1year' ? 365 : 30
  const start = new Date(endDate)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return start
}

// List transactions with relations and optional range filter
router.get('/', authMiddleware, async (req, res) => {
  try {
    const range = String(req.query.range || '7days')
    // Dukungan rentang tanggal eksplisit (Asia/Jakarta)
    const fromStr = req.query.from ? String(req.query.from) : null
    const toStr = req.query.to ? String(req.query.to) : null
    let startDate
    let endDate
    if (fromStr && toStr) {
      // Jika formatnya YYYY-MM-DD, tambahkan offset +07:00 agar presisi di Jakarta
      const fromIso = /\d{4}-\d{2}-\d{2}$/.test(fromStr) ? `${fromStr}T00:00:00.000+07:00` : fromStr
      const toIso = /\d{4}-\d{2}-\d{2}$/.test(toStr) ? `${toStr}T23:59:59.999+07:00` : toStr
      startDate = new Date(fromIso)
      endDate = new Date(toIso)
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date range' })
      }
    } else {
      endDate = new Date(); endDate.setHours(23,59,59,999)
      startDate = computeStartDate(range, endDate)
    }
    const where = { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } }
    // Validasi nilai filter yang diizinkan untuk keamanan dan konsistensi
    const allowedPayments = ['CASH','CARD','QRIS','MIDTRANS','BANK_TRANSFER','VIRTUAL_ACCOUNT']
    const allowedStatus = ['PAID','PENDING','CANCELED','COMPLETED']
    if (req.query.paymentMethod) {
      const pm = String(req.query.paymentMethod).toUpperCase()
      if (!allowedPayments.includes(pm)) return res.status(400).json({ error: 'Invalid payment method' })
      where.paymentMethod = pm
    }
    if (req.query.status) {
      const st = String(req.query.status).toUpperCase()
      if (!allowedStatus.includes(st)) return res.status(400).json({ error: 'Invalid status' })
      where.status = st
    }
    if (req.query.paymentStatus) {
      const allowedPaymentStatus = ['PENDING','PAID','FAILED','CANCELLED']
      const ps = String(req.query.paymentStatus).toUpperCase()
      if (!allowedPaymentStatus.includes(ps)) return res.status(400).json({ error: 'Invalid payment status' })
      where.paymentStatus = ps
    }

    // Optional server-side filters for product/category
    const productWhere = {}
    if (req.query.categoryId) productWhere.categoryId = String(req.query.categoryId)
    // Dukungan pencarian nomor transaksi melalui productName: "#123" atau "123"
    if (req.query.productName) {
      const q = String(req.query.productName)
      const m = q.match(/^#?(\d+)$/)
      if (m) {
        where.id = Number(m[1])
      } else {
        productWhere.name = { [Op.iLike]: `%${q}%` }
      }
    }
    if (req.query.productId) productWhere.id = String(req.query.productId)

    const includeItems = {
      model: db.TransactionItem,
      as: 'items',
      include: [
        {
          model: db.Product,
          as: 'product',
          ...(Object.keys(productWhere).length ? { where: productWhere } : {}),
          include: [{ model: db.Category, as: 'category' }]
        }
      ],
      ...(Object.keys(productWhere).length ? { required: true } : {})
    }

    const transactions = await db.Transaction.findAll({
      where,
      include: [
        includeItems,
        { model: db.User, as: 'user', attributes: ['name','email'] },
        { model: db.Member, as: 'member', attributes: ['id','name','phone','email','points'] },
        { model: db.VoucherUsage, as: 'voucherUsages', include: [{ model: db.Voucher, as: 'voucher', attributes: ['code','name'] }] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 1000,
      distinct: true
    })
    // Aggregasi ringkasan
    const finalTotals = transactions
      .filter(t => String(t.status || '').toUpperCase() === 'COMPLETED')
      .map(t => Number(t.finalTotal || t.total || 0))
    const totalSales = finalTotals.reduce((a,b) => a + b, 0)
    const transactionCount = transactions.length
    const avgTransactionValue = transactionCount > 0 ? Number((totalSales / transactionCount).toFixed(2)) : 0
    const productStats = {}
    transactions.forEach(t => {
      (t.items || []).forEach(it => {
        const name = (it.product && it.product.name) || 'Unknown'
        const qty = Number(it.quantity || 0)
        const rev = Number(it.subtotal || 0)
        if (!productStats[name]) productStats[name] = { name, qty: 0, revenue: 0 }
        productStats[name].qty += qty
        productStats[name].revenue += rev
      })
    })
    const topProduct = Object.values(productStats).sort((a,b) => b.qty - a.qty)[0] || null

    res.json({
      range,
      count: transactions.length,
      transactions,
      summary: {
        totalSales,
        transactionCount,
        avgTransactionValue,
        // Aligned fields for Daily Reports page
        avgTransaction: avgTransactionValue,
        topProductName: topProduct ? String(topProduct.name) : '-',
        // Keep original object for other consumers
        topProduct
      }
    })
  } catch (err) {
    console.error('[Express] Error listing transactions:', err)
    res.status(500).json({ error: 'Failed to list transactions' })
  }
})

// Create transaction (basic, items handled elsewhere)
router.post(
  '/',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      total: { type: 'number', required: true },
      subtotal: { type: 'number', required: true },
      tax: { type: 'number', required: false },
      discount: { type: 'number', required: false },
      voucherDiscount: { type: 'number', required: false },
      promoDiscount: { type: 'number', required: false },
      paymentMethod: { type: 'string', required: true },
      customerName: { type: 'string', required: false },
      customerPhone: { type: 'string', required: false },
      customerEmail: { type: 'string', required: false },
      pointsUsed: { type: 'number', required: false },
      memberId: { type: 'number', required: false },
      voucherCode: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const data = req.body
      // Optional client time validation for diagnostics
      try {
        const serverNow = new Date()
        res.set('X-Server-Time-UTC', serverNow.toISOString())
        if (data.clientCreatedAt) {
          const clientTime = new Date(data.clientCreatedAt)
          if (!isNaN(clientTime.getTime())) {
            const diffMs = Math.abs(serverNow.getTime() - clientTime.getTime())
            const diffHours = diffMs / (1000 * 60 * 60)
            if (diffHours >= 1) {
              console.warn('[Transactions] Significant client/server time offset detected', {
                clientCreatedAt: clientTime.toISOString(),
                serverNow: serverNow.toISOString(),
                diffHours: Number(diffHours.toFixed(2))
              })
            }
          }
        }
      } catch (tzErr) {
        console.warn('[Transactions] Time validation error:', tzErr)
      }
      // Basic manual validation for items array
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        return res.status(400).json({ error: 'Items are required and must be a non-empty array' })
      }

      const userId = req.user?.id || req.user?.sub
      if (!userId) return res.status(401).json({ error: 'Unauthorized: invalid user in token' })
      const userExists = await db.User.findByPk(userId)
      if (!userExists) return res.status(401).json({ error: 'Unauthorized: user not found' })

      // Create core transaction
      const pm = String(data.paymentMethod || 'CASH')
      const requiresConfirmation = data.requiresConfirmation === true
      const isDelayed = ['VIRTUAL_ACCOUNT','BANK_TRANSFER','MIDTRANS','QRIS'].includes(pm) || (pm === 'CARD' && requiresConfirmation)
      // Server-side subtotal from items and final total (avoid double-subtract)
      const itemsSubtotal = (data.items || []).reduce((sum, it) => {
        const price = Number(it?.price || 0)
        const qty = Number(it?.quantity || 0)
        return sum + price * qty
      }, 0)
      const pointsUsed = Number(data.pointsUsed || 0)
      const pointsDiscount = pointsUsed * 1000
      const computedFinalTotal = Math.max(
        itemsSubtotal - pointsDiscount - Number(data.discount || 0) - Number(data.voucherDiscount || 0) - Number(data.promoDiscount || 0) + Number(data.tax || 0),
        0
      )
      // Validation & logging for diagnostics
      if (Number(data.subtotal || 0) !== itemsSubtotal) {
        console.warn('[Transactions] Subtotal mismatch; using server-computed subtotal', {
          providedSubtotal: Number(data.subtotal || 0),
          computedItemsSubtotal: itemsSubtotal
        })
      }
      if (data.total != null && Number(data.total) !== computedFinalTotal) {
        console.warn('[Transactions] Total mismatch; client vs server computation', {
          providedTotal: Number(data.total),
          computedFinalTotal,
          details: {
            itemsSubtotal,
            pointsUsed,
            pointsDiscount,
            voucherDiscount: Number(data.voucherDiscount || 0),
            promoDiscount: Number(data.promoDiscount || 0),
            tax: Number(data.tax || 0)
          }
        })
      }
      const transaction = await db.Transaction.create({
        // Store subtotal (pre-discount) for consistent downstream usage
        total: itemsSubtotal,
        tax: Number(data.tax || 0),
        discount: Number(data.discount || 0),
        voucherDiscount: Number(data.voucherDiscount || 0),
        promoDiscount: Number(data.promoDiscount || 0),
        finalTotal: computedFinalTotal,
        paymentMethod: pm,
        status: isDelayed ? 'PENDING' : 'COMPLETED',
        paymentStatus: isDelayed ? 'PENDING' : 'PAID',
        paidAt: isDelayed ? null : new Date(),
        userId: Number(userId),
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        customerEmail: data.customerEmail || null,
        memberId: data.memberId || null,
        pointsUsed: Number(data.pointsUsed || 0),
        notes: data.notes || null
      })

      // Create items
      for (const item of data.items) {
        if (!item || !item.productId || !item.quantity || !item.price) continue
        await db.TransactionItem.create({
          transactionId: transaction.id,
          productId: item.productId,
          quantity: Number(item.quantity),
          price: Number(item.price),
          subtotal: Number(item.price) * Number(item.quantity)
        })
      }

      // Record voucher usage if present
      if (data.voucherCode) {
        try {
          const voucher = await db.Voucher.findOne({ where: { code: data.voucherCode } })
          if (voucher && voucher.id) {
            await db.VoucherUsage.create({
              voucherId: voucher.id,
              transactionId: transaction.id,
              userId: Number(userId),
              memberId: data.memberId || null,
              discountAmount: Number(data.voucherDiscount || 0)
            })
          }
        } catch (e) {
          console.warn('[Express] Failed to record voucher usage:', e)
        }
      }

      // Update member points and total spent
      if (data.memberId) {
        try {
          const pointsEarned = Math.floor(Number(transaction.finalTotal || 0) / 1000)
          const pointsUsed = Number(data.pointsUsed || 0)
          await db.Member.increment(
            { points: pointsEarned - pointsUsed, totalSpent: Number(transaction.finalTotal || 0) },
            { where: { id: data.memberId } }
          )
          // Persist pointsEarned to the transaction so API reflects actual value
          await db.Transaction.update({ pointsEarned }, { where: { id: transaction.id } })
          if (pointsEarned > 0) {
            await db.PointHistory.create({
              memberId: data.memberId,
              points: pointsEarned,
              type: 'EARNED',
              description: `Poin dari transaksi #${transaction.id}`,
              transactionId: transaction.id
            })
          }
          if (pointsUsed > 0) {
            await db.PointHistory.create({
              memberId: data.memberId,
              points: -pointsUsed,
              type: 'USED',
              description: `Poin digunakan untuk transaksi #${transaction.id}`,
              transactionId: transaction.id
            })
          }
        } catch (e) {
          console.warn('[Express] Failed to update member points:', e)
        }
      }

      // Update product stock for completed transactions (skip certain payment methods)
      const pm2 = String(data.paymentMethod || '')
      const skipStockUpdate = ['VIRTUAL_ACCOUNT','BANK_TRANSFER','MIDTRANS','QRIS'].includes(pm2) || (pm2 === 'CARD' && data.requiresConfirmation === true)
      if (!skipStockUpdate) {
        try {
          for (const item of data.items) {
            if (!item || !item.productId || !item.quantity) continue
            await db.Product.update({
              stock: db.sequelize.literal(`stock - ${Number(item.quantity)}`)
            }, { where: { id: item.productId } })
          }
        } catch (e) {
          console.warn('[Express] Failed to update product stock:', e)
        }
      }

      // Auto-send WhatsApp receipt for immediate payments if customer phone exists
      try {
        const shouldAutoSend = transaction && transaction.customerPhone && transaction.status === 'COMPLETED' && transaction.paymentStatus === 'PAID'
        if (shouldAutoSend) {
          // Run asynchronously to avoid blocking the response
          setTimeout(async () => {
            try {
              const fullTransaction = await db.Transaction.findByPk(transaction.id, {
                include: [
                  { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] },
                  { model: db.Member, as: 'member' },
                  { model: db.User, as: 'user' },
                ]
              })
              if (!fullTransaction) return

              const receiptData = {
                id: fullTransaction.id,
                createdAt: fullTransaction.createdAt,
                items: (fullTransaction.items || []).map((item) => ({
                  id: item.id,
                  name: (item.product && item.product.name) || 'Unknown Product',
                  quantity: item.quantity,
                  price: item.price,
                  total: item.subtotal,
                  productCode: item.product ? item.product.code : undefined,
                  size: item.product ? item.product.size : undefined,
                  color: item.product ? item.product.color : undefined,
                })),
                subtotal: (fullTransaction.items || []).reduce((sum, it) => sum + Number(it.subtotal || 0), 0),
                tax: fullTransaction.tax,
                finalTotal: fullTransaction.finalTotal,
                paymentMethod: fullTransaction.paymentMethod,
                status: fullTransaction.status,
                cashier: undefined,
                customer: fullTransaction.customerName || undefined,
                customerPhone: fullTransaction.customerPhone || undefined,
                customerEmail: fullTransaction.customerEmail || undefined,
                pointsUsed: fullTransaction.pointsUsed,
                pointsEarned: fullTransaction.pointsEarned,
                voucherCode: undefined,
                voucherDiscount: fullTransaction.voucherDiscount,
                promotionDiscount: fullTransaction.promoDiscount,
                member: fullTransaction.member ? {
                  name: fullTransaction.member.name,
                  phone: fullTransaction.member.phone || '',
                  email: fullTransaction.member.email || undefined,
                  points: fullTransaction.member.points
                } : undefined,
                user: fullTransaction.user ? { name: fullTransaction.user.name } : undefined,
              }

              const phoneValidation = ReceiptFormatter.validatePhoneNumber(fullTransaction.customerPhone || '')
              const receiptMessage = ReceiptFormatter.formatReceiptForWhatsApp(receiptData)
              if (phoneValidation.isValid) {
                const wa = WhatsAppManager.getInstance()
                if (!wa.isConnected()) {
                  await wa.initialize()
                  await new Promise((res) => setTimeout(res, 1000))
                }
                const result = await wa.sendMessage(phoneValidation.formatted || fullTransaction.customerPhone, receiptMessage)
                if (result.success) {
                  console.log(`[Transactions] WhatsApp receipt sent for transaction ${transaction.id}`)
                } else {
                  console.warn(`[Transactions] Failed to send WhatsApp receipt for transaction ${transaction.id}: ${result.error}`)
                }
              } else {
                console.warn(`[Transactions] Invalid phone number for WhatsApp receipt: ${fullTransaction.customerPhone}`)
              }
            } catch (waErr) {
              console.warn(`[Transactions] WhatsApp auto-send error for transaction ${transaction.id}:`, waErr)
            }
          }, 0)
        }
      } catch (waWrapperErr) {
        console.warn('[Express] WhatsApp auto-send wrapper error:', waWrapperErr)
      }

      res.status(201).json(transaction)
    } catch (err) {
      console.error('[Express] Error creating transaction:', err)
      // Provide more detailed error codes
      const message = err?.message || 'Failed to create transaction'
      const status = message.includes('required') ? 400 : message.includes('Unauthorized') ? 401 : 500
      res.status(status).json({ error: 'Failed to create transaction', message })
    }
  }
)

// Get transaction by id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const tx = await db.Transaction.findByPk(id, {
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.User, as: 'user', attributes: ['name','email'] },
        { model: db.Member, as: 'member', attributes: ['id','name','phone','email','points'] },
        { model: db.VoucherUsage, as: 'voucherUsages', include: [{ model: db.Voucher, as: 'voucher', attributes: ['code','name'] }] }
      ]
    })
    if (!tx) return res.status(404).json({ error: 'Transaction not found' })
    res.json(tx)
  } catch (err) {
    console.error('[Express] Error fetching transaction:', err)
    res.status(500).json({ error: 'Failed to fetch transaction' })
  }
})

// Update transaction status/payment
router.patch(
  '/:id',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      status: { type: 'string', required: false },
      paymentStatus: { type: 'string', required: false },
      amount: { type: 'number', required: false },
      paymentMethod: { type: 'string', required: false }
    }
  }),
  async (req, res) => {
    try {
      const { id } = req.params
      const existing = await db.Transaction.findByPk(id)
      if (!existing) return res.status(404).json({ error: 'Transaction not found' })

      const { status, paymentStatus } = req.body
      await db.Transaction.update({
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(status === 'COMPLETED' ? { paidAt: new Date() } : {})
      }, { where: { id } })

      const updated = await db.Transaction.findByPk(id)

      // On completion, update member points
      if (updated.status === 'COMPLETED' && updated.memberId) {
        try {
          const pointsEarned = Math.floor(Number(updated.finalTotal || 0) / 1000)
          // Persist pointsEarned on completion
          await db.Transaction.update({ pointsEarned }, { where: { id: updated.id } })
          if (pointsEarned > 0) {
            await db.Member.increment({ points: pointsEarned, totalSpent: Number(updated.finalTotal || 0) }, { where: { id: updated.memberId } })
            await db.PointHistory.create({
              memberId: updated.memberId,
              points: pointsEarned,
              type: 'EARNED',
              description: `Poin dari transaksi #${updated.id}`,
              transactionId: updated.id
            })
          }
          if (updated.pointsUsed > 0) {
            await db.PointHistory.create({
              memberId: updated.memberId,
              points: -Number(updated.pointsUsed || 0),
              type: 'USED',
              description: `Poin digunakan untuk transaksi #${updated.id}`,
              transactionId: updated.id
            })
          }
        } catch (e) {
          console.warn('[Express] Failed to update member data on completion:', e)
        }
      }

      res.json(updated)
    } catch (err) {
      console.error('[Express] Error updating transaction:', err)
      res.status(500).json({ error: 'Failed to update transaction' })
    }
  }
)

// Cancel transaction (revert stock and voucher usage if needed)
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const transaction = await db.Transaction.findByPk(id, {
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.VoucherUsage, as: 'voucherUsages', include: [{ model: db.Voucher, as: 'voucher' }] }
      ]
    })

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' })

    if (transaction.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Transaction is already cancelled' })
    }

    if (!['COMPLETED', 'PENDING'].includes(String(transaction.status))) {
      return res.status(400).json({ error: 'Only completed or pending transactions can be cancelled' })
    }

    const reason = req.body && req.body.reason ? String(req.body.reason) : null
    const now = new Date()
    await db.sequelize.transaction(async (t) => {
      // Append history to notes and failureReason
      const notesArr = (() => {
        try { return Array.isArray(transaction.notes) ? transaction.notes : JSON.parse(transaction.notes || '[]') } catch { return [] }
      })()
      notesArr.push({ type: 'CANCELLED', changedAt: now.toISOString(), reason })
      await db.Transaction.update({ status: 'CANCELLED', failureReason: reason, notes: JSON.stringify(notesArr), updatedAt: now }, { where: { id }, transaction: t })

      // Restore product stock only if transaction was completed
      if (transaction.status === 'COMPLETED') {
        for (const item of transaction.items || []) {
          await db.Product.update({
            stock: db.sequelize.literal(`stock + ${Number(item.quantity)}`)
          }, { where: { id: item.productId }, transaction: t })
        }
      }

      // Restore voucher usage if any
      for (const usage of transaction.voucherUsages || []) {
        await db.VoucherUsage.destroy({ where: { id: usage.id }, transaction: t })
        await db.Voucher.update({
          usedCount: db.sequelize.literal('usedCount - 1')
        }, { where: { id: usage.voucherId }, transaction: t })
      }

      // Adjust member points if applicable
      if (transaction.memberId) {
        const pointsEarned = Math.floor(Number(transaction.finalTotal || 0) / 1000)
        const pointsUsed = Number(transaction.pointsUsed || 0)
        // Deduct earned points, restore used points, and revert totalSpent
        await db.Member.increment({
          points: -pointsEarned + (pointsUsed > 0 ? pointsUsed : 0),
          totalSpent: -Number(transaction.finalTotal || 0)
        }, { where: { id: transaction.memberId }, transaction: t })
        if (pointsEarned > 0) {
          await db.PointHistory.create({
            memberId: transaction.memberId,
            points: -pointsEarned,
            type: 'ADJUSTED',
            description: `Poin dikurangi karena pembatalan transaksi #${transaction.id}`,
            transactionId: transaction.id
          }, { transaction: t })
        }
        if (pointsUsed > 0) {
          await db.PointHistory.create({
            memberId: transaction.memberId,
            points: pointsUsed,
            type: 'ADJUSTED',
            description: `Poin dikembalikan karena pembatalan transaksi #${transaction.id}`,
            transactionId: transaction.id
          }, { transaction: t })
        }
      }
    })

    const updated = await db.Transaction.findByPk(id)
    res.json({ message: 'Transaction cancelled successfully', transaction: updated })
  } catch (err) {
    console.error('[Express] Error cancelling transaction:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Refund transaction (only for completed; revert stock and voucher usage)
router.post('/:id/refund', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const transaction = await db.Transaction.findByPk(id, {
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.VoucherUsage, as: 'voucherUsages', include: [{ model: db.Voucher, as: 'voucher' }] }
      ]
    })

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' })

    if (transaction.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Only completed transactions can be refunded' })
    }

    const refundRef = req.body && req.body.refundRef ? String(req.body.refundRef) : `RF-${id}`
    const now2 = new Date()
    await db.sequelize.transaction(async (t) => {
      const notesArr = (() => {
        try { return Array.isArray(transaction.notes) ? transaction.notes : JSON.parse(transaction.notes || '[]') } catch { return [] }
      })()
      notesArr.push({ type: 'REFUNDED', refundAt: now2.toISOString(), refundAmount: Number(transaction.finalTotal || 0), refundRef })
      await db.Transaction.update({ status: 'REFUNDED', notes: JSON.stringify(notesArr), updatedAt: now2 }, { where: { id }, transaction: t })

      // Restore product stock
      for (const item of transaction.items || []) {
        await db.Product.update({
          stock: db.sequelize.literal(`stock + ${Number(item.quantity)}`)
        }, { where: { id: item.productId }, transaction: t })
      }

      // Restore voucher usage if any
      for (const usage of transaction.voucherUsages || []) {
        await db.VoucherUsage.destroy({ where: { id: usage.id }, transaction: t })
        await db.Voucher.update({
          usedCount: db.sequelize.literal('usedCount - 1')
        }, { where: { id: usage.voucherId }, transaction: t })
      }

      // Adjust member points if applicable
      if (transaction.memberId) {
        const pointsEarned = Math.floor(Number(transaction.finalTotal || 0) / 1000)
        const pointsUsed = Number(transaction.pointsUsed || 0)
        await db.Member.increment({
          points: -pointsEarned + (pointsUsed > 0 ? pointsUsed : 0),
          totalSpent: -Number(transaction.finalTotal || 0)
        }, { where: { id: transaction.memberId }, transaction: t })
        if (pointsEarned > 0) {
          await db.PointHistory.create({
            memberId: transaction.memberId,
            points: -pointsEarned,
            type: 'ADJUSTED',
            description: `Poin dikurangi karena pengembalian transaksi #${transaction.id}`,
            transactionId: transaction.id
          }, { transaction: t })
        }
        if (pointsUsed > 0) {
          await db.PointHistory.create({
            memberId: transaction.memberId,
            points: pointsUsed,
            type: 'ADJUSTED',
            description: `Poin dikembalikan karena pengembalian transaksi #${transaction.id}`,
            transactionId: transaction.id
          }, { transaction: t })
        }
      }
    })

    const updated = await db.Transaction.findByPk(id)
    res.json({ message: 'Transaction refunded successfully', transaction: updated })
  } catch (err) {
    console.error('[Express] Error refunding transaction:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router
