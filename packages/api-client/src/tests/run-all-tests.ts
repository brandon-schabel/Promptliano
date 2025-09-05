#!/usr/bin/env bun
/**
 * Universal Test Runner for All API Tests
 * 
 * This script ensures proper database setup with complete schema before running tests.
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
process.env.SKIP_AI_TESTS = 'true' // Skip AI tests by default

console.log('Setting up test database at:', dbPath)

// Initialize database
const db = new Database(dbPath, { create: true, strict: true })

// Configure SQLite for performance
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA synchronous = NORMAL')
db.exec('PRAGMA foreign_keys = ON')
db.exec('PRAGMA temp_store = MEMORY')

// Create all tables with complete schema
const tables = [
  // Core tables
  `CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  
  `CREATE TABLE queues (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    max_parallel_items INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  `CREATE TABLE tickets (
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
  
  `CREATE TABLE ticket_tasks (
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
  
  `CREATE TABLE queue_items (
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
  
  `CREATE TABLE prompts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    variables TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  
  `CREATE TABLE project_prompts (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    prompt_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
    UNIQUE(project_id, prompt_id)
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
  )`,
  
  `CREATE TABLE files (
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
  
  `CREATE TABLE selected_files (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    selected_at INTEGER NOT NULL,
    selected_by TEXT,
    context TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
  )`,
  
  `CREATE TABLE active_tabs (
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
  
  `CREATE TABLE model_configs (
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
  )`,
  
  // Git-related tables
  `CREATE TABLE git_branches (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0,
    remote TEXT,
    last_commit TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  `CREATE TABLE git_commits (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL,
    hash TEXT NOT NULL,
    message TEXT NOT NULL,
    author_name TEXT,
    author_email TEXT,
    date INTEGER,
    branch TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  // MCP-related tables
  `CREATE TABLE mcp_tools (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    input_schema TEXT,
    output_schema TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  
  `CREATE TABLE mcp_tool_executions (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    tool_name TEXT NOT NULL,
    input TEXT,
    output TEXT,
    error TEXT,
    duration_ms INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,
  
  // System tables
  `CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    type TEXT NOT NULL DEFAULT 'string',
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  
  `CREATE TABLE claude_commands (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    pattern TEXT NOT NULL,
    handler TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`
]

// Execute all table creation statements
for (const sql of tables) {
  try {
    db.exec(sql)
  } catch (error: any) {
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
  'CREATE INDEX IF NOT EXISTS idx_queue_items_queue_id ON queue_items(queue_id)',
  'CREATE INDEX IF NOT EXISTS idx_git_commits_project_id ON git_commits(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_git_branches_project_id ON git_branches(project_id)'
]

for (const sql of indexes) {
  try {
    db.exec(sql)
  } catch (error: any) {
    console.warn('Index creation warning:', error.message)
  }
}

// Insert default test data
const testData = [
  `INSERT INTO projects (id, name, description, path, created_at, updated_at) 
   VALUES (1, 'Test Project', 'Default test project', '${tempDir}', ${Date.now()}, ${Date.now()})`,
  
  `INSERT INTO queues (id, project_id, name, description, created_at, updated_at)
   VALUES (1, 1, 'Test Queue', 'Default test queue', ${Date.now()}, ${Date.now()})`,
  
  `INSERT INTO prompts (id, name, content, description, created_at, updated_at)
   VALUES (1, 'Test Prompt', 'Test prompt content', 'Test description', ${Date.now()}, ${Date.now()})`,
  
  `INSERT INTO model_configs (id, name, provider, model, is_default, created_at, updated_at)
   VALUES (1, 'Test Model', 'openai', 'gpt-3.5-turbo', 1, ${Date.now()}, ${Date.now()})`,
  
  `INSERT INTO system_settings (key, value, type, created_at, updated_at)
   VALUES ('test_mode', 'true', 'boolean', ${Date.now()}, ${Date.now()})`
]

for (const sql of testData) {
  try {
    db.exec(sql)
  } catch (error: any) {
    console.warn('Test data insertion warning:', error.message)
  }
}

db.close()

console.log('Database initialized successfully with complete schema')

// Get test files to run
const testFiles = process.argv.slice(2)
let testArgs = ['test']

if (testFiles.length > 0) {
  // Run specific test files
  testArgs = ['test', ...testFiles]
} else {
  // Run all tests
  testArgs = ['test']
}

// Run tests with the configured environment
const testProcess = spawn('bun', testArgs, {
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
    console.log('\nTest database cleaned up')
  } catch {
    // Ignore cleanup errors
  }
  
  process.exit(code || 0)
})