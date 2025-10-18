// Time constants (in milliseconds)
export const TICKETS_STALE_TIME = 30 * 1000 // 30 seconds
export const QUEUE_REFETCH_INTERVAL = 5000 // 5 seconds
export const RETRY_MAX_ATTEMPTS = 2
export const RETRY_MAX_DELAY = 30000 // 30 seconds

// UI constants
export const TICKET_LIST_MIN_WIDTH = 300
export const TICKET_LIST_MAX_WIDTH = 400
export const QUEUE_SIDEBAR_WIDTH = 64
export const FLOW_SIDEBAR_WIDTH = 256

// Queue constants
export const MAX_PARALLEL_ITEMS_DEFAULT = 1
export const MAX_PARALLEL_ITEMS_MAX = 10
export const QUEUE_PRIORITY_DEFAULT = 0

// Drag and drop constants
export const DRAG_OVERLAY_OPACITY = 0.5
export const DRAG_ANIMATION_DURATION = 200

// Error messages
export const GENERIC_ERROR_MESSAGE = 'An error occurred. Please try again.'
export const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection.'
export const NOT_FOUND_ERROR_MESSAGE = 'The requested resource was not found.'

// ============================================================================
// POLLING CONFIGURATION - Intelligent polling with exponential backoff
// ============================================================================

/**
 * Polling Configuration
 * Controls intelligent polling behavior with exponential backoff for error recovery
 */
export const POLLING_CONFIG = {
  /** Base polling interval in milliseconds (5 seconds) */
  BASE_INTERVAL_MS: 5000,

  /** Maximum polling interval in milliseconds (30 seconds) */
  MAX_INTERVAL_MS: 30000,

  /** Minimum polling interval to prevent excessive requests */
  MIN_INTERVAL_MS: 3000,

  /** Multiplier for exponential backoff on errors */
  ERROR_BACKOFF_MULTIPLIER: 2,

  /** Random jitter to add to backoff (prevents thundering herd) */
  JITTER_MS: 1000,

  /** Maximum number of retries before giving up */
  MAX_RETRIES: 3,

  /** Retry delay for mutations (1 second base) */
  RETRY_DELAY_BASE_MS: 1000,

  /** Maximum retry delay (10 seconds) */
  RETRY_DELAY_MAX_MS: 10000
} as const

/**
 * Metadata Configuration
 * Configuration for research crawl metadata tracking
 */
export const METADATA_CONFIG = {
  /** Maximum number of links to keep in timeline */
  MAX_TIMELINE_LINKS: 100,

  /** Maximum size of error log */
  MAX_ERROR_LOG_SIZE: 50,

  /** Update progress every N pages */
  PROGRESS_UPDATE_INTERVAL: 10
} as const
