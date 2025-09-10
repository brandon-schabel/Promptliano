// Default to IPv4 loopback to avoid IPv6 (::1) resolution issues on some systems
export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
export const LMSTUDIO_BASE_URL = 'http://localhost:1234/v1'
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENAI_BASE_URL = 'https://api.openai.com/v1'

// Compute Copilot base URL with preference for built-in proxy (embedded) by default
function computeCopilotBaseUrl(): string {
  const hasProcess = typeof process !== 'undefined'
  const env = (hasProcess ? (process.env as Record<string, string | undefined>) : {}) || {}

  // Explicitly set base URL wins
  if (env.COPILOT_BASE_URL) return env.COPILOT_BASE_URL.replace(/\/$/, '')

  // If embed is enabled (default true) or an upstream is configured, point to built-in reverse proxy route
  const embedFlag = env.COPILOT_EMBED_ENABLED
  const embedEnabled = embedFlag === undefined ? true : String(embedFlag).toLowerCase() === 'true'
  const hasUpstream = !!(env.COPILOT_PROXY_UPSTREAM || env.COPILOT_UPSTREAM_URL)
  if (embedEnabled || hasUpstream) {
    const port = env.SERVER_PORT || '3147'
    const host = env.SERVER_HOST || env.HOST || '127.0.0.1'
    const clientHost = host === '0.0.0.0' ? '127.0.0.1' : host
    return `http://${clientHost}:${port}/api/proxy/copilot/v1`
  }

  // Fallback to GitHub Copilot API
  return 'https://api.githubcopilot.com'
}

export const COPILOT_BASE_URL = computeCopilotBaseUrl()
export const XAI_BASE_URL = 'https://api.x.ai/v1'
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
export const TOGETHER_BASE_URL = 'https://api.together.xyz/v1'
