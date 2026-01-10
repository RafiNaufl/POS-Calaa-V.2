const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const { buildValidator } = require('../../middleware/validate')
const db = require('../../../../models')
const { Op } = require('sequelize')
const ReceiptFormatter = require('../../services/receiptFormatter')
const WhatsAppManager = require('../../services/whatsappManager')

// Midtrans client (CommonJS)
let midtransSnap = null
let midtransCoreApi = null
try {
  const midtrans = require('midtrans-client')
  midtransSnap = new midtrans.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  })
  midtransCoreApi = new midtrans.CoreApi({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
  })
} catch (e) {
  console.warn('[Express] midtrans-client not available or misconfigured:', e?.message || e)
}

const router = Router()

function requireCashierOrAdmin(req, res) {
  const role = req.user?.role
  if (role !== 'ADMIN' && role !== 'CASHIER') {
    res.status(403).json({ error: 'Forbidden: cashier or admin role required' })
    return false
  }
  return true
}

async function reduceStock(items, t) {
  for (const item of items || []) {
    if (!item?.productId || !item?.quantity) continue
    await db.Product.update({
      stock: db.sequelize.literal(`stock - ${Number(item.quantity)}`)
    }, { where: { id: item.productId }, transaction: t })
  }
}

async function restoreStock(items, t) {
  for (const item of items || []) {
    if (!item?.productId || !item?.quantity) continue
    await db.Product.update({
      stock: db.sequelize.literal(`stock + ${Number(item.quantity)}`)
    }, { where: { id: item.productId }, transaction: t })
  }
}

