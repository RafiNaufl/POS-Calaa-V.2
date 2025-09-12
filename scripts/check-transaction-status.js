/**
 * Script untuk memeriksa status transaksi di database
 * 
 * Cara penggunaan: node scripts/check-transaction-status.js <transaction_id>
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransactionStatus() {
  // Ambil ID transaksi dari argumen command line
  const transactionId = process.argv[2];
  
  if (!transactionId) {
    console.error('Harap berikan ID transaksi');
    console.error('Penggunaan: node scripts/check-transaction-status.js <transaction_id>');
    process.exit(1);
  }
  
  try {
    // Cari transaksi
    console.log(`Mencari transaksi dengan ID: ${transactionId}`);
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        items: true,
        customer: true
      }
    });
    
    if (!transaction) {
      console.error(`Transaksi tidak ditemukan dengan ID: ${transactionId}`);
      process.exit(1);
    }
    
    // Tampilkan informasi transaksi
    console.log('\nInformasi Transaksi:');
    console.log(`- ID: ${transaction.id}`);
    console.log(`- Tanggal: ${transaction.createdAt}`);
    console.log(`- Total: ${transaction.total}`);
    console.log(`- Status: ${transaction.status}`);
    console.log(`- Status Pembayaran: ${transaction.paymentStatus}`);
    console.log(`- Metode Pembayaran: ${transaction.paymentMethod || 'Belum dipilih'}`);
    console.log(`- Dibayar Pada: ${transaction.paidAt || 'Belum dibayar'}`);
    
    if (transaction.customer) {
      console.log(`- Pelanggan: ${transaction.customer.name} (${transaction.customer.phone || 'Tidak ada nomor'})`);
    }
    
    console.log('\nItem Transaksi:');
    if (transaction.items && transaction.items.length > 0) {
      transaction.items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} - ${item.quantity} x ${item.price} = ${item.quantity * item.price}`);
      });
    } else {
      console.log('Tidak ada item dalam transaksi ini');
    }
    
    // Berikan saran berdasarkan status
    console.log('\nAnalisis Status:');
    if (transaction.status === 'PENDING' && transaction.paymentStatus === 'PENDING') {
      console.log('Transaksi ini masih PENDING. Anda dapat memperbaikinya secara manual jika pembayaran sudah berhasil.');
    } else if (transaction.status === 'COMPLETED' && transaction.paymentStatus === 'PAID') {
      console.log('Transaksi ini sudah SELESAI dan TERBAYAR. Tidak perlu tindakan lebih lanjut.');
    } else if (transaction.status === 'CANCELLED') {
      console.log('Transaksi ini sudah DIBATALKAN. Tidak dapat diubah lagi.');
    } else {
      console.log(`Status transaksi tidak standar (${transaction.status}/${transaction.paymentStatus}). Mungkin perlu diperiksa lebih lanjut.`);
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkTransactionStatus();