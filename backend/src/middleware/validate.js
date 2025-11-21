// Simple request validation middleware using declarative rules per route

function buildValidator(rules = {}) {
  return function validate(req, res, next) {
    try {
      const location = rules.location || 'body'
      const schema = rules.schema || {}
      const target = location === 'query' ? req.query : location === 'params' ? req.params : req.body
      const errors = []
      for (const [key, rule] of Object.entries(schema)) {
        const value = target[key]
        const required = rule.required === true
        if (required && (value === undefined || value === null || value === '')) {
          errors.push(`${key} is required`)
          continue
        }
        if (value !== undefined && rule.type) {
          const type = rule.type
          const ok = type === 'number' ? !isNaN(Number(value)) : typeof value === type
          if (!ok) {
            errors.push(`${key} must be a ${type}`)
          }
        }
        if (value !== undefined && rule.enum && Array.isArray(rule.enum)) {
          if (!rule.enum.includes(value)) {
            errors.push(`${key} must be one of: ${rule.enum.join(', ')}`)
          }
        }
      }
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors })
      }
      next()
    } catch (err) {
      return res.status(400).json({ error: 'Validation error', details: String(err?.message || err) })
    }
  }
}

module.exports = { buildValidator }