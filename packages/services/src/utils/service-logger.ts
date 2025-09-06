/**
 * Service Logger Utility
 * Provides consistent logging interface for services
 */

export interface ServiceLogger {
  info: (message: string, data?: any) => void
  warn: (message: string, data?: any) => void
  error: (message: string, error?: any, data?: any) => void
  debug: (message: string, data?: any) => void
}

/**
 * Create a service logger instance
 * Currently uses console logging, can be extended with external logging services
 */
export function createServiceLogger(serviceName: string): ServiceLogger {
  const prefix = `[${serviceName}]`

  return {
    info: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`${prefix} ${message}`, data || '')
      }
    },
    
    warn: (message: string, data?: any) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`${prefix} ${message}`, data || '')
      }
    },
    
    error: (message: string, error?: any, data?: any) => {
      if (process.env.NODE_ENV !== 'test') {
        console.error(`${prefix} ${message}`, error, data || '')
      }
    },
    
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(`${prefix} ${message}`, data || '')
      }
    }
  }
}

/**
 * Null logger for testing or when logging is disabled
 */
export const nullLogger: ServiceLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {}
}