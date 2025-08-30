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
import { fileURLToPath } from 'url'

// Resolve stable paths relative to this package (robust to cwd)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageRoot = resolve(__dirname, '..') // packages/database
const repoRoot = resolve(packageRoot, '..', '..') // monorepo root
const drizzleDir = join(packageRoot, 'drizzle')

// Performance-optimized SQLite configuration
const createDatabase = () => {
  // Use in-memory database for tests to avoid file system issues
  const dbPath = process.env.NODE_ENV === 'test'
    ? ':memory:'
    : (
        process.env.DATABASE_PATH
          || (process.env.PROMPTLIANO_DATA_DIR ? join(process.env.PROMPTLIANO_DATA_DIR, 'promptliano.db') : join(repoRoot, 'data', 'promptliano.db'))
      )
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
  // If no core tables, bootstrap from earliest migration
  const hasProjectsTable = sqlite
    .query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
    .all().length > 0

  if (!hasProjectsTable) {
    if (process.env.NODE_ENV === 'test') {
      // In test mode, don't auto-create tables - tests should use createTestDatabase()
      console.log('📋 Test mode: skipping automatic table creation (use createTestDatabase() instead)')
      console.warn('⚠️ Warning: Tests should use createTestDatabase() from test-utils/test-db.ts')
    } else {
      console.log('📋 Creating database tables (initial bootstrap)...')
      const migrationPath = join(drizzleDir, '0000_base.sql')
      const migrationSql = readFileSync(migrationPath, 'utf8')
      const statements = migrationSql.split('--> statement-breakpoint')
      for (const statement of statements) {
        const cleanStatement = statement.trim()
        if (cleanStatement && !cleanStatement.startsWith('--')) {
          try {
            sqlite.exec(cleanStatement)
          } catch (e: any) {
            const msg = String(e?.message || e)
            if (!/already exists/i.test(msg)) throw e
          }
        }
      }
      console.log('✅ Core tables created successfully')
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
