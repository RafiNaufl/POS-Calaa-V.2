const { PrismaClient } = require('@prisma/client');
const db = require('../sequelize-models-example');

/**
 * Data Migration Script from Prisma to Sequelize
 * Script untuk migrasi data dari database Prisma ke Sequelize
 */

class DataMigrator {
  constructor() {
    this.prisma = new PrismaClient();
    this.sequelize = db.sequelize;
    this.models = db;
    this.migrationLog = [];
  }

  /**
   * Log migration progress
   */
  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, type, message };
    this.migrationLog.push(logEntry);
    
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  /**
   * Validate data before migration
   */
  async validateData() {
    this.log('Starting data validation...');
    
    try {
      // Check Prisma connection
      await this.prisma.$connect();
      this.log('Prisma connection successful');

      // Check Sequelize connection
      await this.sequelize.authenticate();
      this.log('Sequelize connection successful');

      // Count records in Prisma
      const counts = {};
      const models = ['user', 'category', 'product', 'transaction', 'member', 'voucher'];
      
      for (const model of models) {
        try {
          counts[model] = await this.prisma[model].count();
          this.log(`${model}: ${counts[model]} records`);
        } catch (error) {
          this.log(`Error counting ${model}: ${error.message}`, 'error');
        }
      }

      return counts;
    } catch (error) {
      this.log(`Validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Migrate users
   */
  async migrateUsers() {
    this.log('Migrating users...');
    
    try {
      const users = await this.prisma.user.findMany();
      let migrated = 0;
      let errors = 0;

      for (const user of users) {
        try {
          await this.models.User.create({
            id: user.id,
            email: user.email,
            name: user.name,
            password: user.password,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          });
          migrated++;
        } catch (error) {
          this.log(`Error migrating user ${user.id}: ${error.message}`, 'error');
          errors++;
        }
      }

      this.log(`Users migration completed: ${migrated} success, ${errors} errors`, 'success');
      return { migrated, errors };
    } catch (error) {
      this.log(`Users migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Migrate categories
   */
  async migrateCategories() {
    this.log('Migrating categories...');
    
    try {
      const categories = await this.prisma.category.findMany();
      let migrated = 0;
      let errors = 0;

      for (const category of categories) {
        try {
          await this.models.Category.create({
            id: category.id,
            name: category.name,
            description: category.description,
            createdAt: category.createdAt,
            updatedAt: category.updatedAt,
          });
          migrated++;
        } catch (error) {
          this.log(`Error migrating category ${category.id}: ${error.message}`, 'error');
          errors++;
        }
      }

      this.log(`Categories migration completed: ${migrated} success, ${errors} errors`, 'success');
      return { migrated, errors };
    } catch (error) {
      this.log(`Categories migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Migrate products
   */
  async migrateProducts() {
    this.log('Migrating products...');
    
    try {
      const products = await this.prisma.product.findMany();
      let migrated = 0;
      let errors = 0;

      for (const product of products) {
        try {
          await this.models.Product.create({
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            stock: product.stock,
            image: product.image,
            categoryId: product.categoryId,
            isActive: product.isActive,
            costPrice: product.costPrice,
            productCode: product.productCode,
            color: product.color,
            size: product.size,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
          });
          migrated++;
        } catch (error) {
          this.log(`Error migrating product ${product.id}: ${error.message}`, 'error');
          errors++;
        }
      }

      this.log(`Products migration completed: ${migrated} success, ${errors} errors`, 'success');
      return { migrated, errors };
    } catch (error) {
      this.log(`Products migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Migrate members
   */
  async migrateMembers() {
    this.log('Migrating members...');
    
    try {
      const members = await this.prisma.member.findMany();
      let migrated = 0;
      let errors = 0;

      for (const member of members) {
        try {
          await this.models.Member.create({
            id: member.id,
            name: member.name,
            phone: member.phone,
            email: member.email,
            points: member.points,
            totalSpent: member.totalSpent,
            joinDate: member.joinDate,
            lastVisit: member.lastVisit,
            isActive: member.isActive,
            createdAt: member.createdAt,
            updatedAt: member.updatedAt,
          });
          migrated++;
        } catch (error) {
          this.log(`Error migrating member ${member.id}: ${error.message}`, 'error');
          errors++;
        }
      }

      this.log(`Members migration completed: ${migrated} success, ${errors} errors`, 'success');
      return { migrated, errors };
    } catch (error) {
      this.log(`Members migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Migrate transactions
   */
  async migrateTransactions() {
    this.log('Migrating transactions...');
    
    try {
      const transactions = await this.prisma.transaction.findMany({
        include: {
          items: true,
        },
      });
      let migrated = 0;
      let errors = 0;

      for (const transaction of transactions) {
        const t = await this.sequelize.transaction();
        
        try {
          // Create transaction
          const newTransaction = await this.models.Transaction.create({
            id: transaction.id,
            total: transaction.total,
            tax: transaction.tax,
            discount: transaction.discount,
            voucherDiscount: transaction.voucherDiscount,
            promoDiscount: transaction.promoDiscount,
            finalTotal: transaction.finalTotal,
            paymentMethod: transaction.paymentMethod,
            status: transaction.status,
            paymentStatus: transaction.paymentStatus,
            paidAt: transaction.paidAt,
            failureReason: transaction.failureReason,
            userId: transaction.userId,
            customerName: transaction.customerName,
            customerPhone: transaction.customerPhone,
            customerEmail: transaction.customerEmail,
            memberId: transaction.memberId,
            pointsEarned: transaction.pointsEarned,
            pointsUsed: transaction.pointsUsed,
            notes: transaction.notes,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt,
          }, { transaction: t });

          // Create transaction items
          for (const item of transaction.items) {
            await this.models.TransactionItem.create({
              id: item.id,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
              transactionId: item.transactionId,
              productId: item.productId,
            }, { transaction: t });
          }

          await t.commit();
          migrated++;
        } catch (error) {
          await t.rollback();
          this.log(`Error migrating transaction ${transaction.id}: ${error.message}`, 'error');
          errors++;
        }
      }

      this.log(`Transactions migration completed: ${migrated} success, ${errors} errors`, 'success');
      return { migrated, errors };
    } catch (error) {
      this.log(`Transactions migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Migrate vouchers
   */
  async migrateVouchers() {
    this.log('Migrating vouchers...');
    
    try {
      const vouchers = await this.prisma.voucher.findMany();
      let migrated = 0;
      let errors = 0;

      for (const voucher of vouchers) {
        try {
          await this.models.Voucher.create({
            id: voucher.id,
            code: voucher.code,
            name: voucher.name,
            description: voucher.description,
            type: voucher.type,
            value: voucher.value,
            minPurchase: voucher.minPurchase,
            maxDiscount: voucher.maxDiscount,
            usageLimit: voucher.usageLimit,
            usageCount: voucher.usageCount,
            perUserLimit: voucher.perUserLimit,
            startDate: voucher.startDate,
            endDate: voucher.endDate,
            isActive: voucher.isActive,
            restrictedToCategories: voucher.restrictedToCategories,
            restrictedToProducts: voucher.restrictedToProducts,
            createdAt: voucher.createdAt,
            updatedAt: voucher.updatedAt,
          });
          migrated++;
        } catch (error) {
          this.log(`Error migrating voucher ${voucher.id}: ${error.message}`, 'error');
          errors++;
        }
      }

      this.log(`Vouchers migration completed: ${migrated} success, ${errors} errors`, 'success');
      return { migrated, errors };
    } catch (error) {
      this.log(`Vouchers migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Verify migration results
   */
  async verifyMigration() {
    this.log('Verifying migration results...');
    
    try {
      const verification = {};
      
      // Count records in both databases
      const models = [
        { prisma: 'user', sequelize: 'User' },
        { prisma: 'category', sequelize: 'Category' },
        { prisma: 'product', sequelize: 'Product' },
        { prisma: 'transaction', sequelize: 'Transaction' },
        { prisma: 'member', sequelize: 'Member' },
        { prisma: 'voucher', sequelize: 'Voucher' },
      ];

      for (const model of models) {
        const prismaCount = await this.prisma[model.prisma].count();
        
        // Check if Sequelize model exists before counting
        let sequelizeCount = 0;
        if (this.models[model.sequelize]) {
          sequelizeCount = await this.models[model.sequelize].count();
        }
        
        verification[model.prisma] = {
          prisma: prismaCount,
          sequelize: sequelizeCount,
          match: prismaCount === sequelizeCount,
        };

        if (prismaCount === sequelizeCount) {
          this.log(`✅ ${model.prisma}: ${prismaCount} records match`);
        } else {
          this.log(`❌ ${model.prisma}: Prisma(${prismaCount}) != Sequelize(${sequelizeCount})`, 'error');
        }
      }

      return verification;
    } catch (error) {
      this.log(`Verification failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Run complete migration
   */
  async runMigration() {
    const startTime = Date.now();
    this.log('🚀 Starting complete data migration...');

    try {
      // Validate data
      await this.validateData();

      // Start transaction for the entire migration
      const transaction = await this.sequelize.transaction();

      try {
        // Migrate in order (respecting foreign key constraints)
        await this.migrateUsers();
        await this.migrateCategories();
        await this.migrateProducts();
        await this.migrateMembers();
        await this.migrateVouchers();
        await this.migrateTransactions();

        // Commit transaction
        await transaction.commit();
        this.log('All migrations committed successfully', 'success');

        // Verify results
        const verification = await this.verifyMigration();

        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;

        this.log(`🎉 Migration completed in ${duration}s`, 'success');

        // Generate migration report
        await this.generateReport(verification, duration);

        return verification;
      } catch (error) {
        await transaction.rollback();
        this.log('Migration rolled back due to error', 'error');
        throw error;
      }
    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    } finally {
      await this.prisma.$disconnect();
      await this.sequelize.close();
    }
  }

  /**
   * Generate migration report
   */
  async generateReport(verification, duration) {
    const report = {
      timestamp: new Date().toISOString(),
      duration: `${duration}s`,
      verification,
      logs: this.migrationLog,
    };

    const fs = require('fs');
    const reportPath = `migration-report-${Date.now()}.json`;
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`📊 Migration report saved to: ${reportPath}`, 'success');
  }

  /**
   * Rollback migration (delete all Sequelize data)
   */
  async rollback() {
    this.log('🔄 Starting migration rollback...');

    try {
      await this.sequelize.authenticate();

      // Disable foreign key checks
      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

      // Truncate all tables in reverse order
      const models = ['TransactionItem', 'Transaction', 'Voucher', 'Member', 'Product', 'Category', 'User'];
      
      for (const modelName of models) {
        if (this.models[modelName]) {
          await this.models[modelName].destroy({ where: {}, truncate: true });
          this.log(`Cleared ${modelName} table`);
        }
      }

      // Re-enable foreign key checks
      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

      this.log('✅ Rollback completed successfully', 'success');
    } catch (error) {
      this.log(`Rollback failed: ${error.message}`, 'error');
      throw error;
    }
  }
}

// CLI Usage
if (require.main === module) {
  const migrator = new DataMigrator();
  
  const command = process.argv[2] || 'migrate';

  switch (command) {
    case 'migrate':
      migrator.runMigration().catch(console.error);
      break;
    case 'verify':
      migrator.verifyMigration().catch(console.error);
      break;
    case 'rollback':
      migrator.rollback().catch(console.error);
      break;
    default:
      console.log('Usage: node data-migration.js [migrate|verify|rollback]');
  }
}

module.exports = DataMigrator;