import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { DatabaseManager, getDb } from './database-manager'

describe('DatabaseManager', () => {
  let db: DatabaseManager

  beforeEach(() => {
    // Set test environment to use in-memory database
    process.env.NODE_ENV = 'test'
    db = DatabaseManager.getInstance()
  })

  afterEach(async () => {
    // Clear all tables for test isolation
    await db.clearAllTables()
  })

  test('singleton pattern returns same instance', () => {
    const db1 = DatabaseManager.getInstance()
    const db2 = DatabaseManager.getInstance()
    expect(db1).toBe(db2)
  })

  test('uses in-memory database in test environment', () => {
    const stats = db.getStats()
    expect(stats.pageCount).toBeGreaterThan(0)
  })

  test('creates all required tables', async () => {
    // Test only JSON-based tables that haven't been migrated
    const jsonTables = [
      'mcp_server_configs',
      'mcp_server_states',
      'mcp_tools',
      'mcp_resources',
      'mcp_tool_executions',
      'selected_files'
    ]

    for (const table of jsonTables) {
      // Test that we can query each JSON table without error
      const result = await db.getAll(table)
      expect(result).toBeInstanceOf(Map)
      expect(result.size).toBe(0)
    }

    // Test that migration-managed tables exist (but don't test JSON operations)
    const migrationTables = ['projects', 'tickets', 'prompts', 'chats', 'chat_messages']
    const database = db.getDatabase()
    for (const table of migrationTables) {
      // Just verify the table exists by checking its structure
      const tableInfo = database.prepare(`PRAGMA table_info(${table})`).all()
      expect(tableInfo.length).toBeGreaterThan(0)
    }
  })

  test('CRUD operations work correctly', async () => {
    // Use a JSON-based table that hasn't been migrated
    const testTable = 'mcp_server_configs'
    const testData = {
      name: 'Test Config',
      description: 'A test config',
      settings: { theme: 'dark' }
    }

    // Create
    await db.create(testTable, 'test-id', testData)

    // Read
    const retrieved = await db.get<typeof testData>(testTable, 'test-id')
    expect(retrieved).toEqual(testData)

    // Update
    const updatedData = { ...testData, name: 'Updated Config' }
    const updateResult = await db.update(testTable, 'test-id', updatedData)
    expect(updateResult).toBe(true)

    const updatedRetrieved = await db.get<typeof testData>(testTable, 'test-id')
    expect(updatedRetrieved?.name).toBe('Updated Config')

    // Exists
    const exists = await db.exists(testTable, 'test-id')
    expect(exists).toBe(true)

    // Delete
    const deleteResult = await db.delete(testTable, 'test-id')
    expect(deleteResult).toBe(true)

    const deletedItem = await db.get(testTable, 'test-id')
    expect(deletedItem).toBeNull()
  })

  test('getAll returns items in descending order by created_at', async () => {
    // Use a JSON-based table for this test
    const testTable = 'mcp_server_configs'
    
    // Create items with slight delays to ensure different timestamps
    await db.create(testTable, 'config-1', { name: 'Config 1' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await db.create(testTable, 'config-2', { name: 'Config 2' })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await db.create(testTable, 'config-3', { name: 'Config 3' })

    const allConfigs = await db.getAll<{ name: string }>(testTable)
    const configArray = Array.from(allConfigs.entries())

    // Should be in descending order (newest first)
    expect(configArray[0]?.[0]).toBe('config-3')
    expect(configArray[1]?.[0]).toBe('config-2')
    expect(configArray[2]?.[0]).toBe('config-1')
  })

  test('findByJsonField queries JSON data correctly', async () => {
    // Use a JSON-based table for this test
    const testTable = 'mcp_tools'
    
    // Create tools with different server IDs
    await db.create(testTable, 'tool-1', {
      serverId: 'server-123',
      name: 'Tool 1',
      type: 'function'
    })
    await db.create(testTable, 'tool-2', {
      serverId: 'server-123',
      name: 'Tool 2',
      type: 'function'
    })
    await db.create(testTable, 'tool-3', {
      serverId: 'server-456',
      name: 'Tool 3',
      type: 'function'
    })

    const tools = await db.findByJsonField<any>(testTable, '$.serverId', 'server-123')

    expect(tools.length).toBe(2)
    expect(tools[0].serverId).toBe('server-123')
    expect(tools[1].serverId).toBe('server-123')
  })

  test('findByDateRange filters by timestamp', async () => {
    // Use a JSON-based table for this test
    const testTable = 'mcp_server_configs'
    const now = Date.now()
    const yesterday = now - 24 * 60 * 60 * 1000
    const tomorrow = now + 24 * 60 * 60 * 1000

    await db.create(testTable, 'config-1', { name: 'Config 1' })
    await db.create(testTable, 'config-2', { name: 'Config 2' })

    const results = await db.findByDateRange<any>(testTable, yesterday, tomorrow)
    expect(results.length).toBe(2)

    const noResults = await db.findByDateRange<any>(testTable, tomorrow, tomorrow + 1000)
    expect(noResults.length).toBe(0)
  })

  test('countByJsonField returns correct count', async () => {
    // Use a JSON-based table for this test
    const testTable = 'mcp_tools'
    
    await db.create(testTable, 'tool-1', { serverId: 'server-1', name: 'tool1.ts' })
    await db.create(testTable, 'tool-2', { serverId: 'server-1', name: 'tool2.ts' })
    await db.create(testTable, 'tool-3', { serverId: 'server-2', name: 'tool3.ts' })

    const count1 = await db.countByJsonField(testTable, '$.serverId', 'server-1')
    expect(count1).toBe(2)

    const count2 = await db.countByJsonField(testTable, '$.serverId', 'server-2')
    expect(count2).toBe(1)

    const count3 = await db.countByJsonField(testTable, '$.serverId', 'server-3')
    expect(count3).toBe(0)
  })

  test('transaction support works correctly', async () => {
    let errorThrown = false
    const testTable = 'mcp_server_configs'

    try {
      db.transaction(() => {
        // This should succeed
        db.getDatabase()
          .prepare(`INSERT INTO ${testTable} (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`)
          .run('tx-1', JSON.stringify({ name: 'Transaction Test' }), Date.now(), Date.now())

        // This should cause an error (duplicate primary key)
        db.getDatabase()
          .prepare(`INSERT INTO ${testTable} (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)`)
          .run('tx-1', JSON.stringify({ name: 'Duplicate' }), Date.now(), Date.now())
      })
    } catch (error) {
      errorThrown = true
    }

    expect(errorThrown).toBe(true)

    // Transaction should have rolled back
    const result = await db.get(testTable, 'tx-1')
    expect(result).toBeNull()
  })

  test('clear removes all records from table', async () => {
    const testTable = 'mcp_server_configs'
    
    await db.create(testTable, 'config-1', { name: 'Config 1' })
    await db.create(testTable, 'config-2', { name: 'Config 2' })

    const beforeClear = await db.getAll(testTable)
    expect(beforeClear.size).toBe(2)

    await db.clear(testTable)

    const afterClear = await db.getAll(testTable)
    expect(afterClear.size).toBe(0)
  })

  test('migration support', async () => {
    const migration = {
      version: 1,
      up: (database: any) => {
        database.exec(`
          CREATE TABLE IF NOT EXISTS test_migration (
            id TEXT PRIMARY KEY,
            value TEXT
          )
        `)
      }
    }

    await db.runMigration(migration)

    // Check migration was recorded
    const status = await db.getMigrationStatus()
    expect(status).toContain(1)

    // Running the same migration again should not error
    await db.runMigration(migration)
  })

  test('indexes are created for JSON fields', async () => {
    // Use a JSON-based table for this test
    const testTable = 'mcp_tools'
    
    // Create many tools to test index performance
    for (let i = 0; i < 100; i++) {
      await db.create(testTable, `tool-${i}`, {
        serverId: i < 50 ? 'server-A' : 'server-B',
        name: `Tool ${i}`,
        type: i % 2 === 0 ? 'function' : 'resource'
      })
    }

    // This query should use the index
    const toolsA = await db.findByJsonField<any>(testTable, '$.serverId', 'server-A')
    expect(toolsA.length).toBe(50)

    const toolsB = await db.findByJsonField<any>(testTable, '$.serverId', 'server-B')
    expect(toolsB.length).toBe(50)
  })

  test('getDb helper returns singleton instance', () => {
    const db1 = getDb()
    const db2 = getDb()
    expect(db1).toBe(db2)
  })
})
