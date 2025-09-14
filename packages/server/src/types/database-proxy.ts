// Minimal proxy for @promptliano/database to avoid pulling test-utils
// into the server TypeScript program during type checking.

// Core DB utils
export { db, rawDb, getDatabasePath } from '../../../database/src/db'

// Migrations and init scripts
export { runMigrations, createInitialSchema } from '../../../database/src/migrations/migrate'
export { initializeModelConfigs } from '../../../database/src/scripts/init-model-configs'

// Schemas and types used by server routes
export * from '../../../database/src/schema'

// Repositories used by server
export {
  processRunsRepository,
  processLogsRepository,
  processPortsRepository
} from '../../../database/src/repositories/process-repository'
export { mcpServerRepository } from '../../../database/src/repositories/mcp-server-repository'
