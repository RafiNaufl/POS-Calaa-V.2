#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Prisma to Sequelize Migration...\n');

// Create migration directories
const directories = [
  'migration-scripts',
  'sequelize-models',
  'migration-logs',
  'backups'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`📁 Directory already exists: ${dir}`);
  }
});

// Copy migration scripts from the guide
const migrationFiles = [
  'prisma-to-sequelize-converter.js',
  'data-migration.js',
  'schema-sync.js'
];

console.log('\n📋 Checking migration scripts...');
migrationFiles.forEach(file => {
  const sourcePath = path.join(__dirname, file);
  const targetPath = path.join(__dirname, 'migration-scripts', file);
  
  if (fs.existsSync(sourcePath)) {
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`✅ Copied ${file} to migration-scripts/`);
    } else {
      console.log(`📄 ${file} already exists in migration-scripts/`);
    }
  } else {
    console.log(`⚠️  ${file} not found in root directory`);
  }
});

// Create Sequelize configuration
const sequelizeConfig = `
require('dotenv').config({ path: '.env.migration' });

module.exports = {
  development: {
    dialect: process.env.SEQUELIZE_DIALECT || 'sqlite',
    storage: process.env.SEQUELIZE_STORAGE || './prisma/dev_sequelize.db',
    logging: process.env.MIGRATION_ENABLE_LOGGING === 'true' ? console.log : false,
    pool: {
      max: parseInt(process.env.MAX_CONNECTIONS) || 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  production: {
    dialect: process.env.SEQUELIZE_DIALECT || 'sqlite',
    storage: process.env.SEQUELIZE_STORAGE || './prisma/dev_sequelize.db',
    logging: false,
    pool: {
      max: parseInt(process.env.MAX_CONNECTIONS) || 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
};
`;

fs.writeFileSync('sequelize.config.js', sequelizeConfig);
console.log('✅ Created sequelize.config.js');

// Create migration package.json if not exists
const migrationPackageJson = {
  "name": "prisma-sequelize-migration",
  "version": "1.0.0",
  "description": "Migration scripts from Prisma to Sequelize",
  "scripts": {
    "migrate:convert": "node migration-scripts/prisma-to-sequelize-converter.js",
    "migrate:schema": "node migration-scripts/schema-sync.js sync",
    "migrate:data": "node migration-scripts/data-migration.js migrate",
    "migrate:verify": "node migration-scripts/data-migration.js verify",
    "migrate:rollback": "node migration-scripts/data-migration.js rollback",
    "migrate:full": "npm run migrate:convert && npm run migrate:schema && npm run migrate:data && npm run migrate:verify"
  }
};

const packageJsonPath = 'migration-package.json';
if (!fs.existsSync(packageJsonPath)) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(migrationPackageJson, null, 2));
  console.log('✅ Created migration-package.json');
}

// Create test connection script
const testConnectionScript = `
require('dotenv').config({ path: '.env.migration' });
const { PrismaClient } = require('@prisma/client');
const { Sequelize } = require('sequelize');

async function testConnections() {
  console.log('🔍 Testing database connections...\\n');
  
  // Test Prisma connection
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.PRISMA_DATABASE_URL
        }
      }
    });
    
    await prisma.$connect();
    console.log('✅ Prisma connection successful');
    
    // Count records in User table
    const userCount = await prisma.user.count();
    console.log(\`📊 Found \${userCount} users in Prisma database\`);
    
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
`;

fs.writeFileSync('test-connections.js', testConnectionScript);
console.log('✅ Created test-connections.js');

console.log('\n🎉 Migration setup completed!');
console.log('\nNext steps:');
console.log('1. Run: node test-connections.js');
console.log('2. Run: npm run migrate:full');
console.log('3. Verify migration results');