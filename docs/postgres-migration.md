# PostgreSQL Migration Guide

## Plan Overview

1. Replace Sequelize/SQLite with native PostgreSQL via `pg`.
2. Migrate critical APIs incrementally while maintaining functionality.
3. Ensure authentication uses PostgreSQL and bcrypt for secure password storage.

## Authentication

- Replace Sequelize `User.findOne` with `SELECT` using `pg` and bcrypt.
- Store hashed passwords using bcrypt with appropriate salt rounds.
- Validate credentials via direct SQL queries.

## Local Postgres Setup & Environment Variables

For local development, set up PostgreSQL and create a dedicated user and database:

- Start PostgreSQL and connect with `psql`
- Create database and user:
  - `CREATE DATABASE pos_db;`
  - `CREATE USER pos_user WITH PASSWORD 'yourpassword';`
  - `GRANT ALL PRIVILEGES ON DATABASE pos_db TO pos_user;`

Create `.env.local` in the project root with one of the following:

- `DATABASE_URL=postgresql://pos_user:yourpassword@localhost:5432/pos_db`
- Or provider-specific (e.g., Vercel Postgres):
  - `POSTGRES_URL_NON_POOLING=postgres://user:password@host:port/database`
  - `POSTGRES_PRISMA_URL=postgres://user:password@host:port/database?pgbouncer=true&connection_limit=1`

Supported envs in our connection helpers:

- URL-based: `DATABASE_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`
- Individual: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- SSL toggle: `PGSSL` / `PG_SSL` / `POSTGRES_SSL` (set to `true` to enable)

## Running Migrations and Seeding

- `node scripts/migrate.js`
- `node scripts/seed.js`

## Troubleshooting

- If you see `SASL: client password must be a string`, provide a valid `PGPASSWORD` or include a password in your URL.
- If you see `28P01 password authentication failed`, verify the user and password and ensure the role has access to the database.