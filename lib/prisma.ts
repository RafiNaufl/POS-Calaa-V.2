import { PrismaClient } from '@prisma/client'

// Configuration for Prisma client with connection handling
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    // Add connection timeout and retry logic
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
}

// Singleton pattern for Prisma client to avoid connection issues during build
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Handle disconnection on application shutdown
if (process.env.NODE_ENV !== 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}