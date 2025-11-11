# Panduan Migrasi dari Prisma ke Sequelize

## Daftar Isi
1. [Persiapan Migrasi](#persiapan-migrasi)
2. [Instalasi dan Setup Sequelize](#instalasi-dan-setup-sequelize)
3. [Perbandingan Sintaks](#perbandingan-sintaks)
4. [Konversi Model](#konversi-model)
5. [Konversi Query](#konversi-query)
6. [Menangani Relasi](#menangani-relasi)
7. [Strategi Migrasi](#strategi-migrasi)
8. [Testing dan Validasi](#testing-dan-validasi)
9. [Troubleshooting](#troubleshooting)

## Persiapan Migrasi

### 1. Backup Database
```bash
# Backup database PostgreSQL
pg_dump -h localhost -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Analisis Skema Existing
Berdasarkan analisis skema Prisma yang ada, sistem POS memiliki:
- 11 model utama (User, Category, Product, Transaction, dll.)
- Relasi kompleks (One-to-Many, Many-to-Many)
- Index untuk optimasi query
- Field dengan default values dan constraints

### 3. Persiapan Environment
```bash
# Buat branch baru untuk migrasi
git checkout -b migration/prisma-to-sequelize

# Backup file konfigurasi
cp .env .env.backup
cp package.json package.json.backup
```

## Instalasi dan Setup Sequelize

### 1. Install Dependencies
```bash
# Uninstall Prisma (lakukan di akhir setelah migrasi selesai)
# npm uninstall prisma @prisma/client

# Install Sequelize
npm install sequelize sequelize-cli pg pg-hstore
npm install --save-dev @types/sequelize
```

### 2. Setup Sequelize CLI
```bash
# Initialize Sequelize
npx sequelize-cli init
```

### 3. Konfigurasi Database
Buat file `config/database.js`:
```javascript
require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log,
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false,
  }
};
```

## Perbandingan Sintaks

### Model Definition

#### Prisma
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String
  role      String   @default("CASHIER")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

#### Sequelize
```javascript
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => require('cuid')(),
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'CASHIER',
    },
  }, {
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  });

  return User;
};
```

### Query Operations

#### Prisma vs Sequelize

| Operation | Prisma | Sequelize |
|-----------|--------|-----------|
| **Create** | `prisma.user.create({ data: {...} })` | `User.create({...})` |
| **Find Many** | `prisma.user.findMany()` | `User.findAll()` |
| **Find Unique** | `prisma.user.findUnique({ where: {...} })` | `User.findOne({ where: {...} })` |
| **Update** | `prisma.user.update({ where: {...}, data: {...} })` | `User.update({...}, { where: {...} })` |
| **Delete** | `prisma.user.delete({ where: {...} })` | `User.destroy({ where: {...} })` |
| **Include Relations** | `{ include: { posts: true } }` | `{ include: [Post] }` |

## Konversi Model

### 1. Struktur Folder
```
models/
├── index.js
├── user.js
├── category.js
├── product.js
├── transaction.js
├── transactionItem.js
├── member.js
├── pointHistory.js
├── voucher.js
├── voucherUsage.js
├── promotion.js
├── productPromotion.js
├── categoryPromotion.js
└── operationalExpense.js
```

### 2. Model Index File
Buat `models/index.js`:
```javascript
const { Sequelize } = require('sequelize');
const config = require('../config/database');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize;
if (dbConfig.use_env_variable) {
  sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
} else {
  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
}

const db = {};

// Import models
db.User = require('./user')(sequelize);
db.Category = require('./category')(sequelize);
db.Product = require('./product')(sequelize);
db.Transaction = require('./transaction')(sequelize);
db.TransactionItem = require('./transactionItem')(sequelize);
db.Member = require('./member')(sequelize);
db.PointHistory = require('./pointHistory')(sequelize);
db.Voucher = require('./voucher')(sequelize);
db.VoucherUsage = require('./voucherUsage')(sequelize);
db.Promotion = require('./promotion')(sequelize);
db.ProductPromotion = require('./productPromotion')(sequelize);
db.CategoryPromotion = require('./categoryPromotion')(sequelize);
db.OperationalExpense = require('./operationalExpense')(sequelize);

// Define associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
```

### 3. Contoh Model User
Buat `models/user.js`:
```javascript
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      defaultValue: 'CASHIER',
      validate: {
        isIn: [['ADMIN', 'CASHIER', 'MANAGER']],
      },
    },
  }, {
    timestamps: true,
    tableName: 'User',
  });

  User.associate = (models) => {
    User.hasMany(models.Transaction, {
      foreignKey: 'userId',
      as: 'transactions',
    });
    User.hasMany(models.VoucherUsage, {
      foreignKey: 'userId',
      as: 'voucherUsages',
    });
    User.hasMany(models.OperationalExpense, {
      foreignKey: 'createdBy',
      as: 'operationalExpenses',
    });
  };

  return User;
};
```

### 4. Contoh Model Product dengan Relasi
Buat `models/product.js`:
```javascript
const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: () => uuidv4().replace(/-/g, ''),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    stock: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    image: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'Category',
        key: 'id',
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    costPrice: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    productCode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    color: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    size: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    timestamps: true,
    tableName: 'Product',
    indexes: [
      {
        fields: ['categoryId'],
      },
      {
        fields: ['productCode'],
        unique: true,
      },
      {
        fields: ['isActive'],
      },
    ],
  });

  Product.associate = (models) => {
    Product.belongsTo(models.Category, {
      foreignKey: 'categoryId',
      as: 'category',
    });
    Product.hasMany(models.TransactionItem, {
      foreignKey: 'productId',
      as: 'transactionItems',
    });
    Product.belongsToMany(models.Promotion, {
      through: models.ProductPromotion,
      foreignKey: 'productId',
      otherKey: 'promotionId',
      as: 'promotions',
    });
  };

  return Product;
};
```

## Konversi Query

### 1. Basic CRUD Operations

#### Create
```javascript
// Prisma
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    password: 'hashedPassword',
  }
});

