/**
 * Drizzle Migration Runner
 * Creates tables and indexes for optimal performance
 */

import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db, rawDb } from '../db'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/**
 * Run all pending migrations
 */
export async function runMigrations() {
  try {
    console.log('Running Drizzle migrations...')

    // Resolve the migrations directory robustly (independent of process.cwd)
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const migrationsPath = path.resolve(__dirname, '../../drizzle')

    // If baseline tables already exist (from bootstrap), seed migrations journal
    await seedBaselineIfAlreadyBootstrapped(migrationsPath)

    await migrate(db, { migrationsFolder: migrationsPath })

    // Apply safety fixes for existing databases that predate new columns
    await ensureSchemaUpgrades()
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
 * Ensure newer columns/indexes exist on older databases where a previously applied
 * base migration file wouldn't be re-run by Drizzle. This keeps runtime stable
 * even if a user upgrades without reinitializing their DB.
 */
async function ensureSchemaUpgrades() {
  try {
    // Helper: check if a column exists on a table
    const hasColumn = (table: string, column: string): boolean => {
      const rows = rawDb
        .query(`PRAGMA table_info(${table})`)
        .all() as { name: string }[]
      return rows.some((r) => r.name === column)
    }

    // Helper: check if an index exists
    const hasIndex = (indexName: string): boolean => {
      const rows = rawDb
        .query(`PRAGMA index_list('files')`)
        .all() as { name: string }[]
      return rows.some((r) => r.name === indexName)
    }

    // Ensure new file columns added after initial deployments
    const fileColumns: Array<{ name: string; ddl: string }> = [
      { name: 'content', ddl: "ALTER TABLE `files` ADD `content` text" },
      { name: 'summary_last_updated', ddl: "ALTER TABLE `files` ADD `summary_last_updated` integer" },
      { name: 'meta', ddl: "ALTER TABLE `files` ADD `meta` text" },
      { name: 'checksum', ddl: "ALTER TABLE `files` ADD `checksum` text" },
      { name: 'imports', ddl: "ALTER TABLE `files` ADD `imports` text" },
      { name: 'exports', ddl: "ALTER TABLE `files` ADD `exports` text" },
      { name: 'extension', ddl: "ALTER TABLE `files` ADD `extension` text" }
    ]

    for (const col of fileColumns) {
      if (!hasColumn('files', col.name)) {
        try {
          rawDb.exec(col.ddl)
          console.log(`✅ Added missing column files.${col.name}`)
        } catch (e) {
          console.warn(`⚠️ Failed to add column files.${col.name}:`, e)
        }
      }
    }

    // Ensure provider_keys columns that may not exist on older DBs
    if (!hasColumn('provider_keys', 'secret_ref')) {
      try {
        rawDb.exec("ALTER TABLE `provider_keys` ADD `secret_ref` text")
        console.log('✅ Added missing column provider_keys.secret_ref')
      } catch (e) {
        console.warn('⚠️ Failed to add column provider_keys.secret_ref:', e)
      }
    }

    // Ensure indexes that may not exist on older DBs
    if (!hasIndex('files_extension_idx')) {
      try {
        rawDb.exec('CREATE INDEX IF NOT EXISTS `files_extension_idx` ON `files` (`extension`)')
        console.log('✅ Created index files_extension_idx')
      } catch (e) {
        console.warn('⚠️ Failed to create index files_extension_idx:', e)
      }
    }

    if (!hasIndex('files_checksum_idx')) {
      try {
        rawDb.exec('CREATE INDEX IF NOT EXISTS `files_checksum_idx` ON `files` (`checksum`)')
        console.log('✅ Created index files_checksum_idx')
      } catch (e) {
        console.warn('⚠️ Failed to create index files_checksum_idx:', e)
      }
    }
  } catch (e) {
    console.warn('⚠️ ensureSchemaUpgrades() encountered an issue:', e)
  }
}

/**
 * If the database was created via bootstrap (not via Drizzle migrator), create the
 * __drizzle_migrations table and insert the baseline entry so future migrations work.
 */
async function seedBaselineIfAlreadyBootstrapped(migrationsPath: string) {
  try {
    const tableExists = (table: string): boolean => {
      const res = rawDb
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?")
        .get(table) as { name?: string } | undefined
      return !!res?.name
    }

    const baselineTables = ['projects', 'files', 'active_tabs']
    const hasBaseline = baselineTables.every((t) => tableExists(t))

    // Check if Drizzle journal exists and has entries
    const migrationsTable = '__drizzle_migrations'
    const hasJournal = tableExists(migrationsTable)
    let hasEntries = false
    if (hasJournal) {
      try {
        const row = rawDb
          .query(`SELECT id FROM ${migrationsTable} ORDER BY created_at DESC LIMIT 1`)
          .get() as { id?: number } | undefined
        hasEntries = !!row?.id
      } catch {
        // ignore
      }
    }

    if (hasBaseline && (!hasJournal || !hasEntries)) {
      // Create journal table if missing
      try {
        rawDb.exec(
          'CREATE TABLE IF NOT EXISTS __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric)'
        )
      } catch (e) {
        console.warn('⚠️ Failed to ensure __drizzle_migrations table exists:', e)
      }

      // Read base migration metadata and compute hash
      const meta = await import('node:fs/promises')
      const metaJsonPath = path.join(migrationsPath, 'meta', '_journal.json')
      const baseSqlPath = path.join(migrationsPath, '0000_base.sql')
      const [journalStr, sqlStr] = await Promise.all([
        meta.readFile(metaJsonPath, 'utf8'),
        meta.readFile(baseSqlPath, 'utf8')
      ])
      const journal = JSON.parse(journalStr) as {
        entries: { idx: number; when: number; tag: string; breakpoints: boolean }[]
      }
      const baseEntry = journal.entries.find((e) => e.tag === '0000_base') ?? journal.entries[0]
      const when = baseEntry?.when ?? Date.now()

      // Compute SHA256 hash of SQL like drizzle-kit does
      const { createHash } = await import('node:crypto')
      const hash = createHash('sha256').update(sqlStr).digest('hex')

      try {
        rawDb.exec(
          `INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('${hash}', ${when})`
        )
        console.log('✅ Seeded __drizzle_migrations with baseline entry')
      } catch (e) {
        // If unique constraints or similar, ignore
        console.warn('⚠️ Failed to seed __drizzle_migrations baseline entry:', e)
      }
    }
  } catch (e) {
    console.warn('⚠️ seedBaselineIfAlreadyBootstrapped() encountered an issue:', e)
  }
}

/**
 * Generate unique ID for new records
 */
export function generateId(): number {
  return Date.now() + Math.floor(Math.random() * 1000)
}

// Run migrations when executed directly
if (import.meta.main) {
  console.log('📋 Creating database tables...')
  createInitialSchema()
    .then(() => {
      console.log('✅ Database migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Database migration failed:', error)
      process.exit(1)
    })
}
