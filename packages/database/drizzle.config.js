const { defineConfig } = require('drizzle-kit')
const { dirname, join, resolve } = require('node:path')

// Resolve repo-root-relative path to the SQLite file
const packageRoot = __dirname // packages/database
const repoRoot = resolve(packageRoot, '..', '..')

const dataDir = process.env.PROMPTLIANO_DATA_DIR
  ? resolve(repoRoot, process.env.PROMPTLIANO_DATA_DIR)
  : join(repoRoot, 'data')

const dbFile = join(dataDir, 'promptliano.db')
const dbUrl = `file:${dbFile}`

module.exports = defineConfig({
  schema: ['./src/schema.ts', './src/schema/mcp-executions.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbUrl
  },
  verbose: true,
  strict: true
})