async function confirmTransactionById(transactionId, expectedMethod, req, res) {
  try {
    // Allow both ADMIN and CASHIER to confirm on-site payments
    if (!requireCashierOrAdmin(req, res)) return
    const id = String(transactionId || '').trim()
    if (!id) return res.status(400).json({ error: 'Invalid transactionId' })

    const { reference, notes } = req.body || {}

    console.log(`[Payment] Attempting to confirm transaction ${id} via ${expectedMethod}`)

    // Use database transaction to prevent race conditions
    const result = await db.sequelize.transaction(async (t) => {
      // Lock the transaction row for update to prevent race conditions
      // Note: We don't include items here to avoid "FOR UPDATE cannot be applied to the nullable side of an outer join" error in Postgres
      const tx = await db.Transaction.findByPk(id, {
        lock: true, 
        transaction: t
      })
      
      if (!tx) {
        throw new Error('Transaction not found')
      }

      // Fetch items separately
      const items = await db.TransactionItem.findAll({
        where: { transactionId: id },
        transaction: t
      })
      tx.items = items
      
      const pm = String(tx.paymentMethod || '').trim().toUpperCase()
      const expected = String(expectedMethod).toUpperCase()

      // If payment method doesn't match, we might want to allow updating it if it's currently pending
      // But for safety, we'll just log warning and strict check for now, but case-insensitive
      if (pm !== expected) {
        console.warn(`[Payment] Method mismatch for ${id}. Expected: ${expected}, Actual: ${pm}`)
        throw new Error(`Invalid payment method for confirmation: expected ${expectedMethod} but found ${tx.paymentMethod}`)
      }
      
      // Idempotency check: if already completed, return success immediately
      if (String(tx.status) === 'COMPLETED') {
        console.log(`[Payment] Transaction ${id} already COMPLETED. Returning success.`)
        return tx
      }

      if (String(tx.status) !== 'PENDING') {
        throw new Error('Transaction is not in PENDING status')
      }

      // Update the transaction
      const updateData = {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paidAt: new Date()
      }

      // Append notes if provided
      if (notes) {
        updateData.notes = (tx.notes ? tx.notes + '\n' : '') + notes
      }
      
      if (reference) {
        updateData.notes = (updateData.notes || tx.notes || '') + `\nRef: ${reference}`
      }

      await db.Transaction.update(updateData, { 
        where: { id },
        transaction: t 
      })

      // Reduce stock within the same transaction
      await reduceStock(tx.items, t)
      
      return tx
    })

    // If we get here, the transaction was successful or already completed
    console.log(`[Payment] Transaction ${id} confirmed successfully`)

    if (String(result.status) === 'COMPLETED' && String(result.paymentStatus) === 'PAID' && result.paidAt) {
       // It was already completed (idempotent return), so we might want to skip sending WA if it was sent before?
       // But checking if WA was sent is hard. We can just skip or let it re-send (maybe annoying).
       // For now, we proceed to send WA receipt as confirmation.
    }

    // If we get here, the transaction was successful

    // Auto-send WhatsApp receipt asynchronously when confirmation succeeds
    try {
      const fullTx = await db.Transaction.findByPk(id, {
        include: [
          { model: db.User, as: 'user' },
          { model: db.Member, as: 'member' },
          { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] }
        ]
      })
      if (fullTx && fullTx.customerPhone) {
        const validation = ReceiptFormatter.validatePhoneNumber(fullTx.customerPhone)
        if (validation.isValid) {
          const items = (fullTx.items || []).map((it) => ({
            name: it.product?.name || it.name || 'Item',
            productCode: it.product?.code || null,
            size: it.product?.size || null,
            color: it.product?.color || null,
            price: Number(it.price || it.product?.price || 0),
            quantity: Number(it.quantity || 0),
            total: Number(it.subtotal || (Number(it.price || 0) * Number(it.quantity || 0)) || 0),
          }))
          const messageTx = {
            id: fullTx.id,
            createdAt: fullTx.createdAt,
            user: fullTx.user ? { name: fullTx.user.name } : undefined,
            customer: fullTx.customerName || undefined,
            customerPhone: fullTx.customerPhone,
            member: fullTx.member ? { name: fullTx.member.name, phone: fullTx.member.phone } : undefined,
            items,
            subtotal: items.reduce((acc, i) => acc + Number(i.total || 0), 0),
            tax: Number(fullTx.tax || 0),
            pointsUsed: Number(fullTx.pointsUsed || 0),
            voucherCode: fullTx.voucherCode || null,
            voucherDiscount: Number(fullTx.voucherDiscount || 0),
            promotionDiscount: Number(fullTx.promoDiscount || 0),
            finalTotal: Number(fullTx.finalTotal || fullTx.total || 0),
            paymentMethod: fullTx.paymentMethod,
            status: 'COMPLETED',
            pointsEarned: 0,
          }
          const message = ReceiptFormatter.formatReceiptForWhatsApp(messageTx)
          const wa = WhatsAppManager.getInstance()
          if (!wa.isConnected()) {
            // Attempt simple initialize, but don't crash
            wa.initialize().catch((e) => console.warn('[Express] WhatsApp init error:', e))
          }
          // Fire and forget; don't block response on WA send
          // Add small delay to ensure init
          setTimeout(() => {
              wa.sendMessage(validation.formatted, message)
                .then((r) => { if (!r.success) console.warn('[Express] WhatsApp send receipt failed:', r.error) })
                .catch((e) => console.warn('[Express] WhatsApp send receipt error:', e))
          }, 500)
        }
      }
    } catch (waErr) {
      console.warn('[Express] Skipping WhatsApp send on confirm:', waErr)
    }

    const updated = await db.Transaction.findByPk(id)
    return res.json({ message: 'Payment confirmed', transaction: updated })
  } catch (err) {
    console.error('[Express] Error confirming transaction:', err)
    // Handle specific error messages from our transaction
    if (err.message === 'Transaction not found') {
      return res.status(404).json({ error: 'Transaction not found' })
    }
    if (err.message.includes('Invalid payment method')) {
      return res.status(400).json({ error: err.message })
    }
    if (err.message === 'Transaction is not in PENDING status') {
      return res.status(400).json({ error: err.message })
    }
    return res.status(500).json({ 
      error: 'Failed to confirm transaction', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    })
  }
}

// Bank transfer confirm (cashier/admin)
router.post(
  '/bank-transfer/confirm',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: { transactionId: { type: 'string', required: true } }
  }),
  async (req, res) => {
    const { transactionId } = req.body
    return confirmTransactionById(transactionId, 'BANK_TRANSFER', req, res)
  }
)

// QRIS confirm (cashier/admin)
router.post(
  '/qris/confirm',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: { transactionId: { type: 'string', required: true } }
  }),
  async (req, res) => {
    const { transactionId } = req.body
    return confirmTransactionById(transactionId, 'QRIS', req, res)
  }
)

// Card confirm (cashier/admin)
router.post(
  '/card/confirm',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: { transactionId: { type: 'string', required: true } }
  }),
  async (req, res) => {
    const { transactionId } = req.body
    return confirmTransactionById(transactionId, 'CARD', req, res)
  }
)

