/**
 * This script manually updates a transaction status in the database
 * Useful for fixing transactions that didn't get updated by the webhook
 * 
 * Run with: node scripts/update-transaction-status.js <transaction_id>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateTransactionStatus() {
  // Get transaction ID from command line arguments
  const transactionId = process.argv[2];
  
  if (!transactionId) {
    console.error('Please provide a transaction ID');
    console.error('Usage: node scripts/update-transaction-status.js <transaction_id>');
    process.exit(1);
  }
  
  try {
    // Find the transaction
    console.log(`Looking for transaction with ID: ${transactionId}`);
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });
    
    if (!transaction) {
      console.error(`Transaction not found with ID: ${transactionId}`);
      process.exit(1);
    }
    
    console.log('Current transaction status:');
    console.log(`- Status: ${transaction.status}`);
    console.log(`- Payment Status: ${transaction.paymentStatus}`);
    console.log(`- Payment Method: ${transaction.paymentMethod}`);
    console.log(`- Paid At: ${transaction.paidAt || 'Not paid'}`);
    
    // Update the transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paidAt: transaction.paidAt || new Date()
      }
    });
    
    console.log('\nTransaction updated successfully:');
    console.log(`- Status: ${updatedTransaction.status}`);
    console.log(`- Payment Status: ${updatedTransaction.paymentStatus}`);
    console.log(`- Payment Method: ${updatedTransaction.paymentMethod}`);
    console.log(`- Paid At: ${updatedTransaction.paidAt}`);
    
    console.log('\nDone!');
  } catch (error) {
    console.error('Error updating transaction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTransactionStatus();