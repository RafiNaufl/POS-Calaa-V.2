module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: ['**/backend/src/routes/v1/__tests__/**/*.js'],
  // Map ESM-only deps to simple stubs for Jest CommonJS runtime
  moduleNameMapper: {
    '^@whiskeysockets/baileys$': '<rootDir>/test-mocks/baileys.js',
    '^.*/lib/supabase$': '<rootDir>/test-mocks/supabase.js'
  }
};