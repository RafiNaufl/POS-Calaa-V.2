const db = require('../../../models')

/**
 * Middleware untuk mencegah transaksi double dengan idempotency key
 */
const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key']
  
  // Jika tidak ada idempotency key, lanjutkan seperti biasa
  if (!idempotencyKey) {
    return next()
  }

  try {
    // Cek apakah idempotency key sudah pernah digunakan
    const existingTransaction = await db.Transaction.findOne({
      where: { idempotencyKey },
      attributes: ['id', 'status', 'paymentStatus', 'total', 'paymentMethod']
    })

    if (existingTransaction) {
      // Jika sudah ada, kembalikan transaksi yang sudah ada
      return res.status(200).json({
        id: existingTransaction.id,
        status: existingTransaction.status,
        paymentStatus: existingTransaction.paymentStatus,
        total: existingTransaction.total,
        paymentMethod: existingTransaction.paymentMethod,
        message: 'Transaction already processed',
        duplicate: true
      })
    }

    // Simpan idempotency key di request untuk digunakan di controller
    req.idempotencyKey = idempotencyKey
    next()
  } catch (error) {
    console.error('[Idempotency] Error checking idempotency key:', error)
    // Jika error, lanjutkan tanpa idempotency protection
    next()
  }
}

module.exports = { idempotencyMiddleware }