# API Backend (Express)

Dokumen ini merangkum endpoint yang telah dimigrasikan 100% ke Express di bawah prefix `'/api/v1'` dengan autentikasi JWT dan validasi payload terpusat.

## Prinsip Umum
- Autentikasi: JWT melalui header `Authorization: Bearer <token>` dengan `aud=pos-app`, `iss=pos-backend`, secret default `dev-secret` (override oleh env di produksi).
- Validasi: Menggunakan `backend/src/middleware/validate.js` untuk memverifikasi body/query/params.
- Status umum: `401` untuk tanpa token/tidak valid, `400` untuk payload tidak valid, `404` untuk resource tidak ditemukan.

## Endpoint V1
- `GET /api/v1/status` — Cek status service.
- `POST /api/v1/echo` — Echo payload.

### Users
- `GET /api/v1/users` — Placeholder daftar users (auth diperlukan).

### Transactions
- `GET /api/v1/transactions` — Daftar transaksi.
- `GET /api/v1/transactions/:id` — Detail transaksi.
- `POST /api/v1/transactions` — Buat transaksi.
- `PATCH /api/v1/transactions/:id/cancel` — Batalkan transaksi.
- `PATCH /api/v1/transactions/:id/refund` — Refund transaksi.

### Operational Expenses
- `GET /api/v1/operational-expenses` — Daftar OPEX.
- `GET /api/v1/operational-expenses/:id` — Detail OPEX.
- `POST /api/v1/operational-expenses` — Buat OPEX.

### Reports
- `GET /api/v1/reports/summary` — Ringkasan laporan.

### Categories
- `GET /api/v1/categories` — Daftar categories.
- `GET /api/v1/categories/:id` — Detail category.
- `POST /api/v1/categories` — Buat category (validasi name, description optional).
- `PUT /api/v1/categories/:id` — Update category.
- `DELETE /api/v1/categories/:id` — Hapus category.

### Products
- `GET /api/v1/products` — Daftar produk (filter `categoryId`, `active` opsional).
- `GET /api/v1/products/:id` — Detail produk.
- `POST /api/v1/products` — Buat produk (validasi name, price, stock, categoryId, color, size, description/image opsional).
- `PUT /api/v1/products/:id` — Update produk.
- `DELETE /api/v1/products/:id` — Hapus produk.

### Members
- `GET /api/v1/members` — Daftar member.
- `GET /api/v1/members/:id` — Detail member.
- `POST /api/v1/members` — Buat member (validasi name, phone/email opsional).
- `PUT /api/v1/members/:id` — Update member.
- `DELETE /api/v1/members/:id` — Hapus member.

### Vouchers
- `GET /api/v1/vouchers` — Daftar voucher.
- `GET /api/v1/vouchers/:id` — Detail voucher.
- `POST /api/v1/vouchers` — Buat voucher (validasi code, name, type, value, startDate, endDate, batasan opsional).
- `PUT /api/v1/vouchers/:id` — Update voucher.
- `DELETE /api/v1/vouchers/:id` — Hapus voucher.

### Promotions
- `GET /api/v1/promotions` — Daftar promosi.
- `GET /api/v1/promotions/:id` — Detail promosi.
- `POST /api/v1/promotions` — Buat promosi (validasi name, discountType/value, start/end, isActive opsional).
- `PUT /api/v1/promotions/:id` — Update promosi.
- `DELETE /api/v1/promotions/:id` — Hapus promosi.

### Payments
- `GET /api/v1/payments` — Daftar pembayaran.
- `GET /api/v1/payments/:id` — Detail pembayaran.
- `POST /api/v1/payments` — Buat pembayaran (validasi transactionId, method, amount, reference opsional).
- `PUT /api/v1/payments/:id` — Update pembayaran.
- `DELETE /api/v1/payments/:id` — Hapus pembayaran.

### Cashier Shifts
- `GET /api/v1/cashier-shifts` — Daftar shift kasir.
- `GET /api/v1/cashier-shifts/:id` — Detail shift.
- `POST /api/v1/cashier-shifts` — Buat shift (validasi cashierId, startedAt, endedAt opsional).
- `PUT /api/v1/cashier-shifts/:id` — Tutup shift (validasi endedAt).
- `DELETE /api/v1/cashier-shifts/:id` — Hapus shift.

## Testing
- Jalankan `npm run test:backend` untuk backend-only Jest suite.
- Tes minimum per modul: 401 tanpa token, 200 list dengan token, 404 untuk resource tidak ditemukan.

## Catatan
- Pada `NODE_ENV=test` tanpa Postgres `DATABASE_URL` valid, koneksi Sequelize otomatis memakai SQLite in-memory agar tes berjalan ringan.
- Untuk memakai Postgres di tes, set `DATABASE_URL` Postgres yang valid (mis. di `.env.test`).