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

class Logger {
  private context?: string
  private currentLevel: number
  private maxLevel?: LogLevel

  constructor(context?: string, options: LoggerOptions = {}) {
    this.context = context
    this.maxLevel = options.maxLevel

    const envLevel = (process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as LogLevel
    this.currentLevel = LOG_LEVELS[envLevel] ?? LOG_LEVELS.info

    this.applyMaxLevel()
  }

  private applyMaxLevel(): void {
    if (!this.maxLevel) {
      return
    }

    const cap = LOG_LEVELS[this.maxLevel]
    if (cap === undefined) {
      return
    }

    this.currentLevel = Math.min(this.currentLevel, cap)
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= this.currentLevel
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const prefix = this.context ? `[${this.context}]` : ''
    const dataStr = data ? ` ${JSON.stringify(data)}` : ''

    if (process.env.NODE_ENV === 'production') {
      return `${timestamp} ${level.toUpperCase()} ${prefix} ${message}${dataStr}`
    }

    const color = LOG_COLORS[level]
    return `${color}${timestamp} ${level.toUpperCase()} ${prefix} ${message}${dataStr}${LOG_COLORS.reset}`
  }

  error(message: string, error?: any): void {
    if (!this.shouldLog('error')) return
    const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error
    console.error(this.formatMessage('error', message, errorData))
  }

  warn(message: string, data?: any): void {
    if (!this.shouldLog('warn')) return
    console.warn(this.formatMessage('warn', message, data))
  }

  info(message: string, data?: any): void {
    if (!this.shouldLog('info')) return
    console.log(this.formatMessage('info', message, data))
  }

  debug(message: string, data?: any): void {
    if (!this.shouldLog('debug')) return
    console.log(this.formatMessage('debug', message, data))
  }

  verbose(message: string, data?: any): void {
    if (!this.shouldLog('verbose')) return
    console.log(this.formatMessage('verbose', message, data))
  }

  setMaxLevel(level: LogLevel): void {
    this.maxLevel = level
    this.applyMaxLevel()
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context
    return new Logger(childContext, { maxLevel: this.maxLevel })
  }
}

export const createLogger = (context?: string, options?: LoggerOptions) => new Logger(context, options)

// Default logger instance
export const logger = createLogger()
