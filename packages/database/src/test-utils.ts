/**
 * Test Utilities for Database Testing
 * Provides isolated test database instances and cleanup utilities
 */

import { drizzle } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schema'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

/**
 * Create an isolated test database instance
 * Each test gets its own in-memory database
 * NOTE: Since services import the global db directly, tests need to use
 * the global in-memory database set up by the main db.ts file
 */
export function createTestDatabase() {
  // For now, just ensure tables are created in the global test database
  // The db.ts file already sets up an in-memory database for tests
  // We just need to ensure tables exist
  
  // Import the global db and rawDb
  const { db, rawDb } = require('./db')
  
  // Create tables if they don't exist
  try {
    const tables = rawDb.query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").all()
    if (tables.length === 0) {
      createTestTables(rawDb)
    }
  } catch (e) {
    // Tables might already exist
    createTestTables(rawDb)
  }

  return {
    db,
    sqlite: rawDb,
    close: () => {}, // Don't close the global db
    clear: () => clearAllData(rawDb),
    reset: () => {
      clearAllData(rawDb)
      createTestTables(rawDb)
    }
  }
}

/**
 * Create all tables for testing
 */
function createTestTables(sqlite: Database) {
  // Projects table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      path TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  // Tickets table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      overview TEXT,
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'normal',
      suggested_file_ids TEXT DEFAULT '[]',
      suggested_agent_ids TEXT DEFAULT '[]',
      suggested_prompt_ids TEXT DEFAULT '[]',
      queue_id INTEGER,
      queue_position INTEGER,
      queue_status TEXT,
      queue_priority INTEGER,
      queued_at INTEGER,
      queue_started_at INTEGER,
      queue_completed_at INTEGER,
      queue_agent_id TEXT,
      queue_error_message TEXT,
      estimated_processing_time INTEGER,
      actual_processing_time INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  // Ticket tasks table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ticket_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id),
      content TEXT NOT NULL,
      description TEXT,
      suggested_file_ids TEXT DEFAULT '[]',
      done INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      order_index INTEGER DEFAULT 0,
      estimated_hours REAL,
      dependencies TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      agent_id TEXT,
      suggested_prompt_ids TEXT DEFAULT '[]',
      queue_id INTEGER,
      queue_position INTEGER,
      queue_status TEXT,
      queue_priority INTEGER,
      queued_at INTEGER,
      queue_started_at INTEGER,
      queue_completed_at INTEGER,
      queue_agent_id TEXT,
      queue_error_message TEXT,
      estimated_processing_time INTEGER,
      actual_processing_time INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  // Queues table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS queues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      max_parallel_items INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  // Queue items table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS queue_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id INTEGER NOT NULL REFERENCES queues(id),
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      priority INTEGER DEFAULT 5,
      status TEXT DEFAULT 'queued',
      agent_id TEXT,
      error_message TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      estimated_processing_time INTEGER,
      actual_processing_time INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)

  // Add indexes
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets(project_id)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_queue_items_queue ON queue_items(queue_id)')
  sqlite.exec('CREATE INDEX IF NOT EXISTS idx_queue_items_status ON queue_items(status)')
}

/**
 * Clear all data from test database
 */
function clearAllData(sqlite: Database) {
  const tables = [
    'queue_items',
    'queues',
    'ticket_tasks',
    'tickets',
    'projects'
  ]

  for (const table of tables) {
    try {
      sqlite.exec(`DELETE FROM ${table}`)
    } catch (e) {
      // Table might not exist, ignore
    }
  }
}

/**
 * Test data factories for common entities
 */
export const testFactories = {
  project: (overrides = {}) => ({
    name: 'Test Project',
    description: 'Test project description',
    path: '/test/project-' + Date.now(),
    ...overrides
  }),

  ticket: (projectId: number, overrides = {}) => ({
    projectId,
    title: 'Test Ticket',
    description: 'Test ticket description',
    status: 'open',
    priority: 'normal',
    ...overrides
  }),

  task: (ticketId: number, overrides = {}) => ({
    ticketId,
    title: 'Test Task',
    description: 'Test task description',
    done: false,
    orderIndex: 0,
    ...overrides
  }),

  queue: (projectId: number, overrides = {}) => ({
    projectId,
    name: 'Test Queue',
    description: 'Test queue description',
    isActive: true,
    ...overrides
  }),

  queueItem: (queueId: number, overrides = {}) => ({
    queueId,
    itemType: 'ticket',
    itemId: 1,
    priority: 5,
    status: 'queued',
    ...overrides
  })
}