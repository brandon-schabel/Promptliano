import type { ProviderConfig } from '../types'

// Check if we're in a browser environment
const isBrowser = typeof globalThis !== 'undefined' && 'window' in globalThis

// Safe environment variable access
const getEnvVar = (key: string, defaultValue: string): string => {
  if (isBrowser) {
    return defaultValue
  }
  return process?.env?.[key] || defaultValue
}

// Compute Copilot base URL with support for built-in reverse proxy
const computeCopilotBaseURL = (): string => {
  if (isBrowser) return 'https://api.githubcopilot.com'
  const envBase = process?.env?.COPILOT_BASE_URL
  if (envBase) return envBase.replace(/\/$/, '')

  const embedFlag = process?.env?.COPILOT_EMBED_ENABLED
  const embedEnabled = embedFlag === undefined ? true : String(embedFlag).toLowerCase() === 'true'
  const upstream = process?.env?.COPILOT_PROXY_UPSTREAM || process?.env?.COPILOT_UPSTREAM_URL

  // Prefer built-in proxy route by default when embedding is enabled or an upstream is configured
  if (embedEnabled || upstream) {
    const port = process?.env?.SERVER_PORT || '3147'
    const host = process?.env?.SERVER_HOST || process?.env?.HOST || '127.0.0.1'
    const clientHost = host === '0.0.0.0' ? '127.0.0.1' : host
    return `http://${clientHost}:${port}/api/proxy/copilot/v1`
  }

  return 'https://api.githubcopilot.com'
}

export const providersConfig: ProviderConfig = {
  openai: {
    baseURL: 'https://api.openai.com/v1'
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1'
  },
  google: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta'
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1'
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1'
  },
  copilot: {
    baseURL: computeCopilotBaseURL()
  },
  ollama: {
    baseURL: getEnvVar('OLLAMA_BASE_URL', 'http://localhost:11434')
  },
  lmstudio: {
    baseURL: getEnvVar('LMSTUDIO_BASE_URL', 'http://localhost:1234/v1')
  }
}
