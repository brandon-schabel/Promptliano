const path = require('node:path')

// Resolve repo-root-relative path to the SQLite file
const packageRoot = __dirname // packages/database
const repoRoot = path.resolve(packageRoot, '..', '..')

const dataDir = process.env.PROMPTLIANO_DATA_DIR
  ? path.resolve(repoRoot, process.env.PROMPTLIANO_DATA_DIR)
  : path.join(repoRoot, 'data')

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
