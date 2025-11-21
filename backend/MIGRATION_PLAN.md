# Rencana Migrasi Endpoint (Next.js `app/api/*` -> Express `/api/v1/*`)

Dokumen ini merangkum status dan strategi migrasi. Saat ini, sebagian besar endpoint telah mencapai parity di Express v1 dan frontend telah diarahkan ke `/api/v1/*`. Fallback ke Next.js hanya diperlukan untuk route yang tersisa.

## Prinsip Utama

- Backward compatibility: Endpoints lama tetap berfungsi selama migrasi.
- Fallback mechanism: Permintaan yang belum dimigrasikan diproksikan ke Next.js (`/api/legacy/*`).
- Observability: Logging request (pino) dan pengukuran durasi per request.
- Prioritas: Mulai dari endpoint paling sering digunakan dan berkompleksitas rendah.

## Endpoint Express v1 Tersedia (parity)

- Categories: CRUD penuh → `GET/POST/PUT/DELETE /api/v1/categories`, `GET /api/v1/categories/:id`
- Products: CRUD penuh → `GET/POST/PUT/DELETE /api/v1/products`, `GET /api/v1/products/:id`
- Products Import: `POST /api/v1/products/import` (CSV)
- Vouchers: CRUD penuh → `GET/POST/PUT/DELETE /api/v1/vouchers`, `GET /api/v1/vouchers/:id`
- Vouchers Validate: `POST /api/v1/vouchers/validate`
- Promotions: CRUD penuh → `GET/POST/PUT/DELETE /api/v1/promotions`, `GET /api/v1/promotions/:id`
- Promotions Calculate: `POST /api/v1/promotions/calculate`
- Operational Expenses: CRUD penuh → `GET/POST/PUT/DELETE /api/v1/operational-expenses`, `GET /api/v1/operational-expenses/:id`
- Transactions: `GET /api/v1/transactions`, `POST /api/v1/transactions`, `POST /api/v1/transactions/:id/cancel`, `POST /api/v1/transactions/:id/refund`
- Reports: `GET /api/v1/reports` (root analytics), `GET /api/v1/reports/financial`
- Users: `GET /api/v1/users`, `GET /api/v1/users/:id`, `POST/PUT/DELETE /api/v1/users` (admin-only)
- Members: `GET /api/v1/members`, `GET /api/v1/members/:id`, `GET /api/v1/members/search?q=...`
- Cashier Shifts: `GET /api/v1/cashier-shifts/current`, `POST /api/v1/cashier-shifts/open`, `POST /api/v1/cashier-shifts/close`
- Payments: `POST /api/v1/payments/{bank-transfer|qris|card}/confirm`, `POST /api/v1/payments/midtrans/create-token`, `POST /api/v1/payments/midtrans/webhook`
- Dashboard: `GET /api/v1/dashboard/stats`, `POST /api/v1/dashboard/reset`
- WhatsApp: `POST /api/v1/whatsapp/send-receipt`, `POST /api/v1/whatsapp/send-closure-summary`

## Status Migrasi & Cutover

- Frontend telah diarahkan ke `/api/v1/*` untuk halaman: products, categories, promotions, vouchers, operational-expenses, transactions, reports (root & financial), users, members, cashier shifts, payments, dashboard, whatsapp.
- Endpoint yang sebelumnya di `app/api/*` untuk kategori di atas telah dihapus/ditinggalkan demi konsistensi Express v1.
- Fallback proxy `/api/legacy/*` dapat dimatikan dengan env flag dan akan dihapus setelah masa observasi.

## Langkah Migrasi per Endpoint

Untuk setiap endpoint yang dipindahkan:
1. Porting handler ke Express Router (`backend/src/routes/v1/...`).
2. Terapkan autentikasi JWT (`authMiddleware`).
3. Tambahkan validasi request (`buildValidator`).
4. Tulis test case (Supertest + Jest/Vitest) untuk ekivalensi perilaku.
5. Update dokumentasi API (lihat `backend/docs/api/README.md`).
6. Monitor performa dan error dari log pino.

## Backward Compatibility & Fallback

- Endpoint Express tersedia di prefix: `/api/v1/*`.
- Fallback `/api/legacy/*` bersifat opsional (default OFF saat cutover penuh). Gunakan env `ENABLE_LEGACY_PROXY=true` hanya jika diperlukan sementara.

## Penghapusan Direktori Lama

- Setelah cutover penuh dan observasi 1–2 minggu, hapus direktori `app/api/*` yang tidak lagi digunakan.

## Performa & Observability

- Logging: `backend/src/middleware/logger.js` (pino), log method, path, status, durasi.
- Tambahkan metrik lanjutan (opsional): histogram durasi, rate error per route.

## Catatan Konfigurasi

- Env yang relevan:
  - `BACKEND_PORT` (default: 4000)
  - `ENABLE_LEGACY_PROXY` (default: false saat cutover penuh)
  - `BACKEND_NEXT_FALLBACK_URL` (default: `http://127.0.0.1:3001` jika proxy diaktifkan)
  - `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- Pastikan `DATABASE_URL` digunakan oleh layer data (Sequelize).