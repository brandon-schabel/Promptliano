import { defineConfig } from 'drizzle-kit'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Resolve repo-root-relative path to the SQLite file
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = __dirname // packages/database
const repoRoot = resolve(packageRoot, '..', '..')

const dataDir = process.env.PROMPTLIANO_DATA_DIR
  ? resolve(repoRoot, process.env.PROMPTLIANO_DATA_DIR)
  : join(repoRoot, 'data')

const dbFile = join(dataDir, 'promptliano.db')
const dbUrl = `file:${dbFile}`

export default defineConfig({
  schema: ['./src/schema.ts', './src/schema/mcp-executions.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  // Use Node driver only for Drizzle Kit (Studio/Generate). Runtime uses bun:sqlite.
  driver: 'better-sqlite3',
  dbCredentials: {
    // Drizzle Kit expects a filesystem path for better-sqlite3
    url: dbFile
  },
  verbose: true,
  strict: true
})
