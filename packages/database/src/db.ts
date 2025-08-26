/**
 * Drizzle Database Connection - Performance Optimized
 * Replaces DatabaseManager with optimized SQLite connection
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { Database } from 'bun:sqlite'
import * as schema from './schema'
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
    // For tests, skip migration file reading and just use drizzle to create tables
    if (process.env.NODE_ENV === 'test') {
      console.log('📋 Creating test database tables in memory...')
      // Skip migration file for tests - tables will be created as needed
    } else {
      console.log('📋 Creating database tables...')
      // Read and execute the migration SQL
      const migrationPath = join(process.cwd(), 'packages', 'database', 'drizzle', '0000_loose_bug.sql')
      try {
        const migrationSql = readFileSync(migrationPath, 'utf8')
        const statements = migrationSql.split('--> statement-breakpoint')

        for (const statement of statements) {
          const cleanStatement = statement.trim()
          if (cleanStatement && !cleanStatement.startsWith('--')) {
            sqlite.exec(cleanStatement)
          }
        }
        console.log('✅ Database tables created successfully')
      } catch (migrationError) {
        console.warn('⚠️ Could not read migration file, tables might need manual creation')
      }
    }
  }
} catch (error) {
  console.warn('⚠️ Database initialization warning:', error)
}

// Create Drizzle instance with schema
export const db = drizzle(sqlite, {
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
