const pino = require('pino')

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

function requestLogger(req, res, next) {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration
    }, 'request')
  })
  next()
}

module.exports = { requestLogger, logger }