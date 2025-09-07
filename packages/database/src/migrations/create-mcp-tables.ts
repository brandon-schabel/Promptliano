#!/usr/bin/env bun

/**
 * Manual script to create MCP tracking tables
 */

import { Database } from 'bun:sqlite'
import path from 'path'

const dbPath = path.resolve('../../data/promptliano.db')
console.log(`🔧 Opening database at: ${dbPath}`)

const db = new Database(dbPath)

const tables = [
  // MCP Sessions table
  `CREATE TABLE IF NOT EXISTS mcp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    session_id TEXT NOT NULL UNIQUE,
    tool_server TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    total_calls INTEGER DEFAULT 0,
    successful_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    total_duration_ms INTEGER DEFAULT 0,
    metadata TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,

  // MCP Tool Calls table
  `CREATE TABLE IF NOT EXISTS mcp_tool_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    project_id INTEGER,
    tool_name TEXT NOT NULL,
    tool_input TEXT,
    tool_output TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    duration_ms INTEGER,
    metadata TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (session_id) REFERENCES mcp_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,

  // MCP Error Patterns table (if not exists)
  `CREATE TABLE IF NOT EXISTS mcp_error_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    tool_name TEXT NOT NULL,
    error_type TEXT NOT NULL,
    error_pattern TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1 NOT NULL,
    last_occurred_at INTEGER NOT NULL,
    metadata TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`,

  // MCP Performance Stats table
  `CREATE TABLE IF NOT EXISTS mcp_performance_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    tool_name TEXT NOT NULL,
    date TEXT NOT NULL,
    call_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    avg_duration_ms REAL,
    min_duration_ms INTEGER,
    max_duration_ms INTEGER,
    p50_duration_ms INTEGER,
    p95_duration_ms INTEGER,
    p99_duration_ms INTEGER,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  )`
]

const indexes = [
  // Session indexes
  'CREATE INDEX IF NOT EXISTS idx_mcp_sessions_project ON mcp_sessions(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_sessions_tool_server ON mcp_sessions(tool_server)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_sessions_started ON mcp_sessions(started_at)',

  // Tool call indexes
  'CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_session ON mcp_tool_calls(session_id)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_project ON mcp_tool_calls(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_tool ON mcp_tool_calls(tool_name)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_status ON mcp_tool_calls(status)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_started ON mcp_tool_calls(started_at)',

  // Error pattern indexes
  'CREATE INDEX IF NOT EXISTS idx_mcp_error_patterns_project ON mcp_error_patterns(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_error_patterns_tool ON mcp_error_patterns(tool_name)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_error_patterns_type ON mcp_error_patterns(error_type)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_error_pattern_unique ON mcp_error_patterns(project_id, tool_name, error_pattern)',

  // Performance stats indexes
  'CREATE INDEX IF NOT EXISTS idx_mcp_performance_project ON mcp_performance_stats(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_performance_tool ON mcp_performance_stats(tool_name)',
  'CREATE INDEX IF NOT EXISTS idx_mcp_performance_date ON mcp_performance_stats(date)',
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_performance_unique ON mcp_performance_stats(project_id, tool_name, date)'
]

try {
  console.log('📋 Creating MCP tracking tables...')

  // Create tables
  for (const sql of tables) {
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]
    console.log(`  Creating table: ${tableName}`)
    db.exec(sql)
  }

  // Create indexes
  console.log('\n📊 Creating indexes for performance...')
  for (const sql of indexes) {
    const indexName = sql.match(/CREATE.*INDEX IF NOT EXISTS (\w+)/)?.[1]
    console.log(`  Creating index: ${indexName}`)
    db.exec(sql)
  }

  // Verify tables were created
  console.log('\n✅ Verifying tables...')
  const result = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mcp%'").all()
  console.log('MCP tables in database:')
  result.forEach((row: any) => console.log(`  - ${row.name}`))

  console.log('\n🎉 MCP tracking tables created successfully!')
} catch (error) {
  console.error('❌ Failed to create MCP tables:', error)
  process.exit(1)
} finally {
  db.close()
}
