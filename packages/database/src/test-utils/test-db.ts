/**
 * Test Database Factory
 * 
 * Creates isolated in-memory SQLite databases for testing with proper schema initialization.
 * Ensures all tables are created without requiring external migration files.
 * 
 * Benefits:
 * - Proper schema creation in test environment
 * - Fast in-memory database for tests
 * - Isolated test databases per test suite
 * - No external file dependencies
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as mainSchema from '../schema'
import * as mcpSchema from '../schema/mcp-executions'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import path from 'path'

const schema = { ...mainSchema, ...mcpSchema }

/**
 * Test database configuration interface
 */
interface TestDbConfig {
  /** Unique identifier for this test database */
  testId?: string
  /** Whether to enable verbose logging */
  verbose?: boolean
  /** Whether to seed with basic test data */
  seedData?: boolean
}

/**
 * Test database instance
 */
export interface TestDatabase {
  /** Drizzle database instance */
  db: ReturnType<typeof drizzle>
  /** Raw SQLite instance */
  rawDb: Database
  /** Close and cleanup the database */
  close: () => void
  /** Reset all tables (delete all data) */
  reset: () => Promise<void>
  /** Get database statistics */
  getStats: () => {
    tables: string[]
    totalRecords: number
  }
}

/**
 * Create a test database instance with proper schema initialization
 */
export function createTestDatabase(config: TestDbConfig = {}): TestDatabase {
  const { testId = 'test', verbose = false, seedData = false } = config

  console.log(`[TEST DB ENTRY] Creating test database: ${testId}`)
  if (verbose) {
    console.log(`[TEST DB] Creating test database: ${testId}`)
  }

  // Create in-memory SQLite database
  const rawDb = new Database(':memory:', {
    create: true,
    strict: true
  })

  // Configure SQLite for test performance
  rawDb.exec('PRAGMA journal_mode = MEMORY') // Memory journal for tests
  rawDb.exec('PRAGMA synchronous = OFF') // Disable sync for speed
  rawDb.exec('PRAGMA cache_size = 10000') // Smaller cache for tests
  rawDb.exec('PRAGMA foreign_keys = ON') // Enable foreign key constraints
  rawDb.exec('PRAGMA temp_store = MEMORY')

  // Create Drizzle instance
  const db = drizzle(rawDb, {
    schema,
    logger: verbose
  })

  // Create all schema tables manually (bypassing migration files)
  createSchemaTable(rawDb, verbose)

  // Seed with basic test data if requested
  if (seedData) {
    seedTestData(db, verbose)
  }

  return {
    db,
    rawDb,
    close: () => {
      if (verbose) {
        console.log(`[TEST DB] Closing test database: ${testId}`)
      }
      rawDb.close()
    },
    reset: async () => {
      if (verbose) {
        console.log(`[TEST DB] Resetting test database: ${testId}`)
      }
      await resetAllTables(db)
    },
    getStats: () => {
      const tables = rawDb
        .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[]

      let totalRecords = 0
      for (const table of tables) {
        const count = rawDb.query(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number }
        totalRecords += count.count
      }

      return {
        tables: tables.map(t => t.name),
        totalRecords
      }
    }
  }
}

/**
 * Run migrations on the test database
 */
async function runMigrations(db: ReturnType<typeof drizzle>, rawDb: Database, verbose: boolean) {
  if (verbose) {
    console.log('[TEST DB] Running migrations...')
  }

  try {
    // Find the migrations directory
    const migrationsPath = path.resolve(__dirname, '../../drizzle')
    
    if (verbose) {
      console.log('[TEST DB] Migrations path:', migrationsPath)
    }
    
    // Run all migrations
    await migrate(db, { migrationsFolder: migrationsPath })
    
    if (verbose) {
      // Check what tables were created
      const tables = rawDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]
      console.log(`[TEST DB] Migration complete. Created ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`)
    }
  } catch (error) {
    console.error('[TEST DB] Migration failed:', error)
    throw error
  }
}

/**
 * Create all schema tables manually without migration files (LEGACY - replaced by runMigrations)
 */
