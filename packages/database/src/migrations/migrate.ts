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
    console.error('Running Drizzle migrations...')

    // Resolve the migrations directory robustly (independent of process.cwd)
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const migrationsPath = path.resolve(__dirname, '../../drizzle')

    // If baseline tables already exist (from bootstrap), seed migrations journal
    await seedBaselineIfAlreadyBootstrapped(migrationsPath)

    // Run migrator but don't abort the whole startup on idempotency errors.
    try {
      await migrate(db, { migrationsFolder: migrationsPath })
    } catch (e: any) {
      const msg = String(e?.message || e)
      // Common drizzle/sqlite idempotency errors we can safely ignore to continue upgrades
      const isIdempotencyIssue = /already exists|duplicate column|duplicate key/i.test(msg)
      if (isIdempotencyIssue) {
        console.warn('⚠️ Migrator reported idempotency issue; proceeding with safety upgrades:', msg)
      } else {
        // Re-throw unknown/critical migration errors
        throw e
      }
    }

    // After migrator, defensively ensure any base tables and indexes are present
    await ensureMissingTablesFromBase(migrationsPath)

    // Ensure critical model configuration tables exist (defensive fallback)
    await ensureModelConfigTables()

    // Apply safety fixes for existing databases that predate new columns
    await ensureSchemaUpgrades()
    console.error('✅ Migrations completed successfully')
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

/**
 * Create initial schema if tables don't exist
 */
