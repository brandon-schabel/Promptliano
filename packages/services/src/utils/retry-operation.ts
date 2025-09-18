import { ApiError } from '@promptliano/shared'

export interface RetryOptions {
  maxAttempts?: number
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  backoffFactor?: number
  jitter?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delay: number) => void
  logger?: (message: string, error: unknown, attempt: number, delay: number, maxAttempts: number) => void
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_INITIAL_DELAY = 1000
const DEFAULT_MAX_DELAY = 10000
const DEFAULT_BACKOFF = 2

const RETRYABLE_NODE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'])

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const defaultShouldRetry = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return (
      error.code === 'RATE_LIMIT_EXCEEDED' ||
      error.code === 'PROVIDER_UNAVAILABLE' ||
      (typeof error.status === 'number' && error.status >= 500)
    )
  }

  const maybeError = error as { code?: string }
  if (maybeError && typeof maybeError.code === 'string') {
    return RETRYABLE_NODE_ERROR_CODES.has(maybeError.code)
  }

  return true
}

export async function retryOperation<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    initialDelay = DEFAULT_INITIAL_DELAY,
    maxDelay = DEFAULT_MAX_DELAY,
    backoffMultiplier,
    backoffFactor,
    jitter = 0,
    shouldRetry,
    onRetry,
    logger
  } = options

  const maxAttempts = resolveMaxAttempts(options)
  const backoff = Math.max(1, backoffMultiplier ?? backoffFactor ?? DEFAULT_BACKOFF)
  const shouldRetryFn: (error: unknown, attempt: number) => boolean =
    shouldRetry ?? ((error: unknown) => defaultShouldRetry(error))
  const log = logger ?? defaultLogger

  let attempt = 0
  let delay = Math.max(0, initialDelay)
  let lastError: unknown

  while (attempt < maxAttempts) {
    try {
      return await operation()
    } catch (error) {
      attempt += 1
      lastError = error

      const canRetry = attempt < maxAttempts && shouldRetryFn(error, attempt)
      if (!canRetry) {
        throw error
      }

      const waitTime = applyJitter(delay, jitter)
      log(
        `[RetryOperation] Attempt ${attempt}/${maxAttempts} failed. Retrying in ${waitTime}ms`,
        error,
        attempt,
        waitTime,
        maxAttempts
      )

      if (onRetry) {
        onRetry(error, attempt, waitTime)
      }

      if (waitTime > 0) {
        await sleep(waitTime)
      }

      delay = Math.min(Math.max(0, delay * backoff), maxDelay)
    }
  }

  throw lastError
}

function resolveMaxAttempts(options: RetryOptions): number {
  if (options.maxAttempts !== undefined) {
    if (options.maxAttempts < 1) {
      throw new Error('maxAttempts must be at least 1')
    }
    return options.maxAttempts
  }

  if (typeof options.maxRetries === 'number') {
    if (options.maxRetries < 0) {
      throw new Error('maxRetries cannot be negative')
    }
    return options.maxRetries + 1
  }

  return DEFAULT_MAX_ATTEMPTS
}

function applyJitter(delay: number, jitter: number): number {
  if (delay <= 0) return 0
  if (jitter <= 0) return Math.round(delay)
  const jitterOffset = (Math.random() - 0.5) * 2 * jitter * delay
  return Math.max(0, Math.round(delay + jitterOffset))
}

function defaultLogger(
  message: string,
  error: unknown,
  _attempt: number,
  _delay: number,
  _maxAttempts: number
): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  console.warn(`${message}: ${errorMessage}`)
}
