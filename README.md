# POS Fashion App

## Deployment Guide for Vercel

### Database Configuration

The application is experiencing a `PrismaClientInitializationError` because it's trying to connect to a local PostgreSQL database at `localhost:5432` when deployed on Vercel. This won't work because Vercel's serverless functions can't connect to your local machine.

### Solution

1. **Set up a hosted PostgreSQL database**
   - Use Vercel Postgres (recommended)
   - Or another hosted PostgreSQL provider (Supabase, Railway, Neon, etc.)

2. **Configure environment variables in Vercel**
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add the following environment variables:
     - `DATABASE_URL`: Your main PostgreSQL connection string with connection pooling parameters
       - Example: `postgresql://user:password@host:port/database?connection_limit=5&pool_timeout=10`
     - If using Vercel Postgres, also add:
       - `POSTGRES_PRISMA_URL`: Connection string with pooling
       - `POSTGRES_URL_NON_POOLING`: Direct connection string

3. **Update your schema.prisma file**
   - The schema.prisma file has been updated to support connection pooling
   - Connection pooling is configured via URL parameters, not in the PrismaClient constructor
   - Uncomment the Vercel Postgres specific lines if you're using Vercel Postgres

4. **Connection pooling configuration**
   - **Important**: Connection pooling must be configured in the database URL parameters
   - Add `connection_limit=5&pool_timeout=10` to your DATABASE_URL
   - Do NOT configure connection pooling in the PrismaClient constructor as it will cause type errors
   - For Vercel Postgres, connection pooling is handled automatically

### Deployment Steps

1. Push your code changes to your GitHub repository
2. Connect your repository to Vercel if not already done
3. Configure the environment variables as described above
4. Deploy your application using the Vercel dashboard or CLI:
   ```
   npm install -g vercel
   vercel login
   vercel
   ```

### Running Migrations and Seeding the Database

#### Option 1: Using Prisma Migrate Deploy in Build Script

The project is already configured to automatically run migrations during deployment with the following build script in `package.json`:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && NEXT_DISABLE_ESLINT=1 SKIP_LINT=1 next build"
  }
}
```

This ensures that:
1. Prisma Client is generated (`prisma generate`)
2. Any pending migrations are applied to your database (`prisma migrate deploy`)
3. The Next.js application is built

**Important**: The `prisma` package is correctly listed as a dependency (not a devDependency) in your `package.json`, which is necessary for Vercel builds as Vercel prunes development dependencies during build.

#### Option 1: Using Prisma Migrate Deploy in Build Script

To automatically run migrations during deployment, update your `package.json` build script:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

**Important**: For this to work, you need to move `prisma` from `devDependencies` to `dependencies` in your `package.json`, as Vercel prunes dev dependencies during build.

#### Option 2: Using the API Endpoint for Seeding

This project includes an API endpoint at `/api/seed` that can be used to seed the database. After deployment:

1. Access your deployed application's seed endpoint: `https://your-app-url.vercel.app/api/seed`
2. Send a POST request to this endpoint (using a tool like Postman or curl)

```bash
curl -X POST https://your-app-url.vercel.app/api/seed
```

#### Option 3: Using Separate Preview/Production Databases

For pull request previews, you can set up a separate database to avoid affecting your production database:

1. Create a second database for preview deployments
2. In Vercel, add a separate `DATABASE_URL` environment variable for the Preview environment
3. This allows you to safely run migrations and seeds on preview deployments

### Troubleshooting

If you continue to experience database connection issues:

1. Check that your database is accessible from Vercel's servers
2. Verify that your connection strings are correct with proper connection pooling parameters
3. Make sure your database server allows connections from Vercel's IP addresses
4. Check Vercel logs for more detailed error messages
5. If you see `PrismaClientInitializationError`, verify your database connection configuration
6. If migrations fail, try running them manually using the Prisma CLI locally with the production database URL

### Local Development

For local development, you can continue using your local PostgreSQL database by setting the appropriate `DATABASE_URL` in your `.env.local` file:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/pos_db?schema=public&connection_limit=5&pool_timeout=10"
```

This includes connection pooling parameters for better performance.