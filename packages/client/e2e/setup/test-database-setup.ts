import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, rmSync, readFileSync, copyFileSync, writeFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function setupTestDatabase() {
  const testDbPath = path.join(__dirname, '../../../database/data/playwright-test.db')
  const sourceDbPath = path.join(__dirname, '../../../database/data/promptliano.db')
  const testDbDir = path.dirname(testDbPath)

  // Ensure the data directory exists
  if (!existsSync(testDbDir)) {
    mkdirSync(testDbDir, { recursive: true })
  }

  // Remove existing test database to ensure clean state
  if (existsSync(testDbPath)) {
    rmSync(testDbPath)
    console.log('🗑️  Removed existing test database')
  }

  // Also remove any WAL or SHM files
  const walPath = testDbPath + '-wal'
  const shmPath = testDbPath + '-shm'
  if (existsSync(walPath)) rmSync(walPath)
  if (existsSync(shmPath)) rmSync(shmPath)

  try {
    // Option 1: Copy existing database if it exists
    if (existsSync(sourceDbPath)) {
      console.log('📋 Copying existing database for test environment...')
      copyFileSync(sourceDbPath, testDbPath)
      console.log('✅ Test database copied from existing database')
    } else {
      // Option 2: Create empty database file (server will initialize it)
      console.log('📝 Creating new test database file...')
      // Just create an empty file - the server will handle initialization
      writeFileSync(testDbPath, '')
      console.log('✅ Empty test database file created')
    }
    
    console.log('✅ Test database setup complete at:', testDbPath)
  } catch (error) {
    console.error('❌ Failed to setup test database:', error)
    throw error
  }

  return testDbPath
}

export async function cleanupTestDatabase() {
  const testDbPath = path.join(__dirname, '../../../database/data/playwright-test.db')
  
  if (existsSync(testDbPath)) {
    try {
      rmSync(testDbPath)
      console.log('🧹 Cleaned up test database')
    } catch (error) {
      console.warn('⚠️  Failed to cleanup test database:', error)
    }
  }
}