export async function createInitialSchema() {
  console.error('Creating initial Drizzle schema...')

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
      'chat_streams',
      'chat_stream_events',
      'prompts',
      'queues',
      'queue_items',
      'provider_keys',
      'files',
      'selected_files'
    ]

    for (const table of tables) {
      const result = rawDb.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)
      if (!result) {
        throw new Error(`Table ${table} was not created`)
      }
    }

    console.error('✅ All tables created successfully')

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
    'CREATE INDEX IF NOT EXISTS idx_files_project_relevant ON files(project_id, is_relevant)',
    'CREATE INDEX IF NOT EXISTS idx_chat_streams_chat_started ON chat_streams(chat_id, started_at)',
    'CREATE INDEX IF NOT EXISTS idx_chat_stream_events_stream_seq ON chat_stream_events(stream_id, seq)',
    'CREATE INDEX IF NOT EXISTS idx_chat_stream_events_type ON chat_stream_events(type)'

    // Full-text search indexes (if needed)
    // 'CREATE VIRTUAL TABLE IF NOT EXISTS fts_tickets USING fts5(title, overview, content=tickets)',
    // 'CREATE VIRTUAL TABLE IF NOT EXISTS fts_prompts USING fts5(title, content, description, content=prompts)',
  ]

  for (const indexSql of indexes) {
    try {
      rawDb.exec(indexSql)
      console.error(`✅ Created index: ${indexSql.split(' ')[5]}`)
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
      const rows = rawDb.query(`PRAGMA table_info(${table})`).all() as { name: string }[]
      return rows.some((r) => r.name === column)
    }

    // Helper: check if an index exists
    const hasIndex = (table: string, indexName: string): boolean => {
      const rows = rawDb.query(`PRAGMA index_list(${table})`).all() as { name: string }[]
      return rows.some((r) => r.name === indexName)
    }

    // Helper: check if a table exists
    const tableExists = (table: string): boolean => {
      const res = rawDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table) as
        | { name?: string }
        | undefined
      return !!res?.name
    }

    if (!tableExists('chat_streams')) {
      try {
        rawDb.exec(`CREATE TABLE \`chat_streams\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT,
  \`chat_id\` integer NOT NULL,
  \`direction\` text NOT NULL,
  \`provider\` text NOT NULL,
  \`model\` text NOT NULL,
  \`started_at\` integer NOT NULL,
  \`finished_at\` integer,
  \`finish_reason\` text,
  \`usage_json\` text,
  \`message_metadata_json\` text,
  \`format\` text NOT NULL DEFAULT 'ui',
  \`version\` integer NOT NULL DEFAULT 1,
  \`assistant_message_id\` integer,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL,
  FOREIGN KEY (\`chat_id\`) REFERENCES \`chats\`(\`id\`) ON DELETE cascade,
  FOREIGN KEY (\`assistant_message_id\`) REFERENCES \`chat_messages\`(\`id\`) ON DELETE set null
)`)
        rawDb.exec('CREATE INDEX IF NOT EXISTS `idx_chat_streams_chat_started` ON `chat_streams` (`chat_id`, `started_at`)')
      } catch (e) {
        console.warn('⚠️ Failed to ensure chat_streams table:', e)
      }
    }

    if (!tableExists('chat_stream_events')) {
      try {
        rawDb.exec(`CREATE TABLE \`chat_stream_events\` (
  \`id\` integer PRIMARY KEY AUTOINCREMENT,
  \`stream_id\` integer NOT NULL,
  \`seq\` integer NOT NULL,
  \`ts\` integer NOT NULL,
  \`type\` text NOT NULL,
  \`payload\` text,
  FOREIGN KEY (\`stream_id\`) REFERENCES \`chat_streams\`(\`id\`) ON DELETE cascade
)`)
        rawDb.exec('CREATE INDEX IF NOT EXISTS `idx_chat_stream_events_stream_seq` ON `chat_stream_events` (`stream_id`, `seq`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS `idx_chat_stream_events_type` ON `chat_stream_events` (`type`)')
      } catch (e) {
        console.warn('⚠️ Failed to ensure chat_stream_events table:', e)
      }
    }

    // Ensure new file columns added after initial deployments
    const fileColumns: Array<{ name: string; ddl: string }> = [
      { name: 'content', ddl: 'ALTER TABLE `files` ADD `content` text' },
      { name: 'meta', ddl: 'ALTER TABLE `files` ADD `meta` text' },
      { name: 'checksum', ddl: 'ALTER TABLE `files` ADD `checksum` text' },
      { name: 'imports', ddl: 'ALTER TABLE `files` ADD `imports` text' },
      { name: 'exports', ddl: 'ALTER TABLE `files` ADD `exports` text' },
      { name: 'extension', ddl: 'ALTER TABLE `files` ADD `extension` text' }
    ]

    for (const col of fileColumns) {
      if (!hasColumn('files', col.name)) {
        try {
          rawDb.exec(col.ddl)
          console.error(`✅ Added missing column files.${col.name}`)
        } catch (e) {
          console.warn(`⚠️ Failed to add column files.${col.name}:`, e)
        }
      }
    }

    // Ensure provider_keys columns that may not exist on older DBs
    if (!hasColumn('provider_keys', 'secret_ref')) {
      try {
        rawDb.exec('ALTER TABLE `provider_keys` ADD `secret_ref` text')
        console.error('✅ Added missing column provider_keys.secret_ref')
      } catch (e) {
        console.warn('⚠️ Failed to add column provider_keys.secret_ref:', e)
      }
    }

    // Ensure indexes that may not exist on older DBs
    if (!hasIndex('files', 'files_extension_idx')) {
      try {
        rawDb.exec('CREATE INDEX IF NOT EXISTS `files_extension_idx` ON `files` (`extension`)')
        console.error('✅ Created index files_extension_idx')
      } catch (e) {
        console.warn('⚠️ Failed to create index files_extension_idx:', e)
      }
    }

    if (!hasColumn('crawled_content', 'crawl_session_id')) {
      try {
        console.error('🔧 Upgrading crawled_content table to include crawl session metadata')
        rawDb.exec('PRAGMA foreign_keys=off')
        rawDb.exec('BEGIN TRANSACTION')
        rawDb.exec(`CREATE TABLE "crawled_content_new" (
  "id" integer PRIMARY KEY NOT NULL,
  "url_id" integer NOT NULL,
  "research_source_id" integer,
  "depth" integer,
  "title" text,
  "clean_content" text,
  "raw_html" text,
  "summary" text,
  "metadata" text DEFAULT '{}',
  "links" text DEFAULT '[]',
  "crawl_session_id" text,
  "crawled_at" integer NOT NULL,
  FOREIGN KEY ("url_id") REFERENCES "urls"("id") ON DELETE cascade,
  FOREIGN KEY ("research_source_id") REFERENCES "research_sources"("id") ON DELETE set null
)`)
        rawDb.exec(`INSERT INTO "crawled_content_new" (
  "id",
  "url_id",
  "research_source_id",
  "depth",
  "title",
  "clean_content",
  "raw_html",
  "summary",
  "metadata",
  "links",
  "crawl_session_id",
  "crawled_at"
) SELECT
  "id",
  "url_id",
  NULL,
  NULL,
  "title",
  "clean_content",
  "raw_html",
  "summary",
  COALESCE("metadata", '{}'),
  COALESCE("links", '[]'),
  NULL,
  "crawled_at"
FROM "crawled_content"`)
        rawDb.exec('DROP TABLE `crawled_content`')
        rawDb.exec('ALTER TABLE `crawled_content_new` RENAME TO `crawled_content`')
        rawDb.exec('CREATE INDEX IF NOT EXISTS `crawled_content_url_idx` ON `crawled_content`(`url_id`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS `crawled_content_research_source_idx` ON `crawled_content`(`research_source_id`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS `crawled_content_crawl_session_idx` ON `crawled_content`(`crawl_session_id`)')
        rawDb.exec('COMMIT')
        console.error('✅ Upgraded crawled_content table')
      } catch (e) {
        console.warn('⚠️ Failed to upgrade crawled_content table:', e)
        rawDb.exec('ROLLBACK')
      } finally {
        rawDb.exec('PRAGMA foreign_keys=on')
      }
    }

    // Ensure chats.project_id is nullable (decouple chats from projects)
    try {
      const chatCols = rawDb.query(`PRAGMA table_info(chats)`).all() as Array<{ name: string; notnull: number }>
      const projectCol = chatCols.find((c) => c.name === 'project_id')
      if (projectCol && projectCol.notnull === 1) {
        console.error('🔧 Updating chats.project_id to be NULLABLE (decouple from projects)')
        rawDb.exec('PRAGMA foreign_keys=off')
        rawDb.exec('BEGIN TRANSACTION')
        rawDb.exec(
          'CREATE TABLE `chats_new` (\n' +
          '  `id` integer PRIMARY KEY,\n' +
          '  `project_id` integer,\n' +
          '  `title` text NOT NULL,\n' +
          '  `created_at` integer NOT NULL,\n' +
          '  `updated_at` integer NOT NULL,\n' +
          '  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade\n' +
          ')'
        )
        rawDb.exec(
          'INSERT INTO `chats_new` (`id`, `project_id`, `title`, `created_at`, `updated_at`) ' +
          'SELECT `id`, `project_id`, `title`, `created_at`, `updated_at` FROM `chats`'
        )
        rawDb.exec('DROP TABLE `chats`')
        rawDb.exec('ALTER TABLE `chats_new` RENAME TO `chats`')
        rawDb.exec('CREATE INDEX IF NOT EXISTS `chats_project_idx` ON `chats` (`project_id`)')
        rawDb.exec('COMMIT')
        rawDb.exec('PRAGMA foreign_keys=on')
        console.error('✅ chats.project_id is now nullable')
      }
    } catch (e) {
      console.warn('⚠️ Failed to ensure chats.project_id nullability:', e)
    }

    // Ensure research_records.project_id is nullable (decouple research from projects)
    try {
      const researchCols = rawDb.query(`PRAGMA table_info(research_records)`).all() as Array<{
        name: string
        notnull: number
      }>
      const researchProjectCol = researchCols.find((c) => c.name === 'project_id')
      if (researchProjectCol && researchProjectCol.notnull === 1) {
        console.error('🔧 Updating research_records.project_id to be NULLABLE (decouple from projects)')
        rawDb.exec('PRAGMA foreign_keys=off')
        rawDb.exec('BEGIN TRANSACTION')
        rawDb.exec(
          'CREATE TABLE `research_records_new` (\n' +
          '  `id` integer PRIMARY KEY NOT NULL,\n' +
          '  `project_id` integer,\n' +
          '  `topic` text NOT NULL,\n' +
          '  `description` text,\n' +
          '  `status` text DEFAULT \'initializing\' NOT NULL,\n' +
          '  `total_sources` integer DEFAULT 0,\n' +
          '  `processed_sources` integer DEFAULT 0,\n' +
          '  `sections_total` integer DEFAULT 0,\n' +
          '  `sections_completed` integer DEFAULT 0,\n' +
          '  `max_sources` integer DEFAULT 10,\n' +
          '  `max_depth` integer DEFAULT 3,\n' +
          '  `strategy` text DEFAULT \'balanced\' NOT NULL,\n' +
          '  `metadata` text DEFAULT \'{}\',\n' +
          '  `created_at` integer NOT NULL,\n' +
          '  `updated_at` integer NOT NULL,\n' +
          '  `completed_at` integer,\n' +
          '  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade\n' +
          ')'
        )
        rawDb.exec(
          'INSERT INTO `research_records_new` ' +
          '(`id`, `project_id`, `topic`, `description`, `status`, `total_sources`, `processed_sources`, ' +
          '`sections_total`, `sections_completed`, `max_sources`, `max_depth`, `strategy`, `metadata`, ' +
          '`created_at`, `updated_at`, `completed_at`) ' +
          'SELECT `id`, `project_id`, `topic`, `description`, `status`, `total_sources`, `processed_sources`, ' +
          '`sections_total`, `sections_completed`, `max_sources`, `max_depth`, `strategy`, `metadata`, ' +
          '`created_at`, `updated_at`, `completed_at` FROM `research_records`'
        )
        rawDb.exec('DROP TABLE `research_records`')
        rawDb.exec('ALTER TABLE `research_records_new` RENAME TO `research_records`')
        rawDb.exec('COMMIT')
        rawDb.exec('PRAGMA foreign_keys=on')
        console.error('✅ research_records.project_id is now nullable')
      }
    } catch (e) {
      console.warn('⚠️ Failed to ensure research_records.project_id nullability:', e)
    }

    if (!hasIndex('files', 'files_checksum_idx')) {
      try {
        rawDb.exec('CREATE INDEX IF NOT EXISTS `files_checksum_idx` ON `files` (`checksum`)')
        console.error('✅ Created index files_checksum_idx')
      } catch (e) {
        console.warn('⚠️ Failed to create index files_checksum_idx:', e)
      }
    }

    // Ensure unique index for process_ports(project_id, port) to support upsert
    try {
      const portsIndex = rawDb
        .query("SELECT name FROM sqlite_master WHERE type='index' AND name=?")
        .get('process_ports_project_port_unique') as { name?: string } | undefined
      if (!portsIndex?.name) {
        rawDb.exec(
          'CREATE UNIQUE INDEX IF NOT EXISTS `process_ports_project_port_unique` ON `process_ports` (`project_id`, `port`)'
        )
        console.error('✅ Created unique index process_ports_project_port_unique')
      }
    } catch (e) {
      console.warn('⚠️ Failed to ensure unique index on process_ports(project_id, port):', e)
    }

    // Drop legacy tab tables (tabs are frontend-only now)
    if (tableExists('active_tabs')) {
      try {
        rawDb.exec('DROP TABLE IF EXISTS `active_tabs`')
        console.error('🧹 Dropped legacy table active_tabs')
      } catch (e) {
        console.warn('⚠️ Failed to drop legacy table active_tabs:', e)
      }
    }
    if (tableExists('project_tab_state')) {
      try {
        rawDb.exec('DROP TABLE IF EXISTS `project_tab_state`')
        console.error('🧹 Dropped legacy table project_tab_state')
      } catch (e) {
        console.warn('⚠️ Failed to drop legacy table project_tab_state:', e)
      }
    }

    if (!tableExists('research_source_links')) {
      try {
        rawDb.exec(`CREATE TABLE IF NOT EXISTS "research_source_links" (
  "id" integer PRIMARY KEY AUTOINCREMENT,
  "source_id" integer NOT NULL,
  "url" text NOT NULL,
  "title" text,
  "status" text NOT NULL DEFAULT 'pending',
  "depth" integer,
  "parent_url" text,
  "relevance_score" real,
  "token_count" integer,
  "discovered_at" integer NOT NULL,
  "crawl_session_id" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("source_id") REFERENCES "research_sources"("id") ON DELETE cascade
)`)
        rawDb.exec(
          'CREATE UNIQUE INDEX IF NOT EXISTS `research_source_links_source_url_idx` ON `research_source_links` (`source_id`, `url`)'
        )
        rawDb.exec(
          'CREATE INDEX IF NOT EXISTS `research_source_links_source_discovered_idx` ON `research_source_links` (`source_id`, `discovered_at` DESC)'
        )
        console.error('✅ Ensured research_source_links table exists')
      } catch (e) {
        console.warn('⚠️ Failed to ensure research_source_links table:', e)
      }
    }
  } catch (e) {
    console.warn('⚠️ ensureSchemaUpgrades() encountered an issue:', e)
  }
}

