// Entry point for the stdio MCP server used by CLI and inspector tooling
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { runMigrations, initializeModelConfigs, getDatabasePath } from '@promptliano/database'
import { createMCPServer } from './mcp/server'

const server = createMCPServer()

async function main() {
  try {
    const earlyDbPath = getDatabasePath()
    console.error(`Database location (pre-migration): ${earlyDbPath === ':memory:' ? 'in-memory' : earlyDbPath}`)

    await runMigrations()
    const initResult = await initializeModelConfigs()
    switch (initResult.status) {
      case 'seeded':
        console.error(
          `Model presets seeded (${initResult.configsInserted} configs, ${initResult.presetsInserted} presets)`
        )
        break
      case 'skipped_existing':
        console.error('Model presets present; skipping seeding')
        break
      case 'skipped_missing_tables':
        console.error(`Model presets skipped: ${initResult.reason}`)
        break
      case 'skipped_error':
        console.error(`Model presets initialization failed: ${initResult.reason}`)
        break
    }

    const dbPath = getDatabasePath()
    console.error(`Database ready at ${dbPath === ':memory:' ? 'in-memory' : dbPath}`)
  } catch (e) {
    console.error('Database migration failed for MCP stdio server:', e)
    process.exit(1)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Promptliano MCP server running on stdio')
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
