import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: ['./src/schema.ts', './src/schema/mcp-executions.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/promptliano.db'
  },
  verbose: true,
  strict: true
})
