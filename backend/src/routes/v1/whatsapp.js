const { Router } = require('express')
const { authMiddleware } = require('../../middleware/auth')
const WhatsAppManager = require('../../services/whatsappManager')
const ReceiptFormatter = require('../../services/receiptFormatter')
const db = require('../../../../models')

const router = Router()

function requireAdmin(req, res) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden - Admin access required' })
  return null
}

// Connection status (GET), initialize connection (POST), disconnect (DELETE)
router.get('/connection', authMiddleware, async (req, res) => {
  const denied = requireAdmin(req, res)
  if (denied) return
  try {
    const manager = WhatsAppManager.getInstance()
    const status = manager.getConnectionStatus()
    return res.json({ isConnected: status.isConnected, qrCode: status.qrCode, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('Error getting WhatsApp connection status:', err)
    return res.status(500).json({ error: 'Failed to get connection status' })
  }
})

router.post('/connection', authMiddleware, async (req, res) => {
  const denied = requireAdmin(req, res)
  if (denied) return
  try {
    const manager = WhatsAppManager.getInstance()
    await manager.initialize()
    const status = manager.getConnectionStatus()
    return res.json({ success: true, message: 'WhatsApp connection initialized', isConnected: status.isConnected, qrCode: status.qrCode, timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('Error initializing WhatsApp connection:', err)
    return res.status(500).json({ error: 'Failed to initialize WhatsApp connection' })
  }
})

router.delete('/connection', authMiddleware, async (req, res) => {
  const denied = requireAdmin(req, res)
  if (denied) return
  try {
    const manager = WhatsAppManager.getInstance()
    await manager.disconnect()
    return res.json({ success: true, message: 'WhatsApp disconnected successfully', timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('Error disconnecting WhatsApp:', err)
    return res.status(500).json({ error: 'Failed to disconnect WhatsApp' })
  }
})

// Logout (disconnect and remove session files)
router.post('/logout', authMiddleware, async (req, res) => {
  const denied = requireAdmin(req, res)
  if (denied) return
  try {
    const manager = WhatsAppManager.getInstance()
    await manager.logout()
    return res.json({ success: true, message: 'WhatsApp logout successful - session files removed', timestamp: new Date().toISOString() })
  } catch (err) {
    console.error('Error logging out WhatsApp:', err)
    return res.status(500).json({ error: 'Failed to logout WhatsApp' })
  }
})

// Send transaction receipt via WhatsApp
router.post('/send-receipt', authMiddleware, async (req, res) => {
  try {
    const { transactionId, phoneNumber, receiptType = 'detailed' } = req.body || {}
    if (!transactionId || !phoneNumber) {
      return res.status(400).json({ error: 'Transaction ID and phone number are required' })
    }

    const phoneValidation = ReceiptFormatter.validatePhoneNumber(phoneNumber)
    if (!phoneValidation.isValid) {
      return res.status(400).json({ error: phoneValidation.error || 'Invalid phone number format' })
    }

    const transaction = await db.Transaction.findByPk(transactionId, {
      include: [
        { model: db.TransactionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Member, as: 'member' },
        { model: db.User, as: 'user' },
        { model: db.VoucherUsage, as: 'voucherUsages', include: [{ model: db.Voucher, as: 'voucher' }] },
      ],
    })
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    // Compute voucher detail if any
    let voucherCode = undefined
    let voucherMaxPerUser = undefined
    let voucherRemainingUses = undefined
    try {
      const firstUsage = (transaction.voucherUsages || []).find((u) => !!u.voucher)
      if (firstUsage && firstUsage.voucher) {
        voucherCode = firstUsage.voucher.code
        const maxPU = Number(firstUsage.voucher.maxUsesPerUser || 0)
        if (maxPU > 0) {
          voucherMaxPerUser = maxPU
          const where = {
            voucherId: firstUsage.voucherId,
          }
          if (transaction.memberId) {
            where.memberId = transaction.memberId
          } else if (transaction.userId) {
            where.userId = transaction.userId
          }
          const personalCount = await db.VoucherUsage.count({ where })
          voucherRemainingUses = Math.max(0, maxPU - personalCount)
        }
      }
    } catch (e) {
      console.warn('[Express] Failed computing voucher remaining uses:', e?.message || e)
    }

    const receiptData = {
      id: transaction.id,
      createdAt: transaction.createdAt,
      items: (transaction.items || []).map((item) => ({
        id: item.id,
        name: (item.product && item.product.name) || 'Unknown Product',
        quantity: item.quantity,
        price: item.price,
        total: item.subtotal,
        productCode: item.product ? item.product.code : undefined,
        size: item.product ? item.product.size : undefined,
        color: item.product ? item.product.color : undefined,
      })),
      subtotal: (transaction.items || []).reduce((sum, it) => sum + Number(it.subtotal || 0), 0),
      tax: transaction.tax,
      finalTotal: transaction.finalTotal,
      paymentMethod: transaction.paymentMethod,
      status: transaction.status,
      cashier: undefined,
      customer: transaction.customerName || undefined,
      customerPhone: transaction.customerPhone || undefined,
      customerEmail: transaction.customerEmail || undefined,
      pointsUsed: transaction.pointsUsed,
      pointsEarned: transaction.pointsEarned,
      voucherCode: voucherCode,
      voucherDiscount: transaction.voucherDiscount,
      promotionDiscount: transaction.promoDiscount,
      member: transaction.member ? { name: transaction.member.name, phone: transaction.member.phone || '', email: transaction.member.email || undefined, points: transaction.member.points } : undefined,
      user: transaction.user ? { name: transaction.user.name } : undefined,
    }

    const receiptMessage = receiptType === 'simple'
      ? ReceiptFormatter.formatSimpleReceipt(receiptData)
      : ReceiptFormatter.formatReceiptForWhatsApp(receiptData)

    const whatsappService = WhatsAppManager.getInstance()
    if (!whatsappService.isConnected()) {
      try {
        await whatsappService.initialize()
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (err) {
        console.error('[API] Failed to initialize WhatsApp service:', err)
      }
    }

    const maxRetries = 3
    const retryDelay = 2000
    let attempt = 0
    let result = null
    while (attempt < maxRetries) {
      attempt++
      if (!whatsappService.isConnected()) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          continue
        } else {
          return res.status(503).json({ error: 'WhatsApp service is not connected', details: 'Please ensure WhatsApp is connected before sending messages' })
        }
      }
      result = await whatsappService.sendMessage(phoneValidation.formatted || phoneNumber, receiptMessage)
      if (result.success) break
      const msg = (result.error || '').toLowerCase()
      if (attempt < maxRetries && (msg.includes('tidak terhubung') || msg.includes('not connected') || msg.includes('connection'))) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        continue
      } else {
        break
      }
    }

    if (!result || !result.success) {
      return res.status(500).json({ error: 'Failed to send WhatsApp message', details: (result && result.error) || 'Unknown error' })
    }

    return res.json({ success: true, message: 'Receipt sent successfully via WhatsApp', data: { transactionId, phoneNumber: phoneValidation.formatted || phoneNumber, messageId: result.messageId, sentAt: new Date().toISOString() } })
  } catch (error) {
    console.error('Error sending WhatsApp receipt:', error)
    return res.status(400).json({ error: 'Failed to send WhatsApp receipt', details: String(error?.message || error) })
  }
})

// Send cashier shift closure summary via WhatsApp
router.post('/send-closure-summary', authMiddleware, async (req, res) => {
  try {
    const { phoneNumber, report } = req.body || {}
    if (!phoneNumber || !report) {
      return res.status(400).json({ error: 'Phone number dan report wajib diisi' })
    }
    const phoneValidation = ReceiptFormatter.validatePhoneNumber(phoneNumber)
    if (!phoneValidation.isValid) {
      return res.status(400).json({ error: phoneValidation.error || 'Format nomor WhatsApp tidak valid' })
    }

    const formatIDR = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0)
    const formatDateTime = (date) => {
      if (!date) return '-'
      try { return new Date(date).toLocaleString('id-ID') } catch { return String(date) }
    }
    function formatClosureSummaryMessage(rpt) {
      const lines = []
      lines.push('*Ringkasan Penutupan Shift*')
      if (rpt && rpt.shiftId) lines.push(`Shift: ${rpt.shiftId}`)
      lines.push(`Mulai: ${formatDateTime(rpt?.startTime)}`)
      lines.push(`Selesai: ${formatDateTime(rpt?.endTime)}`)
      lines.push('')
      lines.push(`Saldo Awal: ${formatIDR(rpt?.openingBalance || 0)}`)
      lines.push(`Penjualan CASH: ${formatIDR(rpt?.cashSales || 0)}`)
      lines.push(`Total Transaksi: ${formatIDR(rpt?.totalTransactions || 0)}`)
      lines.push(`Kas Sistem (Expected): ${formatIDR(rpt?.systemExpectedCash || 0)}`)
      lines.push(`Kas Fisik: ${formatIDR(rpt?.physicalCash || 0)}`)
      lines.push(`Selisih: ${formatIDR(rpt?.difference || 0)}`)
      lines.push('')
      lines.push('*Pembayaran*')
      const pb = rpt?.paymentBreakdown || {}
      lines.push(`- CASH: ${formatIDR(pb?.CASH?.total || 0)} (${pb?.CASH?.count || 0} trx)`) 
      lines.push(`- CARD: ${formatIDR(pb?.CARD?.total || 0)} (${pb?.CARD?.count || 0} trx)`) 
      lines.push(`- QRIS: ${formatIDR(pb?.QRIS?.total || 0)} (${pb?.QRIS?.count || 0} trx)`) 
      lines.push(`- Transfer: ${formatIDR(pb?.BANK_TRANSFER?.total || 0)} (${pb?.BANK_TRANSFER?.count || 0} trx)`) 
      lines.push('')
      lines.push('*Status Transaksi*')
      const sc = rpt?.statusCounts || {}
      lines.push(`- Selesai: ${sc?.COMPLETED || 0}`)
      lines.push(`- Menunggu: ${sc?.PENDING || 0}`)
      lines.push(`- Dibatalkan: ${sc?.CANCELLED || 0}`)
      lines.push(`- Dikembalikan: ${sc?.REFUNDED || 0}`)
      lines.push('')
      lines.push('*Diskon & Pajak*')
      const dt = rpt?.discountTotals || {}
      lines.push(`- Diskon Manual: ${formatIDR(dt?.discount || 0)}`)
      lines.push(`- Diskon Voucher: ${formatIDR(dt?.voucherDiscount || 0)}`)
      lines.push(`- Diskon Promo: ${formatIDR(dt?.promoDiscount || 0)}`)
      lines.push(`- Pajak: ${formatIDR(dt?.tax || 0)}`)
      lines.push('')
      lines.push('*Poin & Item*')
      const pt = rpt?.pointsTotals || {}
      lines.push(`- Poin Diperoleh: ${pt?.earned || 0}`)
      lines.push(`- Poin Digunakan: ${pt?.used || 0}`)
      lines.push(`- Item Terjual: ${rpt?.itemsSold || 0}`)
      if (Array.isArray(rpt?.logs) && rpt.logs.length > 0) {
        lines.push('')
        lines.push('*Log Shift (3 terbaru)*')
        const lastLogs = rpt.logs.slice(-3)
        for (const l of lastLogs) lines.push(`- ${l.action} • ${formatDateTime(l.createdAt)}`)
      }
      lines.push('')
      lines.push('_Dikirim otomatis oleh sistem kasir._')
      return lines.join('\n')
    }

    const message = formatClosureSummaryMessage(report)
    const whatsappService = WhatsAppManager.getInstance()
    if (!whatsappService.isConnected()) {
      try {
        await whatsappService.initialize()
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (err) {
        console.error('[API] Gagal inisialisasi WhatsApp:', err)
      }
    }

    const maxRetries = 3
    const retryDelay = 2000
    let attempt = 0
    let result = null
    while (attempt < maxRetries) {
      attempt++
      if (!whatsappService.isConnected()) {
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
          continue
        } else {
          return res.status(503).json({ error: 'WhatsApp service is not connected', details: 'Pastikan WhatsApp tersambung sebelum mengirim pesan' })
        }
      }
      result = await whatsappService.sendMessage(phoneValidation.formatted || phoneNumber, message)
      if (result.success) break
      const msg = (result.error || '').toLowerCase()
      if (attempt < maxRetries && (msg.includes('tidak terhubung') || msg.includes('not connected') || msg.includes('connection'))) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
        continue
      } else {
        break
      }
    }

    if (!result || !result.success) {
      return res.status(500).json({ error: 'Gagal mengirim pesan WhatsApp', details: (result && result.error) || 'Unknown error' })
    }
    return res.json({ success: true, message: 'Ringkasan penutupan dikirim via WhatsApp', data: { phoneNumber: phoneValidation.formatted || phoneNumber, messageId: result.messageId, sentAt: new Date().toISOString() } })
  } catch (error) {
    console.error('Error sending closure summary via WhatsApp:', error)
    return res.status(400).json({ error: 'Failed to send closure summary', details: String(error?.message || error) })
  }
})

module.exports = router
