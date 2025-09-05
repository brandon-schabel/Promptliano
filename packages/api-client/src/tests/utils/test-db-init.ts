/**
 * Test Database Initialization
 * 
 * This module ensures the singleton database instance used by services
 * has all the necessary tables when running tests.
 */

import { Database } from 'bun:sqlite'

/**
 * Initialize tables in the given database
 * This is a workaround for the singleton database pattern used by services
 */
export function initializeTestTables(db: Database) {
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
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
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
      name TEXT NOT NULL,
      description TEXT,
      system_prompt TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 1000,
      model TEXT,
      provider TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    
    // Chat messages table
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
      content TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
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
      queue_id INTEGER NOT NULL REFERENCES queues(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('ticket', 'task')),
      item_id INTEGER NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled')),
      metadata TEXT,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      agent_id TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    
    // Provider keys table
    `CREATE TABLE IF NOT EXISTS provider_keys (
      id INTEGER PRIMARY KEY,
      provider TEXT NOT NULL,
      key_name TEXT NOT NULL,
      encrypted_key TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    
    // Files table
    `CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
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
      updated_at INTEGER NOT NULL
    )`,
    
    // Selected files table
    `CREATE TABLE IF NOT EXISTS selected_files (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      selected_at INTEGER NOT NULL,
      selected_by TEXT,
      context TEXT
    )`,
    
    // Active tabs table
    `CREATE TABLE IF NOT EXISTS active_tabs (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      tab_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      file_path TEXT,
      file_content TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, tab_id, client_id)
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
}

/**
 * Get the singleton database instance and ensure it has tables
 */
export function getInitializedTestDatabase(): Database {
  // Access the singleton database that services will use
  // When NODE_ENV=test, the database package creates an in-memory database
  const Database = require('bun:sqlite').Database
  const db = new Database(':memory:', { create: true, strict: true })
  
  // Initialize tables
  initializeTestTables(db)
  
  return db
}