/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'images.unsplash.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['prisma', 'sqlite3', 'sequelize'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = Array.isArray(config.externals)
        ? [...config.externals, 'sqlite3', 'sequelize']
        : config.externals
      
    }
    return config
  },
}

module.exports = nextConfig