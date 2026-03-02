import pg from 'pg'

const { Pool } = pg

// Single connection pool shared across the app
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep pool small — suits a low-resource VPS
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
})

// Verify connection on startup
db.query('SELECT 1').catch((err) => {
  console.error('Database connection failed:', err.message)
  process.exit(1)
})
