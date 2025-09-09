// Default to IPv4 loopback to avoid IPv6 (::1) resolution issues on some systems
export const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
export const LMSTUDIO_BASE_URL = 'http://localhost:1234/v1'
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const OPENAI_BASE_URL = 'https://api.openai.com/v1'
// Allow overriding Copilot base URL to support local OpenAI-compatible proxies (e.g., copilot-api)
export const COPILOT_BASE_URL =
  (typeof process !== 'undefined' && process?.env?.COPILOT_BASE_URL) || 'https://api.githubcopilot.com'
export const XAI_BASE_URL = 'https://api.x.ai/v1'
export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
export const TOGETHER_BASE_URL = 'https://api.together.xyz/v1'
