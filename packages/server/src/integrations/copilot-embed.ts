import fs from 'node:fs/promises'
import path from 'node:path'

// Copilot API internals (embedded)
// We import directly from the workspace package source to reuse its logic
// and shared state. These paths are stable within this monorepo structure.
import { PATHS, ensurePaths } from '../../../copilot-api/src/lib/paths'
import { cacheVSCodeVersion, cacheModels } from '../../../copilot-api/src/lib/utils'
import { state as copilotState } from '../../../copilot-api/src/lib/state'
import { setupCopilotToken } from '../../../copilot-api/src/lib/token'
import { server as copilotHonoApp } from '../../../copilot-api/src/server'

export type CopilotEmbedConfig = {
  enabled: boolean
  accountType: 'individual' | 'business' | 'enterprise'
  rateLimitSeconds?: number
  rateLimitWait: boolean
  manualApprove: boolean
  showTokens: boolean
  serverHost: string
  serverPort: string
}

// Pure function for testing and reuse
export function parseCopilotEmbedConfig(env: Record<string, string | undefined>): CopilotEmbedConfig {
  const enabled = String(env.COPILOT_EMBED_ENABLED || '').toLowerCase() === 'true'
  const accountTypeRaw = (env.COPILOT_ACCOUNT_TYPE || 'individual').toLowerCase()
  const accountType = ['individual', 'business', 'enterprise'].includes(accountTypeRaw)
    ? (accountTypeRaw as 'individual' | 'business' | 'enterprise')
    : 'individual'

  const toBool = (v: string | undefined, def = false) =>
    typeof v === 'string' ? ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()) : def

  const toInt = (v: string | undefined) => {
    if (!v) return undefined
    const n = Number.parseInt(v, 10)
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }

  return {
    enabled,
    accountType,
    rateLimitSeconds: toInt(env.COPILOT_RATE_LIMIT_SECONDS),
    rateLimitWait: toBool(env.COPILOT_RATE_LIMIT_WAIT, false),
    manualApprove: toBool(env.COPILOT_MANUAL_APPROVE, false),
    showTokens: toBool(env.COPILOT_SHOW_TOKENS, false),
    serverHost: env.SERVER_HOST || env.HOST || '127.0.0.1',
    serverPort: env.SERVER_PORT || '3147'
  }
}

// Initialize embedded copilot-api state and return the Hono sub-app to mount.
// This does NOT block on device-flow auth; it will attempt to reuse an existing
// GitHub token if available and start the Copilot token refresh loop.
export async function initCopilotEmbed(config: CopilotEmbedConfig) {
  // Apply flags to shared copilot-api state
  copilotState.accountType = config.accountType
  copilotState.manualApprove = config.manualApprove
  copilotState.rateLimitSeconds = config.rateLimitSeconds
  copilotState.rateLimitWait = config.rateLimitWait
  copilotState.showToken = config.showTokens

  // Prepare filesystem paths and cache VS Code version
  await ensurePaths()
  await cacheVSCodeVersion()

  // Try to reuse an existing GitHub token if present, then start Copilot token refresh
  try {
    const ghTokenPath = PATHS.GITHUB_TOKEN_PATH
    const content = await fs.readFile(ghTokenPath, 'utf8')
    const token = content?.trim()
    if (token) {
      copilotState.githubToken = token
      // Will fetch Copilot token and schedule refresh interval
      await setupCopilotToken()
      // Preload models in the background
      cacheModels().catch(() => {})
    }
  } catch {
    // No existing token; auth will be handled via UI endpoints
  }

  // Return the embedded Hono router to be mounted under /api/upstream/copilot
  return copilotHonoApp
}

// Helper to compute the internal upstream base for the reverse proxy
export function getEmbeddedUpstreamBase(config?: Partial<CopilotEmbedConfig>) {
  const host = config?.serverHost || process.env.SERVER_HOST || process.env.HOST || '127.0.0.1'
  const clientHost = host === '0.0.0.0' ? '127.0.0.1' : host
  const port = config?.serverPort || process.env.SERVER_PORT || '3147'
  return `http://${clientHost}:${port}/api/upstream/copilot/v1`
}
