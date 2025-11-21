# Checklist Cutover Backend (Express) vs Next.js API

Tujuan: Mematikan pemakaian `app/api/*` di frontend dan menonaktifkan fallback proxy (`/api/legacy/*`) di backend, sehingga seluruh panggilan API konsisten melalui Express di `/api/v1/*`.

## Langkah Persiapan
- Tambahkan skrip `backend:start` dan `backend:dev` di `package.json` (SELESAI).
- Pastikan backend dapat berjalan sendiri: `npm run backend:dev` dan health check di `http://localhost:4000/health`.
- Pastikan frontend menggunakan token/autentikasi yang sama ketika memanggil `/api/v1/*`.

## Matikan Fallback Proxy
- File: `backend/src/server.js`
- Blok yang perlu dinonaktifkan: handler `app.all('/api/legacy/*', ...)`.
- Aksi: Hapus atau guard dengan env flag misalnya `ENABLE_LEGACY_PROXY=false` sebelum cutover final.

## Audit Pemakaian `app/api/*` di Frontend
- Cari semua pemakaian `'/api/*'` di folder `app/`.
- Klasifikasi endpoint:
  - Aman untuk diganti (CRUD dasar tersedia di Express)
  - Perlu implementasi backend baru (subpath khusus, kalkulasi, integrasi pihak ketiga)

### Endpoint Aman untuk Diganti Sekarang (v1 parity)
- Categories: CRUD penuh → `/api/v1/categories` dan `/:id`
- Products: CRUD penuh → `/api/v1/products` dan `/:id`
- Products Import: `POST /api/v1/products/import`
- Vouchers: CRUD penuh → `/api/v1/vouchers` dan `/:id`
- Vouchers Validate: `POST /api/v1/vouchers/validate`
- Promotions: CRUD penuh → `/api/v1/promotions` dan `/:id`
- Promotions Calculate: `POST /api/v1/promotions/calculate`
- Operational Expenses: CRUD penuh → `/api/v1/operational-expenses` dan `/:id`
- Transactions:
  - Listing dasar: `GET /api/v1/transactions`
  - Aksi status: `POST /api/v1/transactions/:id/cancel`, `POST /api/v1/transactions/:id/refund`
- Reports:
  - Root analytics: `GET /api/v1/reports` (kompatibel dengan Next `/app/api/reports`)
  - Financial: `GET /api/v1/reports/financial`
- Users: CRUD penuh → `/api/v1/users` dan `/:id` (admin-only create/update/delete)
- Members: List, `GET /api/v1/members/:id`, `GET /api/v1/members/search?q=...`
- Cashier Shifts: `GET /api/v1/cashier-shifts/current`, `POST /open`, `POST /close`
- Payments: `POST /api/v1/payments/{bank-transfer|qris|card}/confirm`, `POST /api/v1/payments/midtrans/create-token`, `POST /api/v1/payments/midtrans/webhook`
- Dashboard: `GET /api/v1/dashboard/stats`, `POST /api/v1/dashboard/reset`
- WhatsApp: `POST /api/v1/whatsapp/send-receipt`, `POST /api/v1/whatsapp/send-closure-summary`

### Status Implementasi
- Endpoint yang sebelumnya ditandai “perlu implementasi” kini tersedia di Express v1 (lihat daftar di atas). Frontend aman untuk mengarah ke `/api/v1/*` secara eksklusif.

## Rencana Cutover Bertahap
1) Arahkan seluruh halaman frontend ke `/api/v1/*` (produk, kategori, voucher, promosi, pengeluaran operasional, transaksi, laporan finansial, laporan root, users/members, cashier shifts, payments, dashboard, whatsapp).
2) Nonaktifkan fallback proxy `/api/legacy/*` di `backend/src/server.js` (guard dengan env dan kemudian dihapus).
3) Observasi 1–2 minggu; jika stabil, lanjutkan penghapusan direktori Next `app/api/*` yang sudah tidak digunakan.

## Checklist Validasi
- [ ] Frontend sudah tidak memanggil `app/api/*`; semua ke `/api/v1/*`.
- [ ] Halaman utama (Produk, Kategori, Voucher, Promosi, Pengeluaran Operasional, Transaksi, Laporan Finansial, Laporan Root) berfungsi.
- [ ] Auth/token diteruskan benar ke backend Express.
- [ ] Tidak ada 404/500 baru di console browser.
- [ ] Fallback proxy `/api/legacy/*` dimatikan.

## Catatan
- Beberapa query parameter di Next API tidak digunakan di Express (mis. `includeInactive`). Sesuaikan filter di frontend untuk memakai parameter yang didukung (`active`, `categoryId`, dll.).
- Untuk pemakaian `GET /resource?id=...`, migrasi ke `GET /resource/:id` sesuai desain Express.