# Migrasi Backend ke Supabase

Panduan ini menjelaskan langkah-langkah migrasi infrastruktur backend dan database dari Render ke Supabase.

## 1. Persiapan Supabase

1. Buat proyek baru di [Supabase Dashboard](https://supabase.com).
2. Ambil kredensial database dari Settings > Database > Connection parameters.
3. Ambil kredensial API dari Settings > API (URL, Anon Key, Service Role Key).
4. Ambil JWT Secret dari Settings > API > JWT Settings.

## 2. Konfigurasi Environment Variables

Update file `.env` (atau `.env.local` / Environment Variables di server) dengan nilai berikut:

```bash
# Database Connection (Supabase)
# Gunakan port 5432 (Session mode) atau 6543 (Transaction mode)
DATABASE_URL="postgres://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Supabase API
SUPABASE_URL="https://[PROJECT-REF].supabase.co"
SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]" # Diperlukan untuk auto-migrasi user

# Auth Configuration
# Untuk memverifikasi token Supabase secara lokal (fallback)
JWT_SECRET="[SUPABASE_JWT_SECRET]" 
JWT_AUD="authenticated" # Default audience Supabase
JWT_ISS="https://[PROJECT-REF].supabase.co/auth/v1" # Issuer Supabase

# Legacy Database (Untuk script migrasi data saja)
OLD_DATABASE_URL="postgres://[OLD_USER]:[OLD_PASS]@[OLD_HOST]:[OLD_PORT]/[OLD_DB]"
```

## 3. Migrasi Database (Schema & Data)

Aplikasi backend secara otomatis akan membuat tabel (Schema) saat dijalankan pertama kali berkat `sequelize.sync()`.

Untuk memindahkan data dari database lama (Render) ke Supabase:

1. Pastikan `OLD_DATABASE_URL` dan `DATABASE_URL` sudah diset di `.env`.
2. Jalankan script migrasi:

```bash
node backend/scripts/migrate-to-supabase.js
```

Script ini akan menyalin data tabel demi tabel dengan urutan yang benar untuk menjaga integritas Foreign Keys.

## 4. Migrasi Autentikasi

Sistem autentikasi telah diperbarui untuk mendukung **Supabase Auth** secara native dengan fitur "Lazy Migration".

### Cara Kerja:
1. **Login**: Endpoint `/api/v1/auth/login` sekarang mencoba login ke Supabase terlebih dahulu.
2. **Auto-Migrasi User**: Jika login Supabase gagal (user belum ada) tapi login lokal berhasil (password cocok dengan DB lama), sistem akan otomatis membuatkan user di Supabase Auth dengan email & password yang sama.
3. **Verifikasi Token**: Middleware autentikasi (`authMiddleware`) memverifikasi token yang diterima. Prioritas utama adalah memvalidasi token Supabase (via API `getUser`). Jika gagal, sistem mencoba memvalidasi sebagai token JWT lokal (legacy) untuk meminimalkan downtime selama transisi.

### Rollback Plan
Jika terjadi masalah fatal dengan Supabase Auth:
1. Hapus variable `SUPABASE_URL` atau biarkan token validasi gagal.
2. Sistem akan fallback ke verifikasi JWT lokal (pastikan `JWT_SECRET` lama masih ada atau sesuai).
3. Anda dapat mengembalikan `DATABASE_URL` ke database lama jika perlu.

## 5. Deployment

1. Commit semua perubahan.
2. Set Environment Variables di platform deployment (Vercel/Render/Railway).
3. Redeploy aplikasi backend.
4. Pantau logs untuk memastikan koneksi database berhasil (`[Express] Backend listening...`).
