# Integrasi Printer untuk POS App

Dokumen ini menjelaskan cara menggunakan fitur pencetakan struk pada aplikasi POS dengan berbagai metode yang tersedia.

# Integrasi Printer untuk POS App
## Metode Pencetakan yang Tersedia

Aplikasi ini mendukung beberapa metode pencetakan struk:

1. **Pencetakan Browser** - Menggunakan fitur pencetakan bawaan browser
2. **Web Bluetooth API** - Terhubung langsung ke printer thermal via Bluetooth

## Persyaratan
### Untuk Web Bluetooth API
- Browser yang mendukung Web Bluetooth API (Chrome, Edge, Opera)
- Printer thermal dengan koneksi Bluetooth
- Izin Bluetooth diaktifkan di browser dan sistem operasi

### Persyaratan
### Untuk Web Bluetooth API
- Browser yang mendukung Web Bluetooth API
- Printer thermal dengan koneksi Bluetooth
- Izin Bluetooth diaktifkan di browser dan sistem operasi

## Cara Menggunakan

### Pencetakan Browser
1. Klik tombol "Cetak Struk (Browser)" pada preview struk
2. Dialog pencetakan browser akan muncul
3. Pilih printer dan konfigurasi yang diinginkan
4. Klik "Cetak"

### Pencetakan dengan Web Bluetooth API
1. Pastikan printer thermal Bluetooth sudah dinyalakan dan dalam mode pairing
2. Klik tombol "Cetak ke Printer Thermal (Web Bluetooth)"
3. Klik tombol "Connect to Printer"
4. Dialog pemilihan perangkat Bluetooth akan muncul
5. Pilih printer thermal Anda dari daftar
6. Tunggu hingga proses koneksi dan pencetakan selesai



## Pemecahan Masalah

### Printer Tidak Terdeteksi (Web Bluetooth)
- Pastikan printer dalam mode pairing/discoverable
- Pastikan Bluetooth diaktifkan di perangkat Anda
- Coba restart printer dan refresh halaman
- Periksa apakah browser Anda mendukung Web Bluetooth API



### Masalah Format Pencetakan
- Pastikan printer mendukung ESC/POS commands
- Sesuaikan lebar kertas (58mm atau 80mm) pada pengaturan

## Informasi Teknis

### Komponen yang Digunakan

- **ThermalPrinter.tsx** - Implementasi Web Bluetooth API untuk printer thermal
- **BluetoothPrinter.tsx** - Komponen untuk menampilkan informasi printer (tidak lagi menggunakan JSPrintManager/defuj)
- **PrinterIntegration.tsx** - Wrapper untuk komponen printer
- **ReceiptPreview.tsx** - Komponen untuk menampilkan preview struk dan opsi pencetakan



## Pengembangan Lebih Lanjut

Untuk menambahkan dukungan printer baru atau metode pencetakan lainnya, Anda dapat memodifikasi komponen `PrinterIntegration.tsx` dan menambahkan implementasi baru sesuai kebutuhan.