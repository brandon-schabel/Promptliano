import type { Database } from 'bun:sqlite'

/**
 * Migration 001: Promptliano v1.0 Baseline Schema
 * 
 * This migration establishes the complete v1.0 database schema as a baseline.
 * It consolidates all previous migrations (002-026) into a single, clean foundation.
 * 
 * Created: 2025-08-18
 * Replaces: Migrations 002-026 (archived in migrations/archive/)
 * 
 * Schema includes:
 * - Core entities (projects, tickets, tasks, prompts)
 * - Queue system for AI agent processing  
 * - Full-text search with FTS5
 * - MCP tool tracking and analytics
 * - Chat system
 * - Provider key management
 * - File management and search
 */
export const baselineV1Migration = {
  version: 1,
  description: 'Promptliano v1.0 baseline schema - complete foundation',

  up: (db: Database) => {
    console.log('[Migration 001] Creating Promptliano v1.0 baseline schema...')

    // Enable performance optimizations
    db.exec('PRAGMA foreign_keys = ON')

    // ===== CORE ENTITIES =====

    // Projects table
    db.exec(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // Project files table
    db.exec(`
      CREATE TABLE project_files (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        extension TEXT NOT NULL,
        size INTEGER NOT NULL,
        content TEXT,
        summary TEXT,
        summary_last_updated INTEGER,
        meta TEXT,
        checksum TEXT,
        imports TEXT NOT NULL DEFAULT '[]',
        exports TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE (project_id, path)
      )
    `)

    // Tickets table
    db.exec(`
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        overview TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'normal',
        suggested_file_ids TEXT NOT NULL DEFAULT '[]',
        suggested_agent_ids TEXT NOT NULL DEFAULT '[]',
        suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
        queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL,
        queue_position INTEGER,
        queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
        queue_priority INTEGER DEFAULT 0,
        queued_at INTEGER,
        queue_started_at INTEGER,
        queue_completed_at INTEGER,
        queue_agent_id TEXT,
        queue_error_message TEXT,
        estimated_processing_time INTEGER,
        actual_processing_time INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // Task queues table
    db.exec(`
      CREATE TABLE task_queues (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive')),
        max_parallel_items INTEGER NOT NULL DEFAULT 1,
        average_processing_time INTEGER,
        total_completed_items INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, name)
      )
    `)

    // Ticket tasks table (depends on task_queues)
    db.exec(`
      CREATE TABLE ticket_tasks (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        suggested_file_ids TEXT NOT NULL DEFAULT '[]',
        done INTEGER NOT NULL DEFAULT 0,
        order_index INTEGER NOT NULL DEFAULT 0,
        estimated_hours REAL,
        dependencies TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        agent_id TEXT,
        suggested_prompt_ids TEXT NOT NULL DEFAULT '[]',
        queue_id INTEGER REFERENCES task_queues(id) ON DELETE SET NULL,
        queue_position INTEGER,
        queue_status TEXT CHECK (queue_status IN ('queued', 'in_progress', 'completed', 'failed', 'cancelled')),
        queue_priority INTEGER DEFAULT 0,
        queued_at INTEGER,
        queue_started_at INTEGER,
        queue_completed_at INTEGER,
        queue_agent_id TEXT,
        queue_error_message TEXT,
        estimated_processing_time INTEGER,
        actual_processing_time INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
      )
    `)

    // ===== PROMPT SYSTEM =====

    // Prompts table
    db.exec(`
      CREATE TABLE prompts (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        project_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // Prompt projects table
    db.exec(`
      CREATE TABLE prompt_projects (
        id INTEGER PRIMARY KEY,
        prompt_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE (prompt_id, project_id)
      )
    `)

    // ===== PROVIDER SYSTEM =====

    // Provider keys table
    db.exec(`
      CREATE TABLE provider_keys (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        key TEXT NOT NULL,
        encrypted INTEGER NOT NULL DEFAULT 0 CHECK (encrypted IN (0, 1)),
        iv TEXT,
        tag TEXT,
        salt TEXT,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        environment TEXT NOT NULL DEFAULT 'production',
        description TEXT,
        expires_at INTEGER,
        last_used INTEGER,
        base_url TEXT,
        custom_headers TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // ===== CHAT SYSTEM =====

    // Chats table
    db.exec(`
      CREATE TABLE chats (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        project_id INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    // Chat messages table
    db.exec(`
      CREATE TABLE chat_messages (
        id INTEGER PRIMARY KEY,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        type TEXT,
        attachments TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )
    `)

    // ===== FULL-TEXT SEARCH SYSTEM =====

    // FTS5 virtual table for file search
    db.exec(`
      CREATE VIRTUAL TABLE file_search_fts USING fts5(
        file_id UNINDEXED,
        project_id UNINDEXED,
        path,
        name,
        extension UNINDEXED,
        content,
        summary,
        keywords,
        tokenize = 'porter unicode61 remove_diacritics 2'
      )
    `)

    // File search metadata
    db.exec(`
      CREATE TABLE file_search_metadata (
        file_id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        tf_idf_vector BLOB,
        keyword_vector TEXT,
        last_indexed INTEGER NOT NULL,
        file_size INTEGER,
        token_count INTEGER,
        language TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)

    // File keywords table
    db.exec(`
      CREATE TABLE file_keywords (
        file_id TEXT NOT NULL,
        keyword TEXT NOT NULL,
        frequency INTEGER NOT NULL,
        tf_score REAL NOT NULL,
        idf_score REAL,
        PRIMARY KEY (file_id, keyword)
      )
    `)

    // File trigrams table
    db.exec(`
      CREATE TABLE file_trigrams (
        trigram TEXT NOT NULL,
        file_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (trigram, file_id, position)
      )
    `)

    // Search cache table
    db.exec(`
      CREATE TABLE search_cache (
        cache_key TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        results TEXT NOT NULL,
        score_data TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        hit_count INTEGER DEFAULT 0
      )
    `)

    // ===== QUEUE SYSTEM =====

    // Queue history table
    db.exec(`
      CREATE TABLE queue_history (
        id INTEGER PRIMARY KEY,
        queue_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        ticket_id INTEGER,
        task_id INTEGER,
        status TEXT NOT NULL,
        processing_time INTEGER,
        agent_id TEXT,
        completed_at INTEGER NOT NULL,
        actual_processing_time INTEGER,
        FOREIGN KEY (queue_id) REFERENCES task_queues(id) ON DELETE CASCADE
      )
    `)

    // Queue dead letter table
    db.exec(`
      CREATE TABLE queue_dead_letter (
        id INTEGER PRIMARY KEY,
        original_queue_id INTEGER NOT NULL,
        original_item_id INTEGER NOT NULL,
        ticket_id INTEGER,
        task_id INTEGER,
        final_status TEXT NOT NULL,
        error_message TEXT,
        retry_count INTEGER NOT NULL,
        agent_id TEXT,
        moved_at INTEGER NOT NULL,
        original_created_at INTEGER NOT NULL,
        FOREIGN KEY (original_queue_id) REFERENCES task_queues(id) ON DELETE CASCADE,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES ticket_tasks(id) ON DELETE CASCADE
      )
    `)

    // Flow migration metadata
    db.exec(`
      CREATE TABLE flow_migration_metadata (
        id INTEGER PRIMARY KEY,
        migration_version INTEGER NOT NULL,
        migrated_at INTEGER NOT NULL,
        tickets_migrated INTEGER,
        tasks_migrated INTEGER,
        queue_items_count INTEGER
      )
    `)

    // ===== MCP TOOL TRACKING =====

    // MCP tool executions v2
    db.exec(`
      CREATE TABLE mcp_tool_executions_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        project_id INTEGER,
        user_id TEXT,
        session_id TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration_ms INTEGER,
        status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
        error_message TEXT,
        error_code TEXT,
        input_params TEXT,
        output_size INTEGER,
        metadata TEXT
      )
    `)

    // MCP tool statistics
    db.exec(`
      CREATE TABLE mcp_tool_statistics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        project_id INTEGER,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        period_type TEXT NOT NULL CHECK (period_type IN ('hour', 'day', 'week', 'month')),
        execution_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        timeout_count INTEGER NOT NULL DEFAULT 0,
        total_duration_ms INTEGER NOT NULL DEFAULT 0,
        avg_duration_ms INTEGER NOT NULL DEFAULT 0,
        min_duration_ms INTEGER,
        max_duration_ms INTEGER,
        total_output_size INTEGER NOT NULL DEFAULT 0,
        metadata TEXT,
        UNIQUE(tool_name, project_id, period_start, period_type)
      )
    `)

    // MCP tool chains
    db.exec(`
      CREATE TABLE mcp_tool_chains (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chain_id TEXT NOT NULL,
        execution_id INTEGER NOT NULL,
        parent_execution_id INTEGER,
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (execution_id) REFERENCES mcp_tool_executions_v2(id),
        FOREIGN KEY (parent_execution_id) REFERENCES mcp_tool_executions_v2(id)
      )
    `)

    // MCP tool patterns
    db.exec(`
      CREATE TABLE mcp_tool_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        pattern_type TEXT NOT NULL CHECK (pattern_type IN ('sequence', 'frequency', 'error')),
        pattern_data TEXT NOT NULL,
        occurrence_count INTEGER NOT NULL DEFAULT 1,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        metadata TEXT
      )
    `)

    console.log('[Migration 001] Creating indexes...')

    // ===== INDEXES =====

    // Projects indexes
    db.exec('CREATE INDEX idx_projects_created_at ON projects(created_at)')
    db.exec('CREATE INDEX idx_projects_updated_at ON projects(updated_at)')
    db.exec('CREATE UNIQUE INDEX idx_projects_path ON projects(path)')

    // Project files indexes
    db.exec('CREATE INDEX idx_project_files_project_id ON project_files(project_id)')
    db.exec('CREATE INDEX idx_project_files_path ON project_files(path)')
    db.exec('CREATE INDEX idx_project_files_extension ON project_files(extension)')
    db.exec('CREATE INDEX idx_project_files_checksum ON project_files(checksum)')
    db.exec('CREATE INDEX idx_project_files_created_at ON project_files(created_at)')
    db.exec('CREATE INDEX idx_project_files_updated_at ON project_files(updated_at)')
    db.exec('CREATE INDEX idx_project_files_summary_updated ON project_files(summary_last_updated)')
    db.exec('CREATE INDEX idx_project_files_project_path ON project_files(project_id, path)')
    db.exec('CREATE INDEX idx_project_files_project_extension ON project_files(project_id, extension)')

    // Tickets indexes
    db.exec('CREATE INDEX idx_tickets_project_id ON tickets(project_id)')
    db.exec('CREATE INDEX idx_tickets_status ON tickets(status)')
    db.exec('CREATE INDEX idx_tickets_priority ON tickets(priority)')
    db.exec('CREATE INDEX idx_tickets_created_at ON tickets(created_at)')
    db.exec('CREATE INDEX idx_tickets_updated_at ON tickets(updated_at)')
    db.exec('CREATE INDEX idx_tickets_queue_id ON tickets(queue_id)')
    db.exec('CREATE INDEX idx_tickets_queue_status ON tickets(queue_status)')

    // Ticket tasks indexes
    db.exec('CREATE INDEX idx_ticket_tasks_ticket_id ON ticket_tasks(ticket_id)')
    db.exec('CREATE INDEX idx_ticket_tasks_done ON ticket_tasks(done)')
    db.exec('CREATE INDEX idx_ticket_tasks_order_index ON ticket_tasks(order_index)')
    db.exec('CREATE INDEX idx_ticket_tasks_created_at ON ticket_tasks(created_at)')
    db.exec('CREATE INDEX idx_ticket_tasks_queue_id ON ticket_tasks(queue_id)')
    db.exec('CREATE INDEX idx_ticket_tasks_queue_status ON ticket_tasks(queue_status)')

    // Task queues indexes
    db.exec('CREATE INDEX idx_task_queues_project_id ON task_queues(project_id)')
    db.exec('CREATE INDEX idx_task_queues_status ON task_queues(status)')
    db.exec('CREATE INDEX idx_task_queues_created_at ON task_queues(created_at)')

    // Prompts indexes
    db.exec('CREATE INDEX idx_prompts_name ON prompts(name)')
    db.exec('CREATE INDEX idx_prompts_project_id ON prompts(project_id)')
    db.exec('CREATE INDEX idx_prompts_created_at ON prompts(created_at)')
    db.exec('CREATE INDEX idx_prompts_updated_at ON prompts(updated_at)')

    // Prompt projects indexes
    db.exec('CREATE INDEX idx_prompt_projects_prompt_id ON prompt_projects(prompt_id)')
    db.exec('CREATE INDEX idx_prompt_projects_project_id ON prompt_projects(project_id)')

    // Provider keys indexes
    db.exec('CREATE INDEX idx_provider_keys_provider ON provider_keys(provider)')
    db.exec('CREATE INDEX idx_provider_keys_is_active ON provider_keys(is_active)')
    db.exec('CREATE INDEX idx_provider_keys_provider_active ON provider_keys(provider, is_active)')
    db.exec('CREATE INDEX idx_provider_keys_provider_active_default ON provider_keys(provider, is_active, is_default)')
    db.exec('CREATE INDEX idx_provider_keys_created_at ON provider_keys(created_at)')
    db.exec('CREATE INDEX idx_provider_keys_updated_at ON provider_keys(updated_at)')
    db.exec(`CREATE INDEX idx_provider_keys_custom 
      ON provider_keys(provider, base_url) 
      WHERE provider = 'custom' AND base_url IS NOT NULL`)

    // Chat indexes
    db.exec('CREATE INDEX idx_chats_project_id ON chats(project_id)')
    db.exec('CREATE INDEX idx_chats_created_at ON chats(created_at)')
    db.exec('CREATE INDEX idx_chats_updated_at ON chats(updated_at)')

    // Chat messages indexes
    db.exec('CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id)')
    db.exec('CREATE INDEX idx_chat_messages_role ON chat_messages(role)')
    db.exec('CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at)')
    db.exec('CREATE INDEX idx_chat_messages_chat_id_created_at ON chat_messages(chat_id, created_at)')

    // File search indexes
    db.exec('CREATE INDEX idx_file_search_metadata_project ON file_search_metadata(project_id)')
    db.exec('CREATE INDEX idx_file_search_metadata_indexed ON file_search_metadata(last_indexed)')
    db.exec('CREATE INDEX idx_file_keywords_file ON file_keywords(file_id)')
    db.exec('CREATE INDEX idx_file_keywords_keyword ON file_keywords(keyword)')
    db.exec('CREATE INDEX idx_file_trigrams_file ON file_trigrams(file_id)')
    db.exec('CREATE INDEX idx_search_cache_expires ON search_cache(expires_at)')

    // Queue system indexes
    db.exec('CREATE INDEX idx_queue_history_queue_id ON queue_history(queue_id)')
    db.exec('CREATE INDEX idx_queue_history_completed_at ON queue_history(completed_at)')
    db.exec('CREATE INDEX idx_queue_history_agent ON queue_history(agent_id)')
    db.exec(`CREATE INDEX idx_queue_history_stats 
      ON queue_history(queue_id, completed_at, processing_time)
      WHERE processing_time IS NOT NULL`)
    db.exec('CREATE INDEX idx_dead_letter_queue_id ON queue_dead_letter(original_queue_id)')
    db.exec('CREATE INDEX idx_dead_letter_moved_at ON queue_dead_letter(moved_at)')

    // MCP tool tracking indexes
    db.exec('CREATE INDEX idx_mcp_tool_executions_v2_tool_name ON mcp_tool_executions_v2(tool_name)')
    db.exec('CREATE INDEX idx_mcp_tool_executions_v2_project_id ON mcp_tool_executions_v2(project_id)')
    db.exec('CREATE INDEX idx_mcp_tool_executions_v2_status ON mcp_tool_executions_v2(status)')
    db.exec('CREATE INDEX idx_mcp_tool_executions_v2_started_at ON mcp_tool_executions_v2(started_at)')

    db.exec('CREATE INDEX idx_mcp_tool_statistics_tool_name ON mcp_tool_statistics(tool_name)')
    db.exec('CREATE INDEX idx_mcp_tool_statistics_project_id ON mcp_tool_statistics(project_id)')
    db.exec('CREATE INDEX idx_mcp_tool_statistics_period ON mcp_tool_statistics(period_start, period_end, period_type)')

    db.exec('CREATE INDEX idx_mcp_tool_chains_execution_id ON mcp_tool_chains(execution_id)')
    db.exec('CREATE INDEX idx_mcp_tool_chains_chain_id ON mcp_tool_chains(chain_id)')

    db.exec('CREATE INDEX idx_mcp_tool_patterns_project_id ON mcp_tool_patterns(project_id)')
    db.exec('CREATE INDEX idx_mcp_tool_patterns_type ON mcp_tool_patterns(pattern_type)')

    console.log('[Migration 001] Promptliano v1.0 baseline schema created successfully')
    console.log('[Migration 001] Schema includes: core entities, queue system, FTS5 search, MCP tracking, chat system')
  },

  down: (db: Database) => {
    console.log('[Migration 001] Reverting Promptliano v1.0 baseline schema...')

    // Drop all tables in reverse dependency order
    const tables = [
      'mcp_tool_patterns',
      'mcp_tool_chains',
      'mcp_tool_statistics',
      'mcp_tool_executions_v2',
      'flow_migration_metadata',
      'queue_dead_letter',
      'queue_history',
      'search_cache',
      'file_trigrams',
      'file_keywords',
      'file_search_metadata',
      'file_search_fts',
      'chat_messages',
      'chats',
      'provider_keys',
      'prompt_projects',
      'prompts',
      'ticket_tasks',
      'tickets',
      'task_queues',
      'project_files',
      'projects'
    ]

    for (const table of tables) {
      db.exec(`DROP TABLE IF EXISTS ${table}`)
    }

    console.log('[Migration 001] Baseline schema reverted successfully')
  }
}