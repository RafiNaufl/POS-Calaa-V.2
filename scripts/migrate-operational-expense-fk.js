#!/usr/bin/env node
const { sequelize } = require('../lib/sequelize')

async function run() {
  const qi = sequelize.getQueryInterface()
  const dialect = sequelize.getDialect()

  if (dialect !== 'postgres') {
    console.log(`Dialect ${dialect} not supported by this script. Skipping.`)
    return
  }

  const wrap = (id) => `"${id}"`

  try {
    console.log('Ensuring operational_expense table exists...')
    await qi.describeTable('operational_expense')
  } catch (err) {
    console.error('Table operational_expense does not exist or cannot be described:', err.message)
    process.exit(1)
  }

  // Drop old FK if it references "User"
  try {
    console.log('Dropping old FK constraint "operational_expense_createdBy_fkey" if exists...')
    await sequelize.query(
      `ALTER TABLE ${wrap('operational_expense')} 
       DROP CONSTRAINT IF EXISTS ${wrap('operational_expense_createdBy_fkey')}`
    )
  } catch (err) {
    console.warn('Failed to drop old FK (continuing):', err.message)
  }

  // Align column type to integer
  try {
    console.log('Altering column createdBy to INTEGER...')
    await sequelize.query(
      `ALTER TABLE ${wrap('operational_expense')} 
       ALTER COLUMN ${wrap('createdBy')} TYPE INTEGER 
       USING NULLIF(${wrap('createdBy')}, '')::INTEGER`
    )
  } catch (err) {
    console.error('Failed to alter createdBy to INTEGER:', err.message)
    process.exit(1)
  }

  // Add new FK to lowercase users(id)
  try {
    console.log('Adding new FK constraint to users(id)...')
    await sequelize.query(
      `ALTER TABLE ${wrap('operational_expense')} 
       ADD CONSTRAINT ${wrap('operational_expense_createdBy_fkey')} 
       FOREIGN KEY (${wrap('createdBy')}) REFERENCES ${wrap('users')}(${wrap('id')}) 
       ON UPDATE CASCADE ON DELETE RESTRICT`
    )
  } catch (err) {
    console.error('Failed to add new FK to users(id):', err.message)
    process.exit(1)
  }

  console.log('OperationalExpense.createdBy successfully migrated to INTEGER with FK -> users(id).')
}

run().then(() => {
  sequelize.close()
}).catch(err => {
  console.error('Migration error:', err)
  sequelize.close()
  process.exit(1)
})