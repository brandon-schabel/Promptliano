/**
 * Simplified Test Environment for API Testing
 * 
 * This creates a test server with proper database initialization,
 * working around the singleton database pattern used by services.
 */

import { serve } from 'bun'
import type { Server } from 'bun'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface SimpleTestEnvironment {
  server: Server
  baseUrl: string
  isCI?: boolean
  cleanup: () => Promise<void>
}

/**
 * Initialize test database tables
 * This ensures the database has all necessary tables for testing
 */
function initializeTestDatabase(dbPath: string = ':memory:') {
  const db = new Database(dbPath, { create: true, strict: true })
  
  // Configure SQLite for performance
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA temp_store = MEMORY')
  
  // Create all necessary tables
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
    
    // Queues table (needed before tickets due to foreign key)
    `CREATE TABLE IF NOT EXISTS queues (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      max_parallel_items INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    
    // Tickets table  
    `CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      overview TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'normal',
      suggested_file_ids TEXT NOT NULL DEFAULT '[]',
      suggested_agent_ids TEXT NOT NULL DEFAULT '[]',
      suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
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
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE SET NULL
    )`,
    
    // Ticket tasks table
    `CREATE TABLE IF NOT EXISTS ticket_tasks (
      id INTEGER PRIMARY KEY,
      ticket_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      suggested_file_ids TEXT NOT NULL DEFAULT '[]',
      done INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      order_index INTEGER NOT NULL DEFAULT 0,
      estimated_hours REAL,
      dependencies TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      agent_id TEXT,
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
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE SET NULL
    )`,
    
    // Chats table
    `CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    
    // Chat messages table
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY,
      chat_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )`,
    
    // Prompts table
    `CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      description TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      variables TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    
    // Queue items table
    `CREATE TABLE IF NOT EXISTS queue_items (
      id INTEGER PRIMARY KEY,
      queue_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      metadata TEXT,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      agent_id TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (queue_id) REFERENCES queues(id) ON DELETE CASCADE
    )`,
    
    // Provider keys table
    `CREATE TABLE IF NOT EXISTS provider_keys (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL,
      key_name TEXT NOT NULL,
      name TEXT,
      secret_ref TEXT,
      key TEXT,
      base_url TEXT,
      custom_headers TEXT DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    )`,
    
    // Files table
    `CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      extension TEXT,
      content TEXT,
      size INTEGER,
      checksum TEXT,
      is_relevant INTEGER NOT NULL DEFAULT 0,
      relevance_score REAL,
      summary TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    
    // Selected files table
    `CREATE TABLE IF NOT EXISTS selected_files (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      selected_at INTEGER NOT NULL,
      selected_by TEXT,
      context TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    )`,
    
    // Active tabs table
    `CREATE TABLE IF NOT EXISTS active_tabs (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      tab_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      file_path TEXT,
      file_content TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, tab_id, client_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )`,
    
    // Model configs table
    `CREATE TABLE IF NOT EXISTS model_configs (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 1000,
      top_p REAL DEFAULT 1.0,
      frequency_penalty REAL DEFAULT 0,
      presence_penalty REAL DEFAULT 0,
      system_prompt TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  ]
  
  // Execute each statement
  for (const statement of statements) {
    try {
      db.exec(statement)
    } catch (error: any) {
      // Ignore "already exists" errors
      if (!error.message?.includes('already exists')) {
        console.error('Failed to create table:', error.message)
        throw error
      }
    }
  }
  
  // Create indexes for better performance
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)',
    'CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id)',
    'CREATE INDEX IF NOT EXISTS idx_queue_items_queue_id ON queue_items(queue_id)'
  ]
  
  for (const index of indexes) {
    try {
      db.exec(index)
    } catch (error: any) {
      if (!error.message?.includes('already exists')) {
        console.warn('Failed to create index:', error.message)
      }
    }
  }
  
  return db
}

/**
 * Create a simple test environment with database and server
 */
export async function createSimpleTestEnvironment(): Promise<SimpleTestEnvironment> {
  // Store original environment
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_PATH: process.env.DATABASE_PATH,
    PROMPTLIANO_DB_PATH: process.env.PROMPTLIANO_DB_PATH,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED,
    LOG_LEVEL: process.env.LOG_LEVEL
  }
  
  // Import the wrapper which sets up database before importing server
  const { app, dbPath, tempDir } = await import('./test-server-wrapper')
  
  // Start the server
  const server = serve({
    port: 0, // Dynamic port
    fetch: async (request) => {
      try {
        return app.fetch(request)
      } catch (error) {
        console.error('Failed to handle request:', error)
        return new Response('Request handling error', { status: 500 })
      }
    },
    development: false,
    error(error) {
      console.error('Server error:', error)
      return new Response('Internal Server Error', { status: 500 })
    }
  })
  
  const baseUrl = `http://localhost:${server.port}`
  
  // Wait for server to be ready
  const maxAttempts = 50
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok) break
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  // Cleanup function
  const cleanup = async () => {
    server.stop(true)
    
    // Restore environment
    Object.assign(process.env, originalEnv)
    
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
  
  return {
    server,
    baseUrl,
    isCI: process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true',
    cleanup
  }
}