// Sequelize
const user = await User.create({
  email: 'user@example.com',
  name: 'John Doe',
  password: 'hashedPassword',
});
```

#### Read with Relations
```javascript
// Prisma
const transactions = await prisma.transaction.findMany({
  include: {
    user: true,
    items: {
      include: {
        product: true,
      },
    },
    member: true,
  },
  where: {
    status: 'COMPLETED',
  },
  orderBy: {
    createdAt: 'desc',
  },
});

// Sequelize
const transactions = await Transaction.findAll({
  include: [
    {
      model: User,
      as: 'user',
    },
    {
      model: TransactionItem,
      as: 'items',
      include: [
        {
          model: Product,
          as: 'product',
        },
      ],
    },
    {
      model: Member,
      as: 'member',
    },
  ],
  where: {
    status: 'COMPLETED',
  },
  order: [['createdAt', 'DESC']],
});
```

#### Update
```javascript
// Prisma
const updatedProduct = await prisma.product.update({
  where: { id: productId },
  data: {
    stock: {
      decrement: quantity,
    },
  },
});

// Sequelize
const updatedProduct = await Product.update(
  {
    stock: sequelize.literal(`stock - ${quantity}`),
  },
  {
    where: { id: productId },
    returning: true,
  }
);
```

### 2. Complex Queries

#### Aggregation
```javascript
// Prisma
const salesReport = await prisma.transaction.aggregate({
  _sum: {
    finalTotal: true,
  },
  _count: {
    id: true,
  },
  where: {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
    status: 'COMPLETED',
  },
});

