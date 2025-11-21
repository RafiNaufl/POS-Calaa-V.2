# Deploy Env Checklist

This checklist helps you configure environment variables separately for the frontend (Next.js) and backend (Express).

## Frontend (Next.js)
- `NEXT_PUBLIC_BACKEND_URL` → public base URL to backend, e.g., `https://api.pos.example.com`
- `NEXTAUTH_URL` → public URL of the frontend site, e.g., `https://pos.example.com`
- `NEXTAUTH_SECRET` → strong random secret for NextAuth
- (Optional) `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` → only if Snap is initialized client-side

Notes:
- Do not expose `MIDTRANS_SERVER_KEY` on the frontend. Keep it backend-only.
- Prefer HTTPS for all URLs.

## Backend (Express)
- `BACKEND_PORT` → API port (e.g., `4000`)
- `CORS_ORIGIN` → comma-separated allowed origins, e.g., `https://pos.example.com,https://staging.pos.example.com`
- `JWT_SECRET` → strong random secret for signing tokens
- `JWT_AUD` → audience (default `pos-app`)
- `JWT_ISS` → issuer (default `pos-backend`)
- `DATABASE_URL` → Postgres connection string
- `MIDTRANS_SERVER_KEY` → server-side Midtrans key
- `MIDTRANS_MERCHANT_ID` → merchant id (optional, if required)
- `MIDTRANS_IS_PRODUCTION` → `true`/`false` per environment
- `WHATSAPP_SESSION_DIR` → directory for Baileys auth state (persistent volume)

## Platform-specific
### Vercel (Frontend)
Set the following in Project Settings → Environment Variables:
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- (Optional) `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`

### Backend Host (Railway/Render/VPS)
Set:
- `DATABASE_URL`
- `JWT_SECRET`, `JWT_AUD`, `JWT_ISS`
- `CORS_ORIGIN`
- `MIDTRANS_SERVER_KEY`, `MIDTRANS_MERCHANT_ID`, `MIDTRANS_IS_PRODUCTION`
- `WHATSAPP_SESSION_DIR`

## Smoke Tests After Deploy
- Backend: `GET /health` returns `{ status: 'ok' }`
- Auth: `POST /api/v1/auth/login` returns `accessToken`
- Frontend: can load dashboard, list products, perform a transaction
- Webhook: Midtrans sandbox updates transaction status
- WhatsApp: receipt sending works if enabled and connected

## Troubleshooting Env
- `CORS_ORIGIN` format:
  - Masukkan domain lengkap tanpa trailing slash. Contoh benar: `https://pos.example.com`
  - Untuk beberapa origin, gunakan koma: `https://pos.example.com,https://staging.pos.example.com`
  - Hindari wildcard `*` di production; backend menerapkan whitelist.
- HTTPS wajib:
  - `NEXT_PUBLIC_BACKEND_URL` dan `NEXTAUTH_URL` sebaiknya HTTPS pada production. Banyak browser memblokir credential/Authorization di HTTP non-secure.
- Preflight CORS gagal (status 403 atau blocked):
  - Pastikan origin frontend ada dalam `CORS_ORIGIN`.
  - Pastikan request menyertakan header `Authorization` hanya untuk endpoint yang perlu; backend sudah mengizinkan `Content-Type, Authorization`.
  - Cek bahwa tidak ada trailing slash mismatch antara origin request dan konfigurasi.
- Header `Authorization` hilang:
  - Pastikan login di frontend menyimpan token (lihat `lib/auth.ts`) dan `apiFetch` menambahkan header.
  - Cek cookie fallback tidak digunakan; backend sekarang JWT-only.
- NEXTAUTH_SECRET:
  - Gunakan string acak kuat. Di Vercel, generate dengan `openssl rand -base64 32` lalu tempel ke env.
- Midtrans:
  - `MIDTRANS_SERVER_KEY` hanya di backend. Jangan menaruhnya di frontend.
  - `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` hanya diperlukan jika Snap di-initialize di frontend.
  - Set `MIDTRANS_IS_PRODUCTION=false` di sandbox.
- WhatsApp:
  - Pastikan `WHATSAPP_SESSION_DIR` menunjuk ke direktori persist (volume) dan dapat diakses oleh proses backend.
- Postgres URL:
  - Gunakan format `postgresql://user:pass@host:port/dbname`.
  - Hindari Prisma Data Proxy untuk Sequelize; gunakan koneksi langsung.
- Urutan load env:
  - Frontend: `.env` lalu override `.env.local` (lokal). Di Vercel, gunakan Project Settings.
  - Backend: prefer `backend/.env` jika ada, fallback ke `.env`. Di host, set di dashboard host.
- Cek cepat:
  - Jalankan `npm run dev` atau `npm run build` (frontend) dan `npm run backend:dev`/`backend:start` (backend); skrip lint env akan gagal cepat dengan pesan variabel yang kurang.
