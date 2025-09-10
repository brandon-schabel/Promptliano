/**
 * Model Usage Logger
 * Provides clear, concise logging for AI model usage
 */

interface ModelUsageOptions {
  provider: string
  model: string
  temperature?: number | null
  maxTokens?: number | null
  topP?: number | null
  frequencyPenalty?: number | null
  presencePenalty?: number | null
  intelligenceLevel?: 'low' | 'medium' | 'high' | 'planning'
  mode?: 'chat' | 'text' | 'structured' | 'stream'
  customUrl?: string
}

/**
 * Format model settings for concise display
 */
function formatSettings(options: ModelUsageOptions): string {
  const parts: string[] = []

  // Add temperature if specified
  if (options.temperature !== null && options.temperature !== undefined) {
    parts.push(`temp: ${options.temperature}`)
  }

  // Add max tokens if specified
  if (options.maxTokens !== null && options.maxTokens !== undefined) {
    parts.push(`max: ${options.maxTokens.toLocaleString()}`)
  }

  // Add top-p if not default
  if (options.topP !== null && options.topP !== undefined && options.topP !== 1.0) {
    parts.push(`topP: ${options.topP}`)
  }

  // Add frequency penalty if not default
  if (options.frequencyPenalty !== null && options.frequencyPenalty !== undefined && options.frequencyPenalty !== 0) {
    parts.push(`freq: ${options.frequencyPenalty}`)
  }

  // Add presence penalty if not default
  if (options.presencePenalty !== null && options.presencePenalty !== undefined && options.presencePenalty !== 0) {
    parts.push(`pres: ${options.presencePenalty}`)
  }

  // Add mode
  if (options.mode) {
    parts.push(`mode: ${options.mode}`)
  }

  // Add intelligence level if specified
  if (options.intelligenceLevel) {
    parts.push(`intel: ${options.intelligenceLevel}`)
  }

  return parts.join(' | ')
}

/**
 * Format provider name for display
 */
function formatProvider(provider: string, customUrl?: string): string {
  // Handle custom providers
  if (provider.startsWith('custom_')) {
    if (customUrl) {
      // Extract domain from URL for cleaner display
      try {
        const url = new URL(customUrl)
        return `custom/${url.hostname}`
      } catch {
        return 'custom'
      }
    }
    return 'custom'
  }

  // Map provider names to cleaner display names
  const providerMap: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google_gemini: 'Gemini',
    groq: 'Groq',
    openrouter: 'OpenRouter',
    copilot: 'GitHub Copilot',
    lmstudio: 'LMStudio',
    ollama: 'Ollama',
    xai: 'XAI',
    together: 'Together',
    perplexity: 'Perplexity',
    mistral: 'Mistral',
    cohere: 'Cohere',
    fireworks: 'Fireworks'
  }

  return providerMap[provider] || provider
}

/**
 * Format model name for display (shorten if too long)
 */
function formatModel(model: string): string {
  // Remove common prefixes for cleaner display
  let cleanModel = model
    .replace('accounts/fireworks/models/', '')
    .replace('meta-llama/', '')
    .replace('google/', '')
    .replace('anthropic/', '')
    .replace('openai/', '')

  // Truncate if too long
  if (cleanModel.length > 40) {
    cleanModel = cleanModel.substring(0, 37) + '...'
  }

  return cleanModel
}

/**
 * Log model usage with clear, concise formatting
 */
export function logModelUsage(options: ModelUsageOptions): void {
  // Skip logging in test environment
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const provider = formatProvider(options.provider, options.customUrl)
  const model = formatModel(options.model)
  const settings = formatSettings(options)

  // Build the log message
  const logParts: string[] = ['🤖 AI Model:', `${provider}/${model}`]

  if (settings) {
    logParts.push('|', settings)
  }

  // Use console.log with a distinct color for visibility
  console.log('\x1b[36m%s\x1b[0m', logParts.join(' '))
}

/**
 * Log model error with clear formatting
 */
export function logModelError(provider: string, model: string, error: any): void {
  // Skip logging in test environment
  if (process.env.NODE_ENV === 'test') {
    return
  }

  const errorMessage = error?.message || error?.toString() || 'Unknown error'
  const providerName = formatProvider(provider)
  const modelName = formatModel(model)

  console.error('\x1b[31m%s\x1b[0m', `❌ AI Model Error: ${providerName}/${modelName} | ${errorMessage}`)
}

/**
 * Log model completion with usage stats
 */
export function logModelCompletion(
  provider: string,
  model: string,
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  },
  duration?: number
): void {
  // Skip logging in test environment or if debug is not enabled
  if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production') {
    return
  }

  const providerName = formatProvider(provider)
  const modelName = formatModel(model)

  const parts: string[] = ['✅ AI Complete:', `${providerName}/${modelName}`]

  if (usage?.totalTokens) {
    parts.push('|', `tokens: ${usage.totalTokens.toLocaleString()}`)
  }

  if (duration) {
    parts.push('|', `time: ${(duration / 1000).toFixed(2)}s`)
  }

  console.log('\x1b[32m%s\x1b[0m', parts.join(' '))
}
