/**
 * Drizzle Migration Runner
 * Creates tables and indexes for optimal performance
 */

import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db, rawDb } from '../db'

/**
 * Run all pending migrations
 */
export async function runMigrations() {
  try {
    console.log('Running Drizzle migrations...')
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('✅ Migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

/**
 * Create initial schema if tables don't exist
 */
export async function createInitialSchema() {
  console.log('Creating initial Drizzle schema...')

  // The schema creation will be handled by drizzle-kit generate
  // This is a placeholder for any custom initialization logic

  try {
    // Run migrations to create tables
    await runMigrations()

    // Verify critical tables exist
    const tables = [
      'projects',
      'tickets',
      'ticket_tasks',
      'chats',
      'chat_messages',
      'prompts',
      'queues',
      'queue_items',
      'claude_agents',
      'claude_commands',
      'claude_hooks',
      'provider_keys',
      'files',
      'selected_files',
      'active_tabs'
    ]

    for (const table of tables) {
      const result = rawDb.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)
      if (!result) {
        throw new Error(`Table ${table} was not created`)
      }
    }

    console.log('✅ All tables created successfully')

    // Create any custom indexes for performance
    await createPerformanceIndexes()
  } catch (error) {
    console.error('❌ Schema creation failed:', error)
    throw error
  }
}

/**
 * Create additional performance indexes
 */
async function createPerformanceIndexes() {
  const indexes = [
    // Composite indexes for common query patterns
    'CREATE INDEX IF NOT EXISTS idx_tickets_project_status ON tickets(project_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_tickets_project_priority ON tickets(project_id, priority)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_ticket_done ON ticket_tasks(ticket_id, done)',
    'CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON chat_messages(chat_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_queue_items_queue_status ON queue_items(queue_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_files_project_relevant ON files(project_id, is_relevant)'

    // Full-text search indexes (if needed)
    // 'CREATE VIRTUAL TABLE IF NOT EXISTS fts_tickets USING fts5(title, overview, content=tickets)',
    // 'CREATE VIRTUAL TABLE IF NOT EXISTS fts_prompts USING fts5(title, content, description, content=prompts)',
  ]

  for (const indexSql of indexes) {
    try {
      rawDb.exec(indexSql)
      console.log(`✅ Created index: ${indexSql.split(' ')[5]}`)
    } catch (error) {
      console.warn(`⚠️ Index creation failed: ${indexSql}`, error)
    }
  }
}

/**
 * Generate unique ID for new records
 */
export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}