// Sequelize
const salesReport = await Transaction.findAll({
  attributes: [
    [sequelize.fn('SUM', sequelize.col('finalTotal')), 'totalSales'],
    [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions'],
  ],
  where: {
    createdAt: {
      [Op.between]: [startDate, endDate],
    },
    status: 'COMPLETED',
  },
  raw: true,
});
```

#### Group By
```javascript
// Prisma
const categoryStats = await prisma.transactionItem.groupBy({
  by: ['productId'],
  _sum: {
    quantity: true,
    subtotal: true,
  },
  where: {
    transaction: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  },
});

// Sequelize
const categoryStats = await TransactionItem.findAll({
  attributes: [
    'productId',
    [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity'],
    [sequelize.fn('SUM', sequelize.col('subtotal')), 'totalSubtotal'],
  ],
  include: [
    {
      model: Transaction,
      as: 'transaction',
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      attributes: [],
    },
  ],
  group: ['productId'],
  raw: true,
});
```

## Menangani Relasi

### 1. One-to-Many Relations
```javascript
// User -> Transactions
User.associate = (models) => {
  User.hasMany(models.Transaction, {
    foreignKey: 'userId',
    as: 'transactions',
  });
};

Transaction.associate = (models) => {
  Transaction.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user',
  });
};
```

### 2. Many-to-Many Relations
```javascript
// Product <-> Promotion (through ProductPromotion)
Product.associate = (models) => {
  Product.belongsToMany(models.Promotion, {
    through: models.ProductPromotion,
    foreignKey: 'productId',
    otherKey: 'promotionId',
    as: 'promotions',
  });
};

Promotion.associate = (models) => {
  Promotion.belongsToMany(models.Product, {
    through: models.ProductPromotion,
    foreignKey: 'promotionId',
    otherKey: 'productId',
    as: 'products',
  });
};
```

### 3. Self-Referencing Relations
```javascript
// Jika ada kategori dengan parent-child relationship
Category.associate = (models) => {
  Category.hasMany(models.Category, {
    foreignKey: 'parentId',
    as: 'children',
  });
  Category.belongsTo(models.Category, {
    foreignKey: 'parentId',
    as: 'parent',
  });
};
```

## Strategi Migrasi

### 1. Fase Persiapan (1-2 hari)
- [ ] Backup database dan kode
- [ ] Setup environment development
- [ ] Install dan konfigurasi Sequelize
- [ ] Buat model Sequelize untuk semua entitas

### 2. Fase Implementasi (3-5 hari)
- [ ] Konversi service layer satu per satu
- [ ] Update API endpoints
- [ ] Implementasi testing untuk setiap modul
- [ ] Validasi data consistency

### 3. Fase Testing (2-3 hari)
- [ ] Unit testing untuk semua model
- [ ] Integration testing untuk API
- [ ] Performance testing
- [ ] User acceptance testing

### 4. Fase Deployment (1 hari)
- [ ] Deploy ke staging environment
- [ ] Final testing di staging
- [ ] Deploy ke production dengan zero-downtime strategy

### Zero-Downtime Migration Strategy

#### 1. Blue-Green Deployment
```bash
# Setup blue environment (current Prisma)
# Setup green environment (new Sequelize)

# 1. Deploy green environment
# 2. Test green environment
# 3. Switch traffic to green
# 4. Monitor and rollback if needed
```

#### 2. Database Migration Script
```javascript
// migration-script.js
const { PrismaClient } = require('@prisma/client');
const { sequelize } = require('./models');

async function migrateData() {
  const prisma = new PrismaClient();
  
  try {
    // Start transaction
    await sequelize.transaction(async (t) => {
      // Migrate users
      const users = await prisma.user.findMany();
      for (const user of users) {
        await User.create(user, { transaction: t });
      }
      
      // Migrate other entities...
      console.log('Migration completed successfully');
    });
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
```

## Testing dan Validasi

### 1. Unit Tests
```javascript
// tests/models/user.test.js
const { User } = require('../../models');

describe('User Model', () => {
  test('should create user with valid data', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword',
    };
    
    const user = await User.create(userData);
    expect(user.email).toBe(userData.email);
    expect(user.role).toBe('CASHIER'); // default value
  });
  
  test('should not create user with duplicate email', async () => {
    const userData = {
      email: 'duplicate@example.com',
      name: 'Test User',
      password: 'hashedPassword',
    };
    
    await User.create(userData);
    
    await expect(User.create(userData)).rejects.toThrow();
  });
});
```

### 2. Integration Tests
```javascript
// tests/api/products.test.js
const request = require('supertest');
const app = require('../../app');

