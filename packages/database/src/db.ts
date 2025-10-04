/**
 * Drizzle Database Connection - Performance Optimized
 * Replaces DatabaseManager with optimized SQLite connection
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as mainSchema from './schema'
import * as mcpSchema from './schema/mcp-executions'
import { relations } from 'drizzle-orm'

// Add relations for MCP schema tables to the main project
const mcpToolExecutionsRelations = relations(mcpSchema.mcpToolExecutions, ({ one }) => ({
  project: one(mainSchema.projects, {
    fields: [mcpSchema.mcpToolExecutions.projectId],
    references: [mainSchema.projects.id]
  })
}))

const mcpToolStatisticsRelations = relations(mcpSchema.mcpToolStatistics, ({ one }) => ({
  project: one(mainSchema.projects, {
    fields: [mcpSchema.mcpToolStatistics.projectId],
    references: [mainSchema.projects.id]
  })
}))

const mcpExecutionChainsRelations = relations(mcpSchema.mcpExecutionChains, ({ one }) => ({
  execution: one(mcpSchema.mcpToolExecutions, {
    fields: [mcpSchema.mcpExecutionChains.executionId],
    references: [mcpSchema.mcpToolExecutions.id]
  }),
  parentExecution: one(mcpSchema.mcpToolExecutions, {
    fields: [mcpSchema.mcpExecutionChains.parentExecutionId],
    references: [mcpSchema.mcpToolExecutions.id]
  })
}))

const mcpErrorPatternsRelations = relations(mcpSchema.mcpErrorPatterns, ({ one }) => ({
  project: one(mainSchema.projects, {
    fields: [mcpSchema.mcpErrorPatterns.projectId],
    references: [mainSchema.projects.id]
  })
}))

// Combine all schema exports with proper typing including MCP relations
const schema: Record<string, any> = {
  ...mainSchema,
  ...mcpSchema,
  // Add MCP relations to the schema
  mcpToolExecutionsRelations,
  mcpToolStatisticsRelations,
  mcpExecutionChainsRelations,
  mcpErrorPatternsRelations
}
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { databaseConfig } from '@promptliano/config'
import { fileURLToPath } from 'url'

// Resolve stable paths relative to this package (robust to cwd)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = resolve(__dirname, '..') // packages/database
const repoRoot = resolve(packageRoot, '..', '..') // monorepo root
const drizzleDir = join(packageRoot, 'drizzle')

// Expose database path resolution so server can log it on startup
export function getDatabasePath(): string {
  // 1) Explicit test mode: in-memory
  if (process.env.NODE_ENV === 'test') return ':memory:'

  // 2) Explicit overrides
  const explicitPath = process.env.DATABASE_PATH
  if (explicitPath && explicitPath.trim() !== '') {
    return explicitPath
  }
  const dataDir = process.env.PROMPTLIANO_DATA_DIR
  if (dataDir && dataDir.trim() !== '') {
    return join(dataDir, 'promptliano.db')
  }

  const repoDbPath = join(repoRoot, 'data', 'promptliano.db')

  // 3) Development defaults to local repo data dir for convenience
  //    Treat DEV=true the same as development to align with server dev script.
  if (process.env.NODE_ENV === 'development' || process.env.DEV === 'true') {
    return repoDbPath
  }

  // 3b) Fallback: if running inside the repo and a local database exists, prefer it
  if (existsSync(repoDbPath)) {
    return repoDbPath
  }

  // 4) Production: platform-appropriate app data directory
  return databaseConfig.path
}

// Performance-optimized SQLite configuration
const createDatabase = () => {
  // Use in-memory database for tests to avoid file system issues
  const dbPath = getDatabasePath()
  // Ensure the directory for the DB file exists when not using in-memory
  if (dbPath !== ':memory:') {
    try {
      const dir = dirname(dbPath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    } catch (e) {
      console.warn('⚠️ Could not ensure database directory exists:', e)
    }
  }
  const sqlite = new Database(dbPath, {
    create: true,
    // Performance optimizations
    strict: true
  })

  // SQLite performance optimizations
  sqlite.exec('PRAGMA journal_mode = WAL') // Write-Ahead Logging for better concurrency
  sqlite.exec('PRAGMA synchronous = NORMAL') // Balance safety and performance
  sqlite.exec('PRAGMA cache_size = 1000000') // 1GB cache
  sqlite.exec('PRAGMA foreign_keys = ON') // Enable foreign key constraints
  sqlite.exec('PRAGMA temp_store = MEMORY') // Store temp data in memory
  sqlite.exec('PRAGMA mmap_size = 268435456') // 256MB memory mapping
  sqlite.exec('PRAGMA page_size = 32768') // Larger page size for better performance

  return sqlite
}

// Initialize database and run migrations
const sqlite = createDatabase()

// Auto-run migrations and create tables
try {
  // If any core tables are missing, bootstrap from earliest migration
  const coreTables = [
    'projects',
    'files',
    'selected_files',
    'provider_keys',
    // Ensure model configuration tables exist during initial bootstrap
    'model_configs',
    'model_presets'
  ]
  const tableExists = (name: string) =>
    (
      sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) as
        | { name?: string }
        | undefined
    )?.name === name
  const missingCoreTables = coreTables.filter((t) => !tableExists(t))

  if (missingCoreTables.length > 0) {
    if (process.env.NODE_ENV === 'test') {
      // In test mode, create tables for MCP tests that use the global db instance
      console.error('📋 Test mode: creating database tables from base migration...')
      const migrationPath = join(drizzleDir, '0000_base.sql')
      const migrationSql = readFileSync(migrationPath, 'utf8')
      const statements = migrationSql.split('--> statement-breakpoint')
      const createTableRe = /^CREATE\s+TABLE\s+`?(\w+)`?\s*\(/i
      for (const statement of statements) {
        const clean = statement.trim()
        if (!clean || clean.startsWith('--')) continue
        try {
          sqlite.exec(clean)
        } catch (e: any) {
          const msg = String(e?.message || e)
          if (!/already exists/i.test(msg)) {
            console.warn(`⚠️ Failed to execute statement in test mode:`, msg)
          }
        }
      }
      console.error('✅ Test tables created successfully')

      // Seed a test project for MCP tests using a real temp directory
      try {
        const { tmpdir } = await import('os')
        const { join } = await import('path')
        const { mkdirSync, existsSync } = await import('fs')

        const testProjectPath = join(tmpdir(), `promptliano-test-project-${Date.now()}`)
        if (!existsSync(testProjectPath)) {
          mkdirSync(testProjectPath, { recursive: true })
        }

        const now = Date.now()
        sqlite.exec(`
          INSERT OR IGNORE INTO projects (id, name, path, description, created_at, updated_at)
          VALUES (1, 'Test Project', '${testProjectPath.replace(/'/g, "''")}', 'Auto-created test project', ${now}, ${now})
        `)
        console.error(`✅ Test project seeded (ID: 1, path: ${testProjectPath})`)
      } catch (e: any) {
        console.warn('⚠️ Failed to seed test project:', e?.message || e)
      }
    } else {
      console.error(
        `📋 Creating database tables (initial bootstrap for missing tables: ${missingCoreTables.join(', ')})...`
      )
      const migrationPath = join(drizzleDir, '0000_base.sql')
      const migrationSql = readFileSync(migrationPath, 'utf8')
      const statements = migrationSql.split('--> statement-breakpoint')
      // Only execute CREATE TABLE statements for missing tables to avoid index/column errors
      const createTableRe = /^CREATE\s+TABLE\s+`?(\w+)`?\s*\(/i
      for (const statement of statements) {
        const clean = statement.trim()
        if (!clean || clean.startsWith('--')) continue
        const m = clean.match(createTableRe)
        if (!m) {
          // Skip non-table statements during bootstrap (indexes will be handled by migrations/upgrades)
          continue
        }
        const tableName = m[1] as string
        if (!missingCoreTables.includes(tableName)) continue
        try {
          sqlite.exec(clean)
        } catch (e: any) {
          const msg = String(e?.message || e)
          if (!/already exists/i.test(msg)) throw e
        }
      }
      console.error('✅ Core tables ensured successfully')
    }
  }

  // With a consolidated base migration, no conditional per-file bootstraps needed

  // encryption_keys table no longer used; per-column encryption removed in favor of env secretRef
} catch (error) {
  console.warn('⚠️ Database initialization warning:', error)
}

// Create Drizzle instance with proper schema typing for query API
export const db = drizzle(sqlite, {
  schema,
  logger: process.env.NODE_ENV === 'development'
}) as ReturnType<typeof drizzle<typeof schema>>

// Export raw SQLite instance for migrations and special operations
export const rawDb = sqlite

// Utility functions for database management
export const dbUtils = {
  /**
   * Close database connection
   */
  close: () => {
    sqlite.close()
  },

  /**
   * Get database file size in bytes
   */
  getSize: (): number => {
    const result = sqlite
      .query('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()')
      .get() as any
    return result?.size || 0
  },

  /**
   * Vacuum database to reclaim space
   */
  vacuum: () => {
    sqlite.exec('VACUUM')
  },

  /**
   * Analyze database for query optimization
   */
  analyze: () => {
    sqlite.exec('ANALYZE')
  },

  /**
   * Get database statistics
   */
  getStats: () => {
    const pageCount = sqlite.query('SELECT * FROM pragma_page_count()').get() as any
    const pageSize = sqlite.query('SELECT * FROM pragma_page_size()').get() as any
    const walCheckpoint = sqlite.query('PRAGMA wal_checkpoint').get() as any

    return {
      pageCount: pageCount?.page_count || 0,
      pageSize: pageSize?.page_size || 0,
      size: (pageCount?.page_count || 0) * (pageSize?.page_size || 0),
      walCheckpoint
    }
  },

  /**
   * Execute raw SQL (use sparingly, prefer Drizzle queries)
   */
  raw: (sql: string, params?: any[]) => {
    if (params) {
      return sqlite.query(sql).all(...params)
    }
    return sqlite.query(sql).all()
  }
}

// Export types for external usage - proper typing for query API
export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>
export type DatabaseConnection = typeof sqlite
export type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// Export schema for type inference in repositories
export { schema }
