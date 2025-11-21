#!/usr/bin/env node
const db = require('../models')

async function run() {
  try {
    const user = await db.User.findOne({ where: {}, order: [['id', 'ASC']] })
    if (!user) {
      throw new Error('No user found in users table to use as createdBy')
    }
    console.log('Using user id:', user.id)

    const payload = {
      name: 'Test Expense',
      amount: 123.45,
      category: 'Testing',
      date: new Date(),
      description: 'Automated test record',
      receipt: null,
      createdBy: user.id
    }

    const created = await db.OperationalExpense.create(payload)
    console.log('Created operational_expense id:', created.id)

    // Clean up
    await db.OperationalExpense.destroy({ where: { id: created.id } })
    console.log('Cleanup done')
  } catch (err) {
    console.error('Test failed:', err)
    process.exitCode = 1
  } finally {
    await db.sequelize.close()
  }
}

run()