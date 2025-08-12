import { PrismaClient } from '@prisma/client'

// Configuration for Prisma client with connection handling
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    // Add connection timeout and retry logic for serverless environment
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Add connection retry logic for serverless environment
    errorFormat: 'minimal',
    // Note: Connection pooling is configured via DATABASE_URL parameters
    // in the schema.prisma file, not here in the PrismaClient constructor
  }).$extends({
    query: {
      // No need to remove dokuReferenceId anymore as the column exists in the database
      transaction: {
        async findMany({ args, query }) {
          return query(args);
        },
        async findUnique({ args, query }) {
          return query(args);
        },
        async findFirst({ args, query }) {
          return query(args);
        }
      },
    },
  })
}

// Define the return type of our extended Prisma client
type ExtendedPrismaClient = ReturnType<typeof prismaClientSingleton>;

// Singleton pattern for Prisma client to avoid connection issues during build
const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Handle disconnection on application shutdown
if (process.env.NODE_ENV !== 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}