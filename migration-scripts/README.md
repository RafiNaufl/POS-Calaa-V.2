# 🚀 Panduan Migration Scripts: Prisma ke Sequelize

Koleksi lengkap script dan tools untuk migrasi dari Prisma ORM ke Sequelize ORM dengan minimal downtime dan maksimal keamanan data.

## 📋 Daftar Isi

- [Persiapan](#persiapan)
- [Struktur File](#struktur-file)
- [Instalasi](#instalasi)
- [Konfigurasi](#konfigurasi)
- [Penggunaan](#penggunaan)
- [Script Utama](#script-utama)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## 🛠 Persiapan

### Prerequisites

- Node.js >= 16.0.0
- Database MySQL/PostgreSQL yang sudah berjalan
- Backup database yang sudah ada
- Akses ke Prisma schema yang akan dimigrasi

### Backup Database

**PENTING**: Selalu backup database sebelum menjalankan migrasi!

```bash
# MySQL
mysqldump -u username -p database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# PostgreSQL
pg_dump -U username -h localhost database_name > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 📁 Struktur File

```
migration-scripts/
├── package.json                    # Dependencies dan scripts
├── README.md                      # Dokumentasi ini
├── .env.example                   # Template environment variables
├── data-migration.js              # Script migrasi data utama
├── schema-sync.js                 # Script sinkronisasi skema
├── prisma-to-sequelize-converter.js # Converter otomatis model
├── config/
│   └── database.js               # Konfigurasi database
├── migrations/                   # Generated migration files
├── logs/                        # Log files migrasi
└── backups/                     # Backup files
```

## 📦 Instalasi

1. **Clone atau copy migration scripts ke project Anda**

```bash
cd your-project-directory
mkdir migration-scripts
cd migration-scripts
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment variables**

```bash
cp .env.example .env
# Edit .env dengan konfigurasi database Anda
```

## ⚙️ Konfigurasi

### Environment Variables (.env)

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=pos_app
DB_USER=root
DB_PASSWORD=your_password
DB_DIALECT=mysql

# Migration Settings
MIGRATION_BATCH_SIZE=1000
MIGRATION_TIMEOUT=30000
ENABLE_LOGGING=true

# Backup Settings
AUTO_BACKUP=true
BACKUP_DIR=./backups
```

### Database Configuration (config/database.js)

```javascript
module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT,
    logging: process.env.ENABLE_LOGGING === 'true' ? console.log : false,
  },
  // ... other environments
};
```

## 🚀 Penggunaan

### 1. Persiapan Migrasi

```bash
# Test koneksi database
npm run test:connection

# Validasi skema Sequelize
npm run schema:validate

# Generate model Sequelize dari Prisma schema
npm run convert:models
```

### 2. Sinkronisasi Skema

```bash
# Sync skema (safe mode)
npm run schema:sync

# Sync dengan alter tables (modify existing)
npm run schema:sync:alter

# Force sync (drop and recreate - HATI-HATI!)
npm run schema:sync:force

# Generate migration files
npm run schema:migrations
```

### 3. Migrasi Data

```bash
# Jalankan migrasi lengkap
npm run migrate

# Verifikasi hasil migrasi
npm run migrate:verify

# Rollback jika ada masalah
npm run migrate:rollback
```

### 4. Setup Lengkap (One Command)

```bash
# Setup skema + migrasi data
npm run setup

# Reset lengkap (drop + setup ulang)
npm run reset
```

## 📜 Script Utama

### 1. data-migration.js

Script utama untuk migrasi data dari Prisma ke Sequelize.

**Fitur:**
- ✅ Validasi data sebelum migrasi
- ✅ Migrasi bertahap dengan transaction
- ✅ Logging detail dan error handling
- ✅ Verifikasi hasil migrasi
- ✅ Rollback otomatis jika gagal
- ✅ Generate laporan migrasi

**Penggunaan:**

```bash
# Migrasi lengkap
node data-migration.js migrate

# Verifikasi saja
node data-migration.js verify

# Rollback data
node data-migration.js rollback
```

**Contoh Output:**
```
🚀 Starting complete data migration...
ℹ️ [2024-01-15T10:30:00.000Z] Starting data validation...
✅ [2024-01-15T10:30:01.000Z] Prisma connection successful
✅ [2024-01-15T10:30:02.000Z] Sequelize connection successful
ℹ️ [2024-01-15T10:30:03.000Z] user: 150 records
ℹ️ [2024-01-15T10:30:04.000Z] product: 500 records
...
✅ [2024-01-15T10:35:00.000Z] Users migration completed: 150 success, 0 errors
🎉 Migration completed in 300s
📊 Migration report saved to: migration-report-1705312200000.json
```

### 2. schema-sync.js

Script untuk sinkronisasi skema database.

**Fitur:**
- ✅ Auto-create database jika belum ada
- ✅ Load dan sync semua model Sequelize
- ✅ Generate migration files
- ✅ Validasi foreign key constraints
- ✅ Support multiple sync modes

**Penggunaan:**

```bash
# Sync normal
node schema-sync.js sync

# Sync dengan opsi
node schema-sync.js sync --force --migrations

# Validasi skema
node schema-sync.js validate

# Drop semua table (HATI-HATI!)
node schema-sync.js drop --confirm
```

### 3. prisma-to-sequelize-converter.js

Converter otomatis dari Prisma schema ke Sequelize models.

**Fitur:**
- ✅ Parse Prisma schema otomatis
- ✅ Convert types dan attributes
- ✅ Generate associations
- ✅ Create index definitions
- ✅ Generate model files

**Penggunaan:**

```bash
node prisma-to-sequelize-converter.js
```

## 🔧 Troubleshooting

### Error: Connection Refused

```bash
# Check database service
sudo systemctl status mysql
# atau
sudo systemctl status postgresql

# Restart service
sudo systemctl restart mysql
```

### Error: Foreign Key Constraint

```bash
# Disable foreign key checks sementara
SET FOREIGN_KEY_CHECKS = 0;
# Jalankan migrasi
SET FOREIGN_KEY_CHECKS = 1;
```

### Error: Duplicate Entry

```bash
# Check existing data
npm run migrate:verify

# Clean up duplicates
# Edit data-migration.js untuk handle duplicates
```

### Memory Issues (Large Dataset)

```javascript
// Adjust batch size di .env
MIGRATION_BATCH_SIZE=500

// Atau modify script untuk streaming
const stream = await this.prisma.user.findManyStream();
```

### Timeout Issues

```javascript
// Increase timeout di .env
MIGRATION_TIMEOUT=60000

// Atau di script
await this.sequelize.query(sql, { 
  timeout: 60000 
});
```

## 📋 Best Practices

### 1. Pre-Migration Checklist

- [ ] Backup database lengkap
- [ ] Test di environment development dulu
- [ ] Validasi semua foreign key relationships
- [ ] Check disk space yang cukup
- [ ] Inform stakeholders tentang downtime

### 2. During Migration

- [ ] Monitor log files secara real-time
- [ ] Check memory dan CPU usage
- [ ] Siapkan rollback plan
- [ ] Document setiap issue yang ditemukan

### 3. Post-Migration Checklist

- [ ] Verifikasi jumlah records di semua table
- [ ] Test aplikasi functionality
- [ ] Check performance queries
- [ ] Update connection strings di aplikasi
- [ ] Monitor error logs

### 4. Rollback Strategy

```bash
# Jika migrasi gagal di tengah jalan:
npm run migrate:rollback

# Restore dari backup:
mysql -u username -p database_name < backup_file.sql

# Atau gunakan Prisma kembali sementara
# sambil fix issues di Sequelize
```

### 5. Performance Optimization

```javascript
// Gunakan bulk operations
await Model.bulkCreate(data, {
  ignoreDuplicates: true,
  updateOnDuplicate: ['updatedAt']
});

// Index yang tepat
await queryInterface.addIndex('Products', ['categoryId', 'isActive']);

// Connection pooling
const sequelize = new Sequelize(database, username, password, {
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000
  }
});
```

## 📊 Monitoring & Logging

### Log Files

```bash
# Real-time monitoring
tail -f logs/migration-$(date +%Y%m%d).log

# Error logs
grep "ERROR" logs/migration-*.log

# Performance metrics
grep "completed in" logs/migration-*.log
```

### Migration Report

Setiap migrasi menghasilkan report JSON dengan informasi:

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "duration": "300s",
  "verification": {
    "user": { "prisma": 150, "sequelize": 150, "match": true },
    "product": { "prisma": 500, "sequelize": 500, "match": true }
  },
  "logs": [...]
}
```

## 🆘 Support & Contact

Jika mengalami masalah:

1. Check troubleshooting section di atas
2. Review log files untuk error details
3. Pastikan environment variables sudah benar
4. Test di development environment dulu

## 📝 Changelog

### v1.0.0
- ✅ Initial release
- ✅ Complete data migration support
- ✅ Schema synchronization
- ✅ Auto model converter
- ✅ Comprehensive logging
- ✅ Rollback functionality

---

**⚠️ PERINGATAN**: Selalu test di development environment sebelum production. Backup adalah kunci keamanan data Anda!