/**
 * Ensure any tables defined in 0000_base.sql exist even if the migrator
 * did not apply the base due to existing core tables.
 */
async function ensureMissingTablesFromBase(migrationsPath: string) {
  try {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const baseSqlPath = path.join(migrationsPath, '0000_base.sql')
    const migrationSql = fs.readFileSync(baseSqlPath, 'utf8')
    const statements = migrationSql.split('--> statement-breakpoint')

    const createTableRe = /^CREATE\s+TABLE\s+`?(\w+)`?\s*\(/i
    const createIndexRe = /^CREATE\s+INDEX\s+`?(\w+)`?\s+ON\s+`?(\w+)`?/i

    const tableExists = (name: string) =>
      (
        rawDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) as
        | { name?: string }
        | undefined
      )?.name === name

    const indexExists = (name: string) =>
      (
        rawDb.query("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get(name) as
        | { name?: string }
        | undefined
      )?.name === name

    const toRun: string[] = []
    const newlyCreatedTables: Set<string> = new Set()

    for (const stmt of statements.map((s) => s.trim()).filter(Boolean)) {
      const m = stmt.match(createTableRe)
      if (m) {
        const table = m[1] as string
        if (!tableExists(table)) {
          toRun.push(stmt)
          newlyCreatedTables.add(table)
        }
      }
    }

    // Execute missing CREATE TABLE statements first
    for (const sql of toRun) {
      try {
        rawDb.exec(sql)
      } catch (e) {
        console.warn('⚠️ Failed creating table from base:', e)
      }
    }

    // Create indexes for newly created tables if missing
    for (const stmt of statements.map((s) => s.trim()).filter(Boolean)) {
      const mi = stmt.match(createIndexRe)
      if (!mi) continue
      const indexName = mi[1] as string
      const tableName = mi[2] as string
      if (!newlyCreatedTables.has(tableName)) continue
      if (indexExists(indexName)) continue
      try {
        rawDb.exec(stmt)
      } catch (e) {
        console.warn(`⚠️ Failed creating index ${indexName}:`, e)
      }
    }
  } catch (e) {
    console.warn('⚠️ ensureMissingTablesFromBase() encountered an issue:', e)
  }
}

/**
 * Defensive fallback: explicitly create model configuration tables if missing.
 * This covers edge cases where the migrator/journal baseline prevented the
 * base migration from running and our generic filler missed these tables.
 */
async function ensureModelConfigTables() {
  try {
    const tableExists = (name: string) =>
      (
        rawDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) as
        | { name?: string }
        | undefined
      )?.name === name

    // Create model_configs first (referenced by model_presets)
    if (!tableExists('model_configs')) {
      try {
        rawDb.exec(`CREATE TABLE \`model_configs\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`display_name\` text,
  \`provider\` text NOT NULL,
  \`model\` text NOT NULL,
  \`temperature\` real DEFAULT 0.7,
  \`max_tokens\` integer DEFAULT 4096,
  \`top_p\` real DEFAULT 1,
  \`top_k\` integer DEFAULT 0,
  \`frequency_penalty\` real DEFAULT 0,
  \`presence_penalty\` real DEFAULT 0,
  \`response_format\` text,
  \`system_prompt\` text,
  \`is_system_preset\` integer DEFAULT false NOT NULL,
  \`is_default\` integer DEFAULT false NOT NULL,
  \`is_active\` integer DEFAULT true NOT NULL,
  \`user_id\` integer,
  \`description\` text,
  \`preset_category\` text,
  \`ui_icon\` text,
  \`ui_color\` text,
  \`ui_order\` integer DEFAULT 0,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL
)`)
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_configs_name_idx\` ON \`model_configs\` (\`name\`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_configs_provider_idx\` ON \`model_configs\` (\`provider\`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_configs_is_default_idx\` ON \`model_configs\` (\`is_default\`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_configs_user_idx\` ON \`model_configs\` (\`user_id\`)')
        console.error('✅ Ensured table model_configs')
      } catch (e) {
        console.warn('⚠️ Failed to ensure model_configs:', e)
      }
    }

    // Then create model_presets
    if (!tableExists('model_presets')) {
      try {
        rawDb.exec(`CREATE TABLE \`model_presets\` (
  \`id\` integer PRIMARY KEY NOT NULL,
  \`name\` text NOT NULL,
  \`description\` text,
  \`config_id\` integer NOT NULL,
  \`category\` text DEFAULT 'general',
  \`is_system_preset\` integer DEFAULT false NOT NULL,
  \`is_active\` integer DEFAULT true NOT NULL,
  \`user_id\` integer,
  \`usage_count\` integer DEFAULT 0 NOT NULL,
  \`last_used_at\` integer,
  \`metadata\` text,
  \`created_at\` integer NOT NULL,
  \`updated_at\` integer NOT NULL,
  FOREIGN KEY (\`config_id\`) REFERENCES \`model_configs\`(\`id\`) ON UPDATE no action ON DELETE cascade
)`)
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_presets_category_idx\` ON \`model_presets\` (\`category\`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_presets_config_idx\` ON \`model_presets\` (\`config_id\`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_presets_user_idx\` ON \`model_presets\` (\`user_id\`)')
        rawDb.exec('CREATE INDEX IF NOT EXISTS \`model_presets_usage_idx\` ON \`model_presets\` (\`usage_count\`)')
        console.error('✅ Ensured table model_presets')
      } catch (e) {
        console.warn('⚠️ Failed to ensure model_presets:', e)
      }
    }
  } catch (e) {
    console.warn('⚠️ ensureModelConfigTables() encountered an issue:', e)
  }
}

/**
 * If the database was created via bootstrap (not via Drizzle migrator), create the
 * __drizzle_migrations table and insert the baseline entry so future migrations work.
 */
async function seedBaselineIfAlreadyBootstrapped(migrationsPath: string) {
  try {
    const tableExists = (table: string): boolean => {
      const res = rawDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table) as
        | { name?: string }
        | undefined
      return !!res?.name
    }

    // Consider schema bootstrapped if ANY of the base tables already exist.
    // We'll create missing ones afterwards via ensureMissingTablesFromBase().
    const baselineTables = [
      'projects',
      'files',
      'tickets',
      'queues',
      'chat_messages',
      'prompts',
      'provider_keys',
      'selected_files'
    ]
    const hasBaseline = baselineTables.some((t) => tableExists(t))

    // Check if Drizzle journal exists and has entries
    const migrationsTable = '__drizzle_migrations'
    const hasJournal = tableExists(migrationsTable)

    if (hasBaseline) {
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
        // Only insert if the exact hash is not already present
        const existing = rawDb.query(`SELECT 1 FROM __drizzle_migrations WHERE hash = ? LIMIT 1`).get(hash) as
          | { 1?: number }
          | undefined
        if (!existing) {
          rawDb.exec(`INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('${hash}', ${when})`)
          console.error('✅ Seeded __drizzle_migrations with baseline entry')
        }
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
  console.error('📋 Creating database tables...')
  createInitialSchema()
    .then(() => {
      console.error('✅ Database migration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Database migration failed:', error)
      process.exit(1)
    })
}
