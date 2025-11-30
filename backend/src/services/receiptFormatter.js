// Lightweight JS adapter mirroring key functions from lib/receiptFormatter.ts

function formatCurrency(amount) {
  const num = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num)
}

function getPaymentMethodLabel(method) {
  const paymentMethods = {
    CASH: 'Tunai',
    CARD: 'Kartu',
    QRIS: 'QRIS',
    VIRTUAL_ACCOUNT: 'Virtual Account',
    CONVENIENCE_STORE: 'Convenience Store',
    PAYLATER: 'PayLater',
    BANK_TRANSFER: 'Transfer Bank',
  }
  return paymentMethods[method] || method
}

function getStatusLabel(status) {
  const statusLabels = {
    COMPLETED: 'Selesai',
    PENDING: 'Menunggu',
    CANCELLED: 'Dibatalkan',
    REFUNDED: 'Dikembalikan',
  }
  return statusLabels[status] || status
}

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(date))
  } catch {
    return String(date)
  }
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.,-]/g, '')
    let normalized = cleaned
    if (cleaned.includes('.') && cleaned.includes(',')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    } else if (cleaned.includes(',') && !cleaned.includes('.')) {
      normalized = cleaned.replace(',', '.')
    }
    const num = parseFloat(normalized)
    return Number.isFinite(num) ? num : 0
  }
  return 0
}

function formatReceiptForWhatsApp(transaction) {
  let receipt = `*Terima kasih telah berbelanja di Wear Calaa!*\n`

  receipt += `✅ *DETAIL TRANSAKSI*\n`
  receipt += ` - No. Transaksi: *${transaction.id}*\n`
  receipt += ` - Tanggal: ${formatDate(transaction.createdAt)}\n`
  receipt += ` - Kasir: ${transaction.user?.name || transaction.cashier || 'Admin'}\n`

  if (transaction.member) {
    receipt += ` - Member: ${transaction.member.name}\n`
    receipt += ` - Telepon: ${transaction.member.phone}\n`
    if (typeof transaction.member.points === 'number') {
      receipt += ` - Saldo Poin: ${transaction.member.points}\n`
    }
  } else if (transaction.customer) {
    receipt += ` - Pelanggan: ${transaction.customer}\n`
    if (transaction.customerPhone) {
      receipt += ` - Telepon: ${transaction.customerPhone}\n`
    }
  }
  receipt += `\n`

  receipt += `✅ *DETAIL PESANAN*\n`;
  (transaction.items || []).forEach((item, index) => {
    receipt += `${index + 1}. *${item.name}*\n`
    if (item.productCode) receipt += `    Kode: ${item.productCode}\n`
    if (item.size) receipt += `    Ukuran: ${item.size}\n`
    if (item.color) receipt += `    Warna: ${item.color}\n`
    const itemPrice = toNumber(item.price)
    const itemTotal = toNumber(item.total)
    const qty = toNumber(item.quantity)
    receipt += `    Jumlah: ${qty} × ${formatCurrency(itemPrice)} = *${formatCurrency(itemTotal)}*\n\n`
  })

  receipt += `✅ *RINCIAN PEMBAYARAN*\n`
  const subtotal = toNumber(transaction.subtotal)
  receipt += `Subtotal: ${formatCurrency(subtotal)}\n`
  const tax = toNumber(transaction.tax)
  if (tax > 0) receipt += `Pajak: ${formatCurrency(tax)}\n`

  const pointsUsed = toNumber(transaction.pointsUsed)
  if (pointsUsed > 0) {
    const pointDiscount = pointsUsed * 1000
    receipt += `Diskon Poin (${pointsUsed} poin): -${formatCurrency(pointDiscount)}\n`
  }

  const voucherDiscount = toNumber(transaction.voucherDiscount)
  if (voucherDiscount > 0) {
    const label = transaction.voucherCode ? `Diskon Voucher (${transaction.voucherCode})` : '🎟️ Diskon Voucher'
    receipt += `${label}: -${formatCurrency(voucherDiscount)}\n`
  }

  const promotionDiscount = toNumber(transaction.promotionDiscount)
  if (promotionDiscount > 0) {
    receipt += `Diskon Promosi: -${formatCurrency(promotionDiscount)}\n`
  }

  const finalTotal = toNumber(transaction.finalTotal)
  receipt += `\n *TOTAL PEMBAYARAN: ${formatCurrency(finalTotal)}*\n`

  receipt += `Metode Pembayaran: ${getPaymentMethodLabel(transaction.paymentMethod)}\n`
  receipt += `Status: ${getStatusLabel(transaction.status)}\n`

  const pointsEarned = toNumber(transaction.pointsEarned)
  if (pointsEarned > 0) receipt += `Poin Diperoleh: +${pointsEarned} poin\n`

  receipt += `\n👕 *WEAR CALAA*\n`
  receipt += `📍 Jl. KH. M. Sadeli, Karangasem\n`
  receipt += `   Kec. Cibeber, Kota Cilegon\n`
  receipt += `   Banten 42426\n`
  receipt += `📞 0821-1382-3194\n`
  receipt += `📱 Instagram/TikTok @wear.calaa\n`

  receipt += `\n🙏 Terima kasih! Sampai jumpa di Wear Calaa!`
  return receipt
}

function formatSimpleReceipt(transaction) {
  const lines = []
  lines.push(`Transaksi #${transaction.id}`)
  lines.push(`Tanggal: ${formatDate(transaction.createdAt)}`)
  lines.push(`Kasir: ${transaction.user?.name || transaction.cashier || 'Admin'}`)
  lines.push('')
  lines.push('Item:')
  ;(transaction.items || []).forEach((i) => {
    const qty = toNumber(i.quantity)
    const price = toNumber(i.price)
    const total = toNumber(i.total)
    lines.push(`- ${i.name} x${qty} @ ${formatCurrency(price)} = ${formatCurrency(total)}`)
  })
  lines.push('')
  lines.push(`Total: ${formatCurrency(toNumber(transaction.finalTotal))}`)
  lines.push(`Metode: ${getPaymentMethodLabel(transaction.paymentMethod)}`)
  return lines.join('\n')
}

function validatePhoneNumber(phoneNumber) {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { isValid: false, error: 'Nomor WhatsApp wajib diisi' }
  }
  const trimmed = phoneNumber.trim()
  // Basic patterns: 08xx..., +62..., 62...
  let formatted = trimmed
  if (trimmed.startsWith('0')) {
    formatted = `62${trimmed.slice(1)}`
  } else if (trimmed.startsWith('+62')) {
    formatted = trimmed.replace(/^\+62/, '62')
  }
  // Remove non-digits
  formatted = formatted.replace(/\D/g, '')
  if (!/^62\d{8,15}$/.test(formatted)) {
    return { isValid: false, error: 'Format nomor WhatsApp tidak valid' }
  }
  return { isValid: true, formatted }
}

module.exports = {
  formatReceiptForWhatsApp,
  formatSimpleReceipt,
  validatePhoneNumber,
}