describe('Products API', () => {
  test('GET /api/products should return all products', async () => {
    const response = await request(app)
      .get('/api/products')
      .expect(200);
      
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('POST /api/products should create new product', async () => {
    const productData = {
      name: 'Test Product',
      price: 100,
      categoryId: 'category-id',
      color: 'Red',
      size: 'M',
    };
    
    const response = await request(app)
      .post('/api/products')
      .send(productData)
      .expect(201);
      
    expect(response.body.name).toBe(productData.name);
  });
});
```

### 3. Data Validation Script
```javascript
// scripts/validate-migration.js
async function validateMigration() {
  const prismaCount = await prisma.user.count();
  const sequelizeCount = await User.count();
  
  console.log(`Prisma users: ${prismaCount}`);
  console.log(`Sequelize users: ${sequelizeCount}`);
  
  if (prismaCount !== sequelizeCount) {
    throw new Error('User count mismatch!');
  }
  
  // Validate other entities...
}
```

## Troubleshooting

### 1. Common Issues

#### Connection Issues
```javascript
// Check database connection
async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to database:', error);
  }
}
```

#### Migration Issues
```javascript
// Handle foreign key constraints
await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
// Perform migration
await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
```

### 2. Performance Optimization

#### Eager Loading
```javascript
// Optimize N+1 queries
const transactions = await Transaction.findAll({
  include: [
    {
      model: User,
      as: 'user',
      attributes: ['id', 'name'], // Only select needed fields
    },
    {
      model: TransactionItem,
      as: 'items',
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'name', 'price'],
        },
      ],
    },
  ],
});
```

#### Indexing
```javascript
// Add indexes for better performance
{
  indexes: [
    {
      fields: ['email'],
      unique: true,
    },
    {
      fields: ['createdAt'],
    },
    {
      fields: ['status', 'createdAt'],
    },
  ],
}
```

### 3. Rollback Strategy
```javascript
// rollback-script.js
async function rollback() {
  // Switch back to Prisma
  // Restore database from backup if needed
  // Update environment variables
  
  console.log('Rollback completed');
}
```

## Checklist Migrasi

### Pre-Migration
- [ ] Database backup created
- [ ] Code backup created
- [ ] Sequelize setup completed
- [ ] All models converted
- [ ] Unit tests written
- [ ] Integration tests written

### During Migration
- [ ] Service layer converted
- [ ] API endpoints updated
- [ ] Data validation completed
- [ ] Performance testing passed
- [ ] Staging deployment successful

### Post-Migration
- [ ] Production deployment successful
- [ ] All tests passing
- [ ] Performance monitoring active
- [ ] Rollback plan ready
- [ ] Documentation updated
- [ ] Team training completed

## Kesimpulan

Migrasi dari Prisma ke Sequelize memerlukan perencanaan yang matang dan eksekusi yang hati-hati. Dengan mengikuti panduan ini, Anda dapat melakukan migrasi dengan meminimalkan downtime dan mempertahankan fungsionalitas yang ada.

**Tips Penting:**
1. Selalu lakukan backup sebelum migrasi
2. Test secara menyeluruh di environment development
3. Gunakan staging environment untuk final testing
4. Monitor performance setelah migrasi
5. Siapkan rollback plan yang solid

**Timeline Estimasi:**
- Persiapan: 1-2 hari
- Implementasi: 3-5 hari  
- Testing: 2-3 hari
- Deployment: 1 hari
- **Total: 7-11 hari**

Dengan mengikuti panduan ini secara sistematis, migrasi dari Prisma ke Sequelize dapat dilakukan dengan sukses sambil mempertahankan stabilitas dan performa aplikasi POS.