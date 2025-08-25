// Database utilities for services package
import { db } from '@promptliano/database'
import type { Database } from 'bun:sqlite'

// Export database instance for direct queries in tests
export { db }

// Reset database function for tests (TODO: Implement proper reset for Drizzle)
export async function resetDatabase(): Promise<void> {
  // TODO: Implement database reset for Drizzle ORM
  console.warn('Database reset not yet implemented for Drizzle ORM')
}
