#!/usr/bin/env bun

import { Database } from 'bun:sqlite'
import path from 'path'

const dbPath = path.resolve('../../data/promptliano.db')
console.log(`🔧 Opening database at: ${dbPath}`)

const db = new Database(dbPath)

const indexes = [
  'CREATE INDEX IF NOT EXISTS cse_stream_seq ON chat_stream_events(stream_id, seq)',
  'CREATE INDEX IF NOT EXISTS cse_type ON chat_stream_events(type)'
]

try {
  console.log('📊 Creating chat stream event indexes...')
  for (const sql of indexes) {
    const indexName = sql.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1]
    console.log(`  Creating index: ${indexName}`)
    db.exec(sql)
  }

  console.log('\n✅ Chat stream event indexes created successfully!')
} catch (error) {
  console.error('❌ Failed to create chat stream event indexes:', error)
  process.exit(1)
} finally {
  db.close()
}
