/**
 * Test Server Wrapper
 * 
 * This module ensures proper database initialization before starting the server.
 * It sets up the environment variables and database before any other modules are imported.
 */

import { Database } from 'bun:sqlite'
import { mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Create temporary directory and database path
const tempDir = mkdtempSync(join(tmpdir(), 'promptliano-test-'))
const dbPath = join(tempDir, 'test.db')

// Set environment variables BEFORE importing any modules
process.env.NODE_ENV = 'production'
process.env.DATABASE_PATH = dbPath
process.env.PROMPTLIANO_DB_PATH = dbPath
process.env.RATE_LIMIT_ENABLED = 'false'
process.env.LOG_LEVEL = 'silent'

// Initialize database with tables
const db = new Database(dbPath, { create: true, strict: true })

// Configure SQLite
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA synchronous = NORMAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA temp_store = MEMORY')

// Create all tables with correct schema
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
  
  // Chats table (with correct schema)
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
  
  // Provider keys table (with correct schema)
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
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  // Other necessary tables...
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
  )`
]

// Execute all statements
for (const statement of statements) {
  try {
    db.exec(statement)
  } catch (error: any) {
    if (!error.message?.includes('already exists')) {
      console.error('Failed to create table:', error.message)
      throw error
    }
  }
}

// Create a default project for tests
db.exec(`INSERT INTO projects (id, name, description, path, created_at, updated_at) 
         VALUES (1, 'Test Project', 'Default test project', '${tempDir}', ${Date.now()}, ${Date.now()})`)

db.close()

// Now import the server app - it will use the database we just created
export { app } from '@promptliano/server/src/app'
export { dbPath, tempDir }