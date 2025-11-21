function notFoundHandler(req, res, next) {
  res.status(404).json({ error: 'Not Found', path: req.originalUrl })
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500
  const code = err.code || 'INTERNAL_ERROR'
  const message = err.message || 'Unexpected error'
  const details = err.details || undefined
  console.error('[Error]', { status, code, message, path: req.originalUrl })
  res.status(status).json({ error: message, code, details })
}

module.exports = { notFoundHandler, errorHandler }