// Forwarder to backend Sequelize models
// This allows routes to `require('../../../../models')` regardless of runtime location.
module.exports = require('../backend/src/models')