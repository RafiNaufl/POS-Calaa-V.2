const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

/**
 * Schema Synchronization Script
 * Script untuk sinkronisasi skema database dari Prisma ke Sequelize
 */

class SchemaSynchronizer {
  constructor(config = {}) {
    // Load Sequelize configuration
    const sequelizeConfig = require('../sequelize.config.js');
    const environment = process.env.NODE_ENV || 'development';
    const dbConfig = sequelizeConfig[environment];

    this.config = {
      dialect: dbConfig.dialect || 'sqlite',
      storage: dbConfig.storage || './prisma/dev_sequelize.db',
      logging: dbConfig.logging !== false,
      pool: dbConfig.pool,
      ...config
    };

    this.sequelize = new Sequelize(this.config);
    this.models = {};
  }

  /**
   * Log messages with timestamp
   */
  log(message, type = 'info') {
    if (!this.config.logging) return;
    
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  /**
   * Load all Sequelize models
   */
  async loadModels() {
    this.log('Loading Sequelize models...');
    
    try {
      const modelsPath = path.join(__dirname, '../sequelize-models-example');
      const modelFiles = fs.readdirSync(modelsPath)
        .filter(file => file.endsWith('.js') && file !== 'index.js');

      for (const file of modelFiles) {
        const modelPath = path.join(modelsPath, file);
        const model = require(modelPath);
        
        if (typeof model === 'function') {
          const modelInstance = model(this.sequelize, Sequelize.DataTypes);
          this.models[modelInstance.name] = modelInstance;
          this.log(`Loaded model: ${modelInstance.name}`);
        }
      }

      // Setup associations
      Object.keys(this.models).forEach(modelName => {
        if (this.models[modelName].associate) {
          this.models[modelName].associate(this.models);
        }
      });

      this.log(`Successfully loaded ${Object.keys(this.models).length} models`, 'success');
      return this.models;
    } catch (error) {
      this.log(`Error loading models: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    this.log('Testing database connection...');
    
    try {
      await this.sequelize.authenticate();
      this.log('Database connection successful', 'success');
      return true;
    } catch (error) {
      this.log(`Database connection failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Create database if it doesn't exist
   */
  async createDatabase() {
    this.log('Checking if database exists...');
    
    try {
      // For SQLite, we don't need to create database - it's created automatically
      if (this.config.dialect === 'sqlite') {
        this.log('Using SQLite - database file will be created automatically');
        return;
      }

      // For other databases (MySQL, PostgreSQL)
      const tempSequelize = new Sequelize({
        ...this.config,
        database: undefined
      });

      await tempSequelize.authenticate();
      
      // Check if database exists
      const [results] = await tempSequelize.query(
        `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = '${this.config.database}'`
      );

      if (results.length === 0) {
        this.log(`Creating database: ${this.config.database}`);
        await tempSequelize.query(`CREATE DATABASE \`${this.config.database}\``);
        this.log(`Database ${this.config.database} created successfully`, 'success');
      } else {
        this.log(`Database ${this.config.database} already exists`);
      }

      await tempSequelize.close();
    } catch (error) {
      this.log(`Error creating database: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Sync all models to database
   */
  async syncModels(options = {}) {
    this.log('Starting model synchronization...');
    
    try {
      const syncOptions = {
        force: options.force || false,
        alter: options.alter || false,
        logging: this.config.logging ? console.log : false,
        ...options
      };

      if (syncOptions.force) {
        this.log('⚠️ Force sync enabled - all tables will be dropped and recreated', 'warning');
      } else if (syncOptions.alter) {
        this.log('Alter sync enabled - tables will be modified to match models', 'warning');
      }

      // Sync models in dependency order
      const syncOrder = [
        'User',
        'Category', 
        'Member',
        'Product',
        'Voucher',
        'Promotion',
        'Transaction',
        'TransactionItem',
        'VoucherUsage',
        'PointHistory',
        'ProductPromotion',
        'CategoryPromotion',
        'OperationalExpense'
      ];

      for (const modelName of syncOrder) {
        if (this.models[modelName]) {
          this.log(`Syncing model: ${modelName}`);
          await this.models[modelName].sync(syncOptions);
          this.log(`✅ ${modelName} synced successfully`);
        }
      }

      this.log('All models synchronized successfully', 'success');
    } catch (error) {
      this.log(`Model synchronization failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Generate migration files
   */
  async generateMigrations() {
    this.log('Generating migration files...');
    
    try {
      const migrationsDir = path.join(__dirname, '../migrations');
      
      // Create migrations directory if it doesn't exist
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
      
      // Generate create tables migration
      const migrationContent = this.generateCreateTablesMigration();
      const migrationFile = path.join(migrationsDir, `${timestamp}-create-tables.js`);
      
      fs.writeFileSync(migrationFile, migrationContent);
      this.log(`Migration file created: ${migrationFile}`, 'success');

      // Generate indexes migration
      const indexMigrationContent = this.generateIndexesMigration();
      const indexMigrationFile = path.join(migrationsDir, `${timestamp}-create-indexes.js`);
      
      fs.writeFileSync(indexMigrationFile, indexMigrationContent);
      this.log(`Index migration file created: ${indexMigrationFile}`, 'success');

      return { migrationFile, indexMigrationFile };
    } catch (error) {
      this.log(`Error generating migrations: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Generate create tables migration content
   */
  generateCreateTablesMigration() {
    return `'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create Users table
    await queryInterface.createTable('Users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('ADMIN', 'CASHIER', 'MANAGER'),
        allowNull: false,
        defaultValue: 'CASHIER'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create Categories table
    await queryInterface.createTable('Categories', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create Members table
    await queryInterface.createTable('Members', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      phone: {
        type: Sequelize.STRING,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        unique: true
      },
      points: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      totalSpent: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      joinDate: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      lastVisit: {
        type: Sequelize.DATE
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create Products table
    await queryInterface.createTable('Products', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      image: {
        type: Sequelize.STRING
      },
      categoryId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Categories',
          key: 'id'
        }
      },
      isActive: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      costPrice: {
        type: Sequelize.DECIMAL(10, 2)
      },
      productCode: {
        type: Sequelize.STRING,
        unique: true
      },
      color: {
        type: Sequelize.STRING
      },
      size: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create Transactions table
    await queryInterface.createTable('Transactions', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      total: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      tax: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      discount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      voucherDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      promoDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 0
      },
      finalTotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      paymentMethod: {
        type: Sequelize.ENUM('CASH', 'CARD', 'QRIS', 'BANK_TRANSFER'),
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'COMPLETED', 'CANCELLED', 'REFUNDED'),
        defaultValue: 'PENDING'
      },
      paymentStatus: {
        type: Sequelize.ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED'),
        defaultValue: 'PENDING'
      },
      paidAt: {
        type: Sequelize.DATE
      },
      failureReason: {
        type: Sequelize.STRING
      },
      userId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        }
      },
      customerName: {
        type: Sequelize.STRING
      },
      customerPhone: {
        type: Sequelize.STRING
      },
      customerEmail: {
        type: Sequelize.STRING
      },
      memberId: {
        type: Sequelize.STRING,
        references: {
          model: 'Members',
          key: 'id'
        }
      },
      pointsEarned: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      pointsUsed: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      notes: {
        type: Sequelize.TEXT
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Create TransactionItems table
    await queryInterface.createTable('TransactionItems', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.STRING
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      subtotal: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      transactionId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Transactions',
          key: 'id'
        }
      },
      productId: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'Products',
          key: 'id'
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('TransactionItems');
    await queryInterface.dropTable('Transactions');
    await queryInterface.dropTable('Products');
    await queryInterface.dropTable('Members');
    await queryInterface.dropTable('Categories');
    await queryInterface.dropTable('Users');
  }
};`;
  }

  /**
   * Generate indexes migration content
   */
  generateIndexesMigration() {
    return `'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add indexes for better performance
    
    // Users indexes
    await queryInterface.addIndex('Users', ['email']);
    await queryInterface.addIndex('Users', ['role']);

    // Products indexes
    await queryInterface.addIndex('Products', ['categoryId']);
    await queryInterface.addIndex('Products', ['productCode']);
    await queryInterface.addIndex('Products', ['isActive']);
    await queryInterface.addIndex('Products', ['name']);

    // Transactions indexes
    await queryInterface.addIndex('Transactions', ['userId']);
    await queryInterface.addIndex('Transactions', ['memberId']);
    await queryInterface.addIndex('Transactions', ['status']);
    await queryInterface.addIndex('Transactions', ['paymentStatus']);
    await queryInterface.addIndex('Transactions', ['createdAt']);

    // TransactionItems indexes
    await queryInterface.addIndex('TransactionItems', ['transactionId']);
    await queryInterface.addIndex('TransactionItems', ['productId']);

    // Members indexes
    await queryInterface.addIndex('Members', ['phone']);
    await queryInterface.addIndex('Members', ['email']);
    await queryInterface.addIndex('Members', ['isActive']);

    // Categories indexes
    await queryInterface.addIndex('Categories', ['name']);
  },

  async down(queryInterface, Sequelize) {
    // Remove indexes
    await queryInterface.removeIndex('Users', ['email']);
    await queryInterface.removeIndex('Users', ['role']);
    await queryInterface.removeIndex('Products', ['categoryId']);
    await queryInterface.removeIndex('Products', ['productCode']);
    await queryInterface.removeIndex('Products', ['isActive']);
    await queryInterface.removeIndex('Products', ['name']);
    await queryInterface.removeIndex('Transactions', ['userId']);
    await queryInterface.removeIndex('Transactions', ['memberId']);
    await queryInterface.removeIndex('Transactions', ['status']);
    await queryInterface.removeIndex('Transactions', ['paymentStatus']);
    await queryInterface.removeIndex('Transactions', ['createdAt']);
    await queryInterface.removeIndex('TransactionItems', ['transactionId']);
    await queryInterface.removeIndex('TransactionItems', ['productId']);
    await queryInterface.removeIndex('Members', ['phone']);
    await queryInterface.removeIndex('Members', ['email']);
    await queryInterface.removeIndex('Members', ['isActive']);
    await queryInterface.removeIndex('Categories', ['name']);
  }
};`;
  }

  /**
   * Validate schema consistency
   */
  async validateSchema() {
    this.log('Validating schema consistency...');
    
    try {
      const issues = [];

      // Check if all models are properly defined
      for (const [modelName, model] of Object.entries(this.models)) {
        try {
          await model.describe();
          this.log(`✅ ${modelName} schema is valid`);
        } catch (error) {
          issues.push(`${modelName}: ${error.message}`);
          this.log(`❌ ${modelName} schema error: ${error.message}`, 'error');
        }
      }

      // Check foreign key constraints
      const foreignKeys = await this.checkForeignKeys();
      if (foreignKeys.length > 0) {
        this.log('Foreign key constraints found:', 'success');
        foreignKeys.forEach(fk => this.log(`  ${fk.table}.${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`));
      }

      if (issues.length === 0) {
        this.log('Schema validation completed successfully', 'success');
      } else {
        this.log(`Schema validation found ${issues.length} issues`, 'warning');
      }

      return { valid: issues.length === 0, issues, foreignKeys };
    } catch (error) {
      this.log(`Schema validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Check foreign key constraints
   */
  async checkForeignKeys() {
    try {
      const [results] = await this.sequelize.query(`
        SELECT 
          TABLE_NAME as 'table',
          COLUMN_NAME as 'column',
          REFERENCED_TABLE_NAME as referencedTable,
          REFERENCED_COLUMN_NAME as referencedColumn
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE REFERENCED_TABLE_SCHEMA = '${this.config.database}'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);

      return results;
    } catch (error) {
      this.log(`Error checking foreign keys: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Run complete schema synchronization
   */
  async runSync(options = {}) {
    const startTime = Date.now();
    this.log('🚀 Starting schema synchronization...');

    try {
      // Create database if needed
      await this.createDatabase();

      // Test connection
      await this.testConnection();

      // Load models
      await this.loadModels();

      // Sync models
      await this.syncModels(options);

      // Validate schema
      const validation = await this.validateSchema();

      // Generate migrations if requested
      if (options.generateMigrations) {
        await this.generateMigrations();
      }

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      this.log(`🎉 Schema synchronization completed in ${duration}s`, 'success');

      return {
        success: true,
        duration,
        validation,
        models: Object.keys(this.models)
      };
    } catch (error) {
      this.log(`Schema synchronization failed: ${error.message}`, 'error');
      throw error;
    } finally {
      await this.sequelize.close();
    }
  }

  /**
   * Drop all tables (use with caution!)
   */
  async dropAllTables() {
    this.log('⚠️ Dropping all tables...', 'warning');
    
    try {
      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      
      const [tables] = await this.sequelize.query(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = '${this.config.database}'
      `);

      for (const table of tables) {
        await this.sequelize.query(`DROP TABLE IF EXISTS \`${table.TABLE_NAME}\``);
        this.log(`Dropped table: ${table.TABLE_NAME}`);
      }

      await this.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      this.log('All tables dropped successfully', 'success');
    } catch (error) {
      this.log(`Error dropping tables: ${error.message}`, 'error');
      throw error;
    }
  }
}

// CLI Usage
if (require.main === module) {
  const synchronizer = new SchemaSynchronizer();
  
  const command = process.argv[2] || 'sync';
  const options = {
    force: process.argv.includes('--force'),
    alter: process.argv.includes('--alter'),
    generateMigrations: process.argv.includes('--migrations')
  };

  switch (command) {
    case 'sync':
      synchronizer.runSync(options).catch(console.error);
      break;
    case 'validate':
      synchronizer.testConnection()
        .then(() => synchronizer.loadModels())
        .then(() => synchronizer.validateSchema())
        .catch(console.error);
      break;
    case 'drop':
      if (process.argv.includes('--confirm')) {
        synchronizer.dropAllTables().catch(console.error);
      } else {
        console.log('Use --confirm flag to drop all tables');
      }
      break;
    case 'migrations':
      synchronizer.loadModels()
        .then(() => synchronizer.generateMigrations())
        .catch(console.error);
      break;
    default:
      console.log('Usage: node schema-sync.js [sync|validate|drop|migrations] [--force] [--alter] [--migrations] [--confirm]');
  }
}

module.exports = SchemaSynchronizer;