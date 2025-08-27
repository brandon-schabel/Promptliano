/**
 * Drizzle Database Connection - Performance Optimized
 * Replaces DatabaseManager with optimized SQLite connection
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'
import * as mainSchema from './schema'
import * as mcpSchema from './schema/mcp-executions'

const schema = { ...mainSchema, ...mcpSchema }
import { readFileSync } from 'fs'
import { join } from 'path'

// Performance-optimized SQLite configuration
const createDatabase = () => {
  // Use in-memory database for tests to avoid file system issues
  const dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : './data/promptliano.db'
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
  // Check if tables exist, if not run the migration SQL directly
  const tables = sqlite.query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").all()
  if (tables.length === 0) {
    if (process.env.NODE_ENV === 'test') {
      // In test mode, don't auto-create tables - tests should use createTestDatabase()
      // This prevents the main database from interfering with test isolation
      console.log('📋 Test mode: skipping automatic table creation (use createTestDatabase() instead)')
      console.warn('⚠️ Warning: Tests should use createTestDatabase() from test-utils/test-db.ts')
      // Don't create tables here - let tests handle their own database setup
    } else {
      console.log('📋 Creating database tables...')
      // Try to read and execute the latest migration SQL
      const migrationFiles = ['0003_glorious_justice.sql', '0002_*.sql', '0001_*.sql', '0000_loose_bug.sql']
      let migrationExecuted = false
      
      for (const migrationFile of migrationFiles) {
        try {
          const migrationPath = join(process.cwd(), 'packages', 'database', 'drizzle', migrationFile)
          const migrationSql = readFileSync(migrationPath, 'utf8')
          const statements = migrationSql.split('--> statement-breakpoint')

          for (const statement of statements) {
            const cleanStatement = statement.trim()
            if (cleanStatement && !cleanStatement.startsWith('--')) {
              sqlite.exec(cleanStatement)
            }
          }
          console.log(`✅ Database tables created successfully using ${migrationFile}`)
          migrationExecuted = true
          break
        } catch (migrationError) {
          // Continue to next migration file
          continue
        }
      }
      
      if (!migrationExecuted) {
        console.warn('⚠️ Could not read any migration files, tables might need manual creation')
      }
    }
  }
} catch (error) {
  console.warn('⚠️ Database initialization warning:', error)
}

// Create Drizzle instance with schema
export const db: ReturnType<typeof drizzle> = drizzle(sqlite, {
  schema,
  logger: process.env.NODE_ENV === 'development'
})

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

// Export types for external usage
export type DrizzleDb = typeof db
export type DatabaseConnection = typeof sqlite
export type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
