#!/usr/bin/env bun
/**
 * Test Runner for Chat and Provider API Tests
 * 
 * This script ensures proper database setup before running tests.
 */

import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'

// Create temporary directory and database
const tempDir = mkdtempSync(join(tmpdir(), 'promptliano-test-'))
const dbPath = join(tempDir, 'test.db')

// Set environment variables BEFORE any imports
process.env.NODE_ENV = 'production'
process.env.DATABASE_PATH = dbPath
process.env.PROMPTLIANO_DB_PATH = dbPath
process.env.RATE_LIMIT_ENABLED = 'false'
process.env.LOG_LEVEL = 'silent'

console.log('Setting up test database at:', dbPath)

// Initialize database
const db = new Database(dbPath, { create: true, strict: true })

// Configure SQLite
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA synchronous = NORMAL')
db.exec('PRAGMA foreign_keys = ON')

// Create tables with correct schema
const tables = [
  `CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  
  `CREATE TABLE chats (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  `CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY,
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
  )`,
  
  `CREATE TABLE provider_keys (
    id INTEGER PRIMARY KEY,
    provider TEXT NOT NULL,
    key_name TEXT NOT NULL,
    name TEXT,
    secret_ref TEXT,
    key TEXT,
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
  )`
]

for (const sql of tables) {
  db.exec(sql)
}

// Insert test project
db.exec(`INSERT INTO projects (id, name, description, path, created_at, updated_at) 
         VALUES (1, 'Test Project', 'Test project for API tests', '${tempDir}', ${Date.now()}, ${Date.now()})`)

db.close()

console.log('Database initialized successfully')

// Run tests with the configured environment
const testProcess = spawn('bun', ['test', 'chat-api.test.ts', 'provider-key-api.test.ts'], {
  env: {
    ...process.env,
    DATABASE_PATH: dbPath,
    PROMPTLIANO_DB_PATH: dbPath,
    NODE_ENV: 'production'
  },
  stdio: 'inherit'
})

testProcess.on('exit', (code) => {
  // Cleanup
  try {
    rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
  
  process.exit(code || 0)
})