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
  const upstream = process?.env?.COPILOT_PROXY_UPSTREAM || process?.env?.COPILOT_UPSTREAM_URL
  // If an upstream is configured but no explicit base is set, default to the built-in proxy route
  if (!envBase && upstream) {
    const port = process?.env?.SERVER_PORT || '3147'
    const host = process?.env?.SERVER_HOST || process?.env?.HOST || '127.0.0.1'
    // Use localhost for most setups; SERVER_HOST may be 0.0.0.0 which is not ideal for clients
    const clientHost = host === '0.0.0.0' ? '127.0.0.1' : host
    return `http://${clientHost}:${port}/api/proxy/copilot/v1`
  }
  return envBase || 'https://api.githubcopilot.com'
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
    baseURL: getEnvVar('LMSTUDIO_BASE_URL', 'http://192.168.1.38:1234/v1')
  }
}