function createSchemaTable(rawDb: Database, verbose: boolean) {
  const statements = [
    // Projects table
    `CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    
    // Tickets table  
    `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      overview TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed')),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
      suggested_file_ids TEXT NOT NULL DEFAULT '[]',
      suggested_agent_ids TEXT NOT NULL DEFAULT '[]',
      suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
      queue_id INTEGER REFERENCES queues(id) ON DELETE SET NULL,
      queue_position INTEGER,
      queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
      queue_priority INTEGER,
      queued_at INTEGER,
      queue_started_at INTEGER,
      queue_completed_at INTEGER,
      queue_agent_id TEXT,
      queue_error_message TEXT,
      estimated_processing_time INTEGER,
      actual_processing_time INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Ticket tasks table
    `CREATE TABLE IF NOT EXISTS ticket_tasks (
      id INTEGER PRIMARY KEY,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      description TEXT,
      suggested_file_ids TEXT NOT NULL DEFAULT '[]',
      done INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
      order_index INTEGER NOT NULL DEFAULT 0,
      estimated_hours REAL,
      dependencies TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      agent_id TEXT,
      suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
      queue_id INTEGER REFERENCES queues(id) ON DELETE SET NULL,
      queue_position INTEGER,
      queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
      queue_priority INTEGER,
      queued_at INTEGER,
      queue_started_at INTEGER,
      queue_completed_at INTEGER,
      queue_agent_id TEXT,
      queue_error_message TEXT,
      estimated_processing_time INTEGER,
      actual_processing_time INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Chats table
    `CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Chat messages table
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )`,

    // Prompts table
    `CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Queues table
    `CREATE TABLE IF NOT EXISTS queues (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      max_parallel_items INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Queue items table
    `CREATE TABLE IF NOT EXISTS queue_items (
      id INTEGER PRIMARY KEY,
      queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK (item_type IN ('ticket', 'task', 'chat', 'prompt')),
      item_id INTEGER NOT NULL,
      priority INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
      agent_id TEXT,
      error_message TEXT,
      estimated_processing_time INTEGER,
      actual_processing_time INTEGER,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Claude agents table
    `CREATE TABLE IF NOT EXISTS claude_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      instructions TEXT,
      model TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Claude commands table
    `CREATE TABLE IF NOT EXISTS claude_commands (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      command TEXT NOT NULL,
      args TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Claude hooks table
    `CREATE TABLE IF NOT EXISTS claude_hooks (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      hook_type TEXT NOT NULL CHECK (hook_type IN ('pre', 'post', 'error')),
      trigger_event TEXT NOT NULL,
      script TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Provider keys table
    `CREATE TABLE IF NOT EXISTS provider_keys (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL,
      key_name TEXT NOT NULL,
      name TEXT,
      encrypted_value TEXT NOT NULL,
      key TEXT,
      encrypted INTEGER NOT NULL DEFAULT 1,
      iv TEXT,
      tag TEXT,
      salt TEXT,
      base_url TEXT,
      custom_headers TEXT DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      environment TEXT NOT NULL DEFAULT 'production',
      description TEXT,
      expires_at INTEGER,
      last_used INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Files table
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      extension TEXT,
      size INTEGER,
      last_modified INTEGER,
      content_type TEXT,
      content TEXT,
      summary TEXT,
      summary_last_updated INTEGER,
      meta TEXT,
      checksum TEXT,
      imports TEXT,
      exports TEXT,
      is_relevant INTEGER DEFAULT 0,
      relevance_score REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,

    // Selected files table
    `CREATE TABLE IF NOT EXISTS selected_files (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      selected_at INTEGER NOT NULL,
      selection_reason TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    )`,

    // Active tabs table
    `CREATE TABLE IF NOT EXISTS active_tabs (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      tab_type TEXT NOT NULL,
      tab_data TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_accessed_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`,

    // MCP executions table (from separate schema)
    `CREATE TABLE IF NOT EXISTS mcp_executions (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      arguments TEXT NOT NULL DEFAULT '{}',
      result TEXT,
      error TEXT,
      duration_ms INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ]

  // Create indices for better performance
  const indices = [
    'CREATE INDEX IF NOT EXISTS projects_path_idx ON projects(path)',
    'CREATE INDEX IF NOT EXISTS projects_name_idx ON projects(name)',
    'CREATE INDEX IF NOT EXISTS tickets_project_idx ON tickets(project_id)',
    'CREATE INDEX IF NOT EXISTS tickets_status_idx ON tickets(status)',
    'CREATE INDEX IF NOT EXISTS tickets_priority_idx ON tickets(priority)',
    'CREATE INDEX IF NOT EXISTS ticket_tasks_ticket_idx ON ticket_tasks(ticket_id)',
    'CREATE INDEX IF NOT EXISTS ticket_tasks_done_idx ON ticket_tasks(done)',
    'CREATE INDEX IF NOT EXISTS chats_project_idx ON chats(project_id)',
    'CREATE INDEX IF NOT EXISTS chat_messages_chat_idx ON chat_messages(chat_id)',
    'CREATE INDEX IF NOT EXISTS prompts_project_idx ON prompts(project_id)',
    'CREATE INDEX IF NOT EXISTS queues_project_idx ON queues(project_id)',
    'CREATE INDEX IF NOT EXISTS queue_items_queue_idx ON queue_items(queue_id)',
    'CREATE INDEX IF NOT EXISTS queue_items_status_idx ON queue_items(status)',
    'CREATE INDEX IF NOT EXISTS files_project_idx ON files(project_id)',
    'CREATE INDEX IF NOT EXISTS files_path_idx ON files(path)',
    'CREATE INDEX IF NOT EXISTS selected_files_project_idx ON selected_files(project_id)',
    'CREATE INDEX IF NOT EXISTS selected_files_file_idx ON selected_files(file_id)',
    'CREATE INDEX IF NOT EXISTS active_tabs_project_idx ON active_tabs(project_id)',
    'CREATE INDEX IF NOT EXISTS mcp_executions_project_idx ON mcp_executions(project_id)',
    'CREATE INDEX IF NOT EXISTS mcp_executions_session_idx ON mcp_executions(session_id)'
  ]

  console.log('[TEST DB] Creating schema tables...')
  if (verbose) {
    console.log('[TEST DB] Creating schema tables with verbose logging...')
  }

  // Execute all create table statements
  for (const statement of statements) {
    try {
      rawDb.exec(statement)
    } catch (error) {
      console.error(`Failed to execute statement: ${statement}`, error)
      throw error
    }
  }

  // Create indices
  for (const index of indices) {
    try {
      rawDb.exec(index)
    } catch (error) {
      console.error(`Failed to create index: ${index}`, error)
      throw error
    }
  }

  if (verbose) {
    const tables = rawDb
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[]
    console.log(`[TEST DB] Created ${tables.length} tables: ${tables.map(t => t.name).join(', ')}`)
  }
}

/**
 * Seed the test database with basic test data
 */
async function seedTestData(db: ReturnType<typeof drizzle>, verbose: boolean) {
  if (verbose) {
    console.log('[TEST DB] Seeding test data...')
  }

  const now = Date.now()

  try {
    // Seed test project
    await db.insert(mainSchema.projects).values({
      id: 1,
      name: 'Test Project',
      path: '/test/project',
      description: 'Seeded test project',
      createdAt: now,
      updatedAt: now
    })

    // Seed test queue
    await db.insert(mainSchema.queues).values({
      id: 1,
      projectId: 1,
      name: 'Test Queue',
      description: 'Seeded test queue',
      maxParallelItems: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now
    })

    // Seed test agent
    await db.insert(mainSchema.claudeAgents).values({
      id: 'test-agent',
      name: 'Test Agent',
      description: 'Seeded test agent',
      instructions: 'Test instructions',
      model: 'claude-3-sonnet',
      isActive: true,
      createdAt: now,
      updatedAt: now
    })

    if (verbose) {
      console.log('[TEST DB] Test data seeded successfully')
    }
  } catch (error) {
    console.error('[TEST DB] Failed to seed test data:', error)
    throw error
  }
}

/**
 * Reset all tables by deleting all data
 */
async function resetAllTables(db: ReturnType<typeof drizzle>) {
  const tableNames = [
    'mcp_executions',
    'active_tabs',
    'selected_files',
    'files',
    'provider_keys',
    'claude_hooks',
    'claude_commands',
    'claude_agents',
    'queue_items',
    'queues',
    'prompts',
    'chat_messages',
    'chats',
    'ticket_tasks',
    'tickets',
    'projects'
  ]

  // Delete in reverse order to respect foreign key constraints
  for (const tableName of tableNames) {
    try {
      await db.run(sql.raw(`DELETE FROM ${tableName}`))
    } catch (error) {
      console.warn(`Failed to clear table ${tableName}:`, error)
    }
  }
}

/**
 * Global test database instance for shared use
 */
let globalTestDb: TestDatabase | null = null

/**
 * Get or create a global test database instance
 */
export function getGlobalTestDb(): TestDatabase {
  if (!globalTestDb) {
    globalTestDb = createTestDatabase({
      testId: 'global',
      verbose: false,
      seedData: true
    })
  }
  return globalTestDb
}

/**
 * Close and reset the global test database
 */
export function resetGlobalTestDb() {
  if (globalTestDb) {
    globalTestDb.close()
    globalTestDb = null
  }
}

/**
 * Test database utilities
 */
export const testDbUtils = {
  createTestDatabase,
  getGlobalTestDb,
  resetGlobalTestDb
}