// Midtrans: create payment token
router.post(
  '/midtrans/create-token',
  authMiddleware,
  buildValidator({
    location: 'body',
    schema: {
      orderId: { type: 'string', required: true },
      amount: { type: 'number', required: true },
      customerDetails: { type: 'object', required: false },
      itemDetails: { type: 'array', required: false }
    }
  }),
  async (req, res) => {
    try {
      if (!midtransSnap) return res.status(500).json({ error: 'Midtrans not configured' })
      const { orderId, amount, customerDetails, itemDetails } = req.body
      const params = {
        transaction_details: { order_id: orderId, gross_amount: Number(amount) },
        customer_details: customerDetails || {},
        item_details: (itemDetails || []).map(d => ({
          id: String(d.id || d.productId || 'item'),
          price: Number(d.price || 0),
          quantity: Number(d.quantity || 1),
          name: String(d.name || d.productName || 'Item')
        })),
        callbacks: {
          finish: process.env.MIDTRANS_CALLBACK_FINISH || undefined,
          pending: process.env.MIDTRANS_CALLBACK_PENDING || undefined,
          error: process.env.MIDTRANS_CALLBACK_ERROR || undefined
        }
      }
      const transaction = await midtransSnap.createTransaction(params)
      return res.json({ token: transaction.token, redirect_url: transaction.redirect_url })
    } catch (err) {
      console.error('[Express] Midtrans create-token error:', err)
      const message = err?.message || 'Failed to create payment token'
      return res.status(500).json({ error: message })
    }
  }
)

// Midtrans: webhook handler
router.post('/midtrans/webhook', async (req, res) => {
  try {
    const body = req.body || {}
    const orderId = String(body.order_id || '')
    const statusCode = String(body.status_code || '')
    const grossAmount = String(body.gross_amount || '')
    const signatureKey = String(body.signature_key || '')

    // Verify signature
    const crypto = require('crypto')
    const serverKey = process.env.MIDTRANS_SERVER_KEY
    const input = orderId + statusCode + grossAmount + serverKey
    const hash = crypto.createHash('sha512').update(input).digest('hex')
    const isValid = hash === signatureKey
    if (!isValid) {
      console.warn('[Express] Midtrans webhook invalid signature for order:', orderId)
      return res.status(400).json({ error: 'Invalid signature' })
    }

    // Fetch transaction by orderId (assumes orderId equals transaction.id or maps similarly)
    const tx = await db.Transaction.findByPk(orderId, {
      include: [{ model: db.TransactionItem, as: 'items' }]
    })
    if (!tx) return res.status(404).json({ error: 'Transaction not found for order' })

    const midStatus = String(body.transaction_status || '').toLowerCase()
    let newPaymentStatus = tx.paymentStatus
    let newTransactionStatus = tx.status

    if (midStatus === 'settlement' || midStatus === 'capture') {
      newPaymentStatus = 'PAID'
      newTransactionStatus = 'COMPLETED'
    } else if (midStatus === 'pending') {
      newPaymentStatus = 'PENDING'
      newTransactionStatus = 'PENDING'
    } else if (midStatus === 'deny' || midStatus === 'expire' || midStatus === 'cancel' || midStatus === 'failure') {
      newPaymentStatus = 'FAILED'
      newTransactionStatus = (midStatus === 'cancel') ? 'CANCELLED' : 'FAILED'
    }

    const previouslyPaid = String(tx.paymentStatus) === 'PAID'
    const nowPaid = newPaymentStatus === 'PAID'

    await db.Transaction.update({
      paymentStatus: newPaymentStatus,
      status: newTransactionStatus,
      ...(nowPaid ? { paidAt: new Date() } : {})
    }, { where: { id: tx.id } })

    // Stock adjustments: reduce when becoming PAID (not at creation for Midtrans), restore if had been paid then failed/cancelled
    if (nowPaid && !previouslyPaid) {
      await reduceStock(tx.items)
    } else if (previouslyPaid && newPaymentStatus !== 'PAID') {
      await restoreStock(tx.items)
    }

    return res.json({ message: 'Webhook processed', transactionId: tx.id, paymentStatus: newPaymentStatus, status: newTransactionStatus })
  } catch (err) {
    console.error('[Express] Midtrans webhook error:', err)
    return res.status(500).json({ error: 'Failed to process webhook' })
  }
})

module.exports = router