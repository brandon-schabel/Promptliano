const path = require('node:path')
const fs = require('node:fs')

// Resolve repo-root-relative path to the SQLite file
const packageRoot = __dirname // packages/database
const repoRoot = path.resolve(packageRoot, '..', '..')

const dataDir = process.env.PROMPTLIANO_DATA_DIR
  ? path.resolve(repoRoot, process.env.PROMPTLIANO_DATA_DIR)
  : path.join(repoRoot, 'data')

// Ensure the data directory exists so better-sqlite3 can create/open the DB
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
} catch (e) {
  // Non-fatal for config resolution; drizzle-kit will surface errors if any
  console.warn('[drizzle.config] Could not ensure data directory exists:', e)
}

const dbFile = path.join(dataDir, 'promptliano.db')

module.exports = {
  schema: ['./src/schema.ts', './src/schema/mcp-executions.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbFile
  },
  verbose: true,
  strict: true
}
