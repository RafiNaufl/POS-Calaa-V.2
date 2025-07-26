const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const count = await prisma.transaction.count();
    console.log(`Jumlah transaksi: ${count}`);
    
    if (count > 0) {
      // Cek apakah ada transaksi dalam 30 hari terakhir
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentCount = await prisma.transaction.count({
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          },
          status: 'COMPLETED'
        }
      });
      
      console.log(`Jumlah transaksi 30 hari terakhir: ${recentCount}`);
    }
  } catch (error) {
    console.error('Error saat mengakses database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});