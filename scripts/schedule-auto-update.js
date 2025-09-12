/**
 * Script untuk menjalankan auto-update-transaction-status.js secara terjadwal menggunakan node-cron
 * Script ini dapat dijalankan sebagai proses terpisah
 * 
 * Cara penggunaan: node scripts/schedule-auto-update.js
 */

const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

// Jadwal default: setiap jam pada menit ke-0
const DEFAULT_SCHEDULE = '0 * * * *';

// Ambil jadwal dari argumen command line atau gunakan default
const schedule = process.argv[2] || DEFAULT_SCHEDULE;

console.log(`Menjadwalkan pembaruan status transaksi otomatis dengan jadwal: ${schedule}`);

// Validasi format jadwal cron
if (!cron.validate(schedule)) {
  console.error('Format jadwal cron tidak valid!');
  console.error('Format yang benar: "* * * * *" (menit jam hari bulan hari-minggu)');
  console.error('Contoh: "0 * * * *" untuk setiap jam pada menit ke-0');
  process.exit(1);
}

// Path ke script auto-update-transaction-status.js
const scriptPath = path.join(__dirname, 'auto-update-transaction-status.js');

// Jadwalkan tugas menggunakan node-cron
cron.schedule(schedule, () => {
  console.log(`[${new Date().toISOString()}] Menjalankan pembaruan status transaksi otomatis...`);
  
  exec(`node ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    console.log(`Output: ${stdout}`);
    console.log(`[${new Date().toISOString()}] Pembaruan status transaksi selesai.`);
  });
});

console.log('Penjadwal berjalan. Tekan Ctrl+C untuk keluar.');