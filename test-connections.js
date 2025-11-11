
require('dotenv').config({ path: '.env.migration' });
const { PrismaClient } = require('@prisma/client');
const { Sequelize } = require('sequelize');

async function testConnections() {
  console.log('🔍 Testing database connections...\n');
  
  // Test Prisma connection
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: "file:./prisma/dev.db"
        }
      }
    });
    
    await prisma.$connect();
    console.log('✅ Prisma connection successful');
    
    // Count records in User table
    const userCount = await prisma.user.count();
    console.log(`📊 Found ${userCount} users in Prisma database`);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Prisma connection failed:', error.message);
  }
  
  // Test Sequelize connection
  try {
    const sequelize = new Sequelize({
      dialect: process.env.SEQUELIZE_DIALECT,
      storage: process.env.SEQUELIZE_STORAGE,
      logging: false
    });
    
    await sequelize.authenticate();
    console.log('✅ Sequelize connection successful');
    
    await sequelize.close();
  } catch (error) {
    console.error('❌ Sequelize connection failed:', error.message);
  }
}

if (require.main === module) {
  testConnections().catch(console.error);
}

module.exports = { testConnections };
