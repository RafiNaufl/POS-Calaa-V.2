# Deployment Guide (Frontend + Backend)

Panduan ini merangkum langkah deploy untuk frontend (Next.js) dan backend (Express), serta menautkan ke checklist environment variabel yang telah diperbarui.

## Prasyarat
- Database PostgreSQL (contoh: Neon, Supabase, Railway)
- Akun Vercel untuk frontend
- Host untuk backend (contoh: Railway, Render, Fly.io, VM/Docker)

## Checklist Environment
- Frontend (Vercel): lihat `docs/vercel-frontend-env.md`
- Frontend & Backend (lengkap): lihat `docs/env-checklist.md`

Pastikan variabel berikut minimal terisi:
- Frontend: `NEXT_PUBLIC_BACKEND_URL` (wajib), `NEXTAUTH_URL` & `NEXTAUTH_SECRET` (wajib di production)
- Backend: `DATABASE_URL`, `JWT_SECRET` (wajib), `CORS_ORIGIN` (wajib di production), Midtrans keys jika produksi

## Langkah Deploy Frontend (Vercel)
1. Konfigurasi env sesuai `docs/vercel-frontend-env.md` di Project Settings Vercel.
2. Jalankan deploy:
   ```bash
   npx vercel
   npx vercel --prod
   ```
3. Verifikasi smoke test frontend di `docs/env-checklist.md`.

## Langkah Deploy Backend (Express)
1. Siapkan host (Railway/Render/Fly/VM/Docker) dan set env sesuai `backend/.env.example`.
2. Set `CORS_ORIGIN` ke domain frontend (tanpa trailing slash).
3. Jalankan aplikasi backend sesuai host (contoh lokalisasi):
   ```bash
   NODE_ENV=production BACKEND_PORT=4000 node backend/src/server.js
   ```
4. Verifikasi endpoint kesehatan:
   ```
   GET https://api.your-domain.com/health -> { status: "ok" }
   ```

## Pasca Deploy
- Jalankan migrasi database sesuai tooling Sequelize (lihat `docs/postgres-migration.md` bila relevan).
- Uji login dan alur transaksi dari frontend, pastikan header `Authorization: Bearer <token>` terkirim.
- Validasi webhook Midtrans (jika digunakan) dan integrasi WhatsApp (jika diaktifkan).

Catatan: Proyek telah menggunakan Sequelize, bukan Prisma. Beberapa perintah Prisma dihapus dari panduan ini.
