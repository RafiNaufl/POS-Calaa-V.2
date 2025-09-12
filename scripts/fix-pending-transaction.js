/**
 * Script untuk memperbaiki transaksi yang statusnya masih pending meskipun pembayaran sudah berhasil
 * 
 * Cara penggunaan: node scripts/fix-pending-transaction.js <transaction_id>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPendingTransaction() {
  // Ambil ID transaksi dari argumen command line
  const transactionId = process.argv[2];
  
  if (!transactionId) {
    console.error('Harap berikan ID transaksi');
    console.error('Penggunaan: node scripts/fix-pending-transaction.js <transaction_id>');
    process.exit(1);
  }
  
  try {
    // Cari transaksi
    console.log(`Mencari transaksi dengan ID: ${transactionId}`);
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });
    
    if (!transaction) {
      console.error(`Transaksi tidak ditemukan dengan ID: ${transactionId}`);
      process.exit(1);
    }
    
    // Periksa apakah transaksi masih pending
    if (transaction.status !== 'PENDING' && transaction.paymentStatus !== 'PENDING') {
      console.log('Status transaksi saat ini:');
      console.log(`- Status: ${transaction.status}`);
      console.log(`- Status Pembayaran: ${transaction.paymentStatus}`);
      console.log(`- Metode Pembayaran: ${transaction.paymentMethod}`);
      console.log(`- Dibayar Pada: ${transaction.paidAt || 'Belum dibayar'}`);
      
      console.log('\nTransaksi ini tidak dalam status PENDING. Apakah Anda ingin melanjutkan? (y/n)');
      process.stdout.write('> ');
      
      process.stdin.once('data', async (data) => {
        const answer = data.toString().trim().toLowerCase();
        
        if (answer !== 'y' && answer !== 'yes') {
          console.log('Operasi dibatalkan.');
          process.exit(0);
        }
        
        await updateTransaction(transaction);
      });
    } else {
      await updateTransaction(transaction);
    }
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    process.exit(1);
  }
}

async function updateTransaction(transaction) {
  try {
    // Perbarui transaksi
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paidAt: transaction.paidAt || new Date()
      }
    });
    
    console.log('\nTransaksi berhasil diperbarui:');
    console.log(`- Status: ${updatedTransaction.status}`);
    console.log(`- Status Pembayaran: ${updatedTransaction.paymentStatus}`);
    console.log(`- Metode Pembayaran: ${updatedTransaction.paymentMethod}`);
    console.log(`- Dibayar Pada: ${updatedTransaction.paidAt}`);
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Gagal memperbarui transaksi:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fixPendingTransaction();