type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose'

type LoggerOptions = {
  maxLevel?: LogLevel
}

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  verbose: 4
}

const LOG_COLORS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  verbose: '\x1b[35m',
  reset: '\x1b[0m'
}

export interface Logger {
  error(message: string, error?: any): void
  warn(message: string, data?: any): void
  info(message: string, data?: any): void
  debug(message: string, data?: any): void
  verbose(message: string, data?: any): void
  setMaxLevel(level: LogLevel): void
  child(context: string): Logger
}

export const createLogger = (context?: string, options: LoggerOptions = {}): Logger => {
  // Closure-based state (no class overhead)
  let maxLevel = options.maxLevel

  const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel
  const baseLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info

  let currentLevel = maxLevel ? Math.min(baseLevel, LOG_LEVELS[maxLevel]) : baseLevel

  const shouldLog = (level: LogLevel): boolean => LOG_LEVELS[level] <= currentLevel

  const formatMessage = (level: LogLevel, message: string, data?: any): string => {
    const timestamp = new Date().toISOString()
    const prefix = context ? `[${context}]` : ''
    const dataStr = data ? ` ${JSON.stringify(data)}` : ''

    if (process.env.NODE_ENV === 'production') {
      return `${timestamp} ${level.toUpperCase()} ${prefix} ${message}${dataStr}`
    }

    const color = LOG_COLORS[level]
    return `${color}${timestamp} ${level.toUpperCase()} ${prefix} ${message}${dataStr}${LOG_COLORS.reset}`
  }

  return {
    error(message: string, error?: any): void {
      if (!shouldLog('error')) return
      const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error
      console.error(formatMessage('error', message, errorData))
    },

    warn(message: string, data?: any): void {
      if (!shouldLog('warn')) return
      console.warn(formatMessage('warn', message, data))
    },

    info(message: string, data?: any): void {
      if (!shouldLog('info')) return
      console.log(formatMessage('info', message, data))
    },

    debug(message: string, data?: any): void {
      if (!shouldLog('debug')) return
      console.log(formatMessage('debug', message, data))
    },

    verbose(message: string, data?: any): void {
      if (!shouldLog('verbose')) return
      console.log(formatMessage('verbose', message, data))
    },

    setMaxLevel(level: LogLevel): void {
      maxLevel = level
      currentLevel = maxLevel ? Math.min(baseLevel, LOG_LEVELS[maxLevel]) : baseLevel
    },

    child(childContext: string): Logger {
      const newContext = context ? `${context}:${childContext}` : childContext
      return createLogger(newContext, { maxLevel })
    }
  }
}

// Default logger instance
export const logger = createLogger()