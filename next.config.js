// Import konfigurasi EventEmitter untuk mengatasi MaxListenersExceededWarning
require('./lib/eventEmitter');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'images.unsplash.com'],
  },
  // Menambahkan header untuk mendukung Web Bluetooth API di Android
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'bluetooth=self',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig