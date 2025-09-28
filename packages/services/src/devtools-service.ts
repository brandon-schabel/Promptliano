import { constants } from 'node:fs'
import { access, readFile, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServiceLogger } from './core/base-service'
import { McpInspectorSessionSchema, type McpInspectorSession } from '@promptliano/schemas/src/devtools.schemas'

type SessionFileInfo = {
  token: string | null
  path: string
  updatedAt: number | null
}

const logger = createServiceLogger('DevtoolsService')

const DEFAULT_SESSION_FILENAMES = [
  '.mcp-inspector.session.json',
  'mcp-inspector.session.json',
  '.mcp-inspector-session.json'
]

const DEFAULT_HOME_RELATIVE_PATHS = [
  path.join('.promptliano', 'mcp-inspector', 'session.json'),
  path.join('.config', 'mcp-inspector', 'session.json'),
  path.join('.cache', 'mcp-inspector', 'session.json'),
  path.join('.mcp-inspector', 'session.json')
]

function getCandidateSessionFiles(): string[] {
  const candidates = new Set<string>()
  const explicit = process.env.MCP_INSPECTOR_SESSION_FILE
  if (explicit && explicit.trim().length > 0) {
    candidates.add(path.resolve(explicit))
  }

  const cwd = process.cwd()
  for (const filename of DEFAULT_SESSION_FILENAMES) {
    candidates.add(path.resolve(cwd, filename))
  }

  const home = os.homedir()
  for (const relativePath of DEFAULT_HOME_RELATIVE_PATHS) {
    candidates.add(path.resolve(home, relativePath))
  }

  return Array.from(candidates)
}

function extractToken(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const record = data as Record<string, unknown>
  const potentialValues: unknown[] = [
    record.token,
    record.sessionToken,
    record.sessionId,
    record.authToken
  ]

  if (record.session && typeof record.session === 'object') {
    const sessionRecord = record.session as Record<string, unknown>
    potentialValues.push(sessionRecord.token, sessionRecord.sessionToken, sessionRecord.id)
  }

  for (const value of potentialValues) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        return trimmed
      }
    }
  }

  return null
}

async function readSessionFile(filePath: string): Promise<SessionFileInfo | null> {
  try {
    await access(filePath, constants.R_OK)
  } catch {
    return null
  }

  try {
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const token = extractToken(parsed)
    const stats = await stat(filePath)

    return {
      token,
      path: filePath,
      updatedAt: Number.isFinite(stats.mtimeMs) ? stats.mtimeMs : null
    }
  } catch (error) {
    logger.warn('Unable to read MCP Inspector session file', { filePath, error })
    return null
  }
}

function resolvePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }
  return fallback
}

export async function getMcpInspectorSession(): Promise<McpInspectorSession> {
  const enabled = String(process.env.DEVTOOLS_ENABLE_MCP_INSPECTOR ?? 'false').toLowerCase() === 'true'
  const clientPort = resolvePort(process.env.MCP_INSPECTOR_CLIENT_PORT ?? process.env.CLIENT_PORT, 6274)
  const proxyPort = resolvePort(process.env.MCP_INSPECTOR_SERVER_PORT, 6277)

  let sessionToken: string | null = null
  let sessionFilePath: string | null = null
  let lastUpdated: number | null = null

  if (enabled) {
    const candidates = getCandidateSessionFiles()
    for (const candidate of candidates) {
      const sessionInfo = await readSessionFile(candidate)
      if (!sessionInfo) {
        continue
      }

      sessionFilePath = sessionInfo.path
      lastUpdated = sessionInfo.updatedAt ?? lastUpdated

      if (sessionInfo.token) {
        sessionToken = sessionInfo.token
        break
      }
    }
  }

  const result = {
    enabled,
    sessionToken,
    clientUrl: enabled ? `http://localhost:${clientPort}` : null,
    proxyUrl: enabled ? `http://localhost:${proxyPort}` : null,
    sessionFilePath,
    lastUpdated
  }

  return McpInspectorSessionSchema.parse(result)
}
