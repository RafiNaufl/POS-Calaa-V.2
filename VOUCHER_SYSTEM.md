# Sistem Voucher, Diskon, dan Promosi

Sistem ini menyediakan fitur lengkap untuk mengelola voucher, diskon, dan promosi dalam aplikasi POS.

## Fitur Utama

### 1. Sistem Voucher
- **Jenis Voucher:**
  - Persentase diskon (misal: 10% off)
  - Diskon nominal tetap (misal: Rp 50.000 off)
  - Gratis ongkir

- **Pengaturan Voucher:**
  - Kode voucher unik
  - Tanggal mulai dan berakhir
  - Minimum pembelian
  - Batas penggunaan total
  - Batas penggunaan per user
  - Status aktif/non-aktif

### 2. Sistem Promosi
- **Jenis Promosi:**
  - Diskon produk tertentu
  - Diskon kategori tertentu
  - Diskon bulk (beli dalam jumlah tertentu)
  - Buy X Get Y (beli X gratis Y)

- **Pengaturan Promosi:**
  - Nama promosi
  - Deskripsi
  - Tanggal mulai dan berakhir
  - Target produk/kategori
  - Nilai diskon
  - Syarat minimum
  - Status aktif/non-aktif

## API Endpoints (Express v1)

### Voucher
- `GET /api/v1/vouchers` - Mendapatkan daftar voucher
- `POST /api/v1/vouchers` - Membuat voucher baru
- `POST /api/v1/vouchers/validate` - Validasi dan apply voucher

### Promosi
- `GET /api/v1/promotions` - Mendapatkan daftar promosi
- `POST /api/v1/promotions` - Membuat promosi baru
- `POST /api/v1/promotions/calculate` - Menghitung diskon promosi

## Halaman Admin

### Manajemen Voucher (`/vouchers`)
- Daftar semua voucher
- Filter berdasarkan status dan pencarian
- Form untuk membuat voucher baru
- Statistik penggunaan voucher

### Manajemen Promosi (`/promotions`)
- Daftar semua promosi
- Filter berdasarkan status dan jenis
- Form untuk membuat promosi baru
- Pengaturan target produk/kategori

## Integrasi dengan Kasir

### Fitur di Halaman Kasir
1. **Input Voucher:**
   - Field untuk memasukkan kode voucher
   - Validasi real-time
   - Tampilan voucher yang diterapkan

2. **Kalkulasi Otomatis:**
   - Promosi diterapkan otomatis berdasarkan item di keranjang
   - Tampilan detail promosi yang aktif
   - Perhitungan total dengan semua diskon

3. **Struk Pembayaran:**
   - Detail voucher yang digunakan
   - Detail promosi yang diterapkan
   - Breakdown semua diskon

## Database Schema

### Tabel Voucher
```sql
Voucher {
  id: String (Primary Key)
  code: String (Unique)
  name: String
  description: String?
  type: VoucherType (PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING)
  value: Float
  minPurchase: Float?
  maxUsage: Int?
  usedCount: Int (Default: 0)
  maxUsagePerUser: Int?
  startDate: DateTime
  endDate: DateTime
  isActive: Boolean (Default: true)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Tabel Promosi
```sql
Promotion {
  id: String (Primary Key)
  name: String
  description: String?
  type: PromotionType
  discountValue: Float
  minQuantity: Int?
  buyQuantity: Int?
  getQuantity: Int?
  startDate: DateTime
  endDate: DateTime
  isActive: Boolean (Default: true)
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Tabel Penggunaan Voucher
```sql
VoucherUsage {
  id: String (Primary Key)
  voucherId: String (Foreign Key)
  userId: String (Foreign Key)
  transactionId: String (Foreign Key)
  discountAmount: Float
  usedAt: DateTime
}
```

## Cara Penggunaan

### Untuk Admin
1. **Membuat Voucher:**
   - Masuk ke halaman `/vouchers`
   - Klik "Tambah Voucher"
   - Isi form dengan detail voucher
   - Simpan voucher

2. **Membuat Promosi:**
   - Masuk ke halaman `/promotions`
   - Klik "Tambah Promosi"
   - Pilih jenis promosi
   - Atur target dan nilai diskon
   - Simpan promosi

### Untuk Kasir
1. **Menggunakan Voucher:**
   - Tambahkan item ke keranjang
   - Masukkan kode voucher di field yang tersedia
   - Klik "Apply Voucher"
   - Voucher akan diterapkan jika valid

2. **Promosi Otomatis:**
   - Promosi akan diterapkan otomatis saat item ditambahkan
   - Lihat detail promosi di bagian ringkasan

## Validasi dan Aturan Bisnis

### Voucher
- Kode voucher harus unik
- Voucher hanya bisa digunakan dalam periode yang ditentukan
- Minimum pembelian harus terpenuhi
- Batas penggunaan tidak boleh terlampaui
- User tidak boleh melebihi batas penggunaan per user

### Promosi
- Promosi hanya aktif dalam periode yang ditentukan
- Target produk/kategori harus sesuai
- Syarat minimum harus terpenuhi
- Tidak ada konflik antar promosi

## Keamanan
- Semua endpoint dilindungi dengan autentikasi
- Validasi input yang ketat
- Logging penggunaan voucher dan promosi
- Pencegahan penyalahgunaan sistem

## Monitoring dan Laporan
- Tracking penggunaan voucher
- Statistik efektivitas promosi
- Laporan revenue impact
- Analisis customer behavior