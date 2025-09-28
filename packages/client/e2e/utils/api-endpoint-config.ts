/**
 * API Endpoint Configuration for E2E Tests
 *
 * This file defines the correct API endpoints used by the server
 * to ensure tests use the proper paths and avoid hardcoded assumptions.
 */

export const API_ENDPOINTS = {
  // Core CRUD operations (Generated routes - these follow /api/{entity} pattern)
  PROJECTS: {
    BASE: '/api/projects',
    BY_ID: (id: number) => `/api/projects/${id}`,
    SYNC: (id: number) => `/api/projects/${id}/sync`,
    FILES: (id: number) => `/api/projects/${id}/files`
  },

  TICKETS: {
    BASE: '/api/tickets',
    BY_ID: (id: number) => `/api/tickets/${id}`,
    TASKS: (id: number) => `/api/tickets/${id}/tasks`
  },

  PROMPTS: {
    BASE: '/api/prompts',
    BY_ID: (id: number) => `/api/prompts/${id}`
  },

  QUEUES: {
    BASE: '/api/queues', // Generated route
    BY_ID: (id: number) => `/api/queues/${id}`,
    PROCESS: (id: number) => `/api/queues/${id}/process`
  },

  // AI endpoints (Manual routes - different pattern)
  AI: {
    CHAT: '/api/chat',
    GENERATE_TEXT: '/api/ai/generate/text',
    STREAM: '/api/gen-ai/stream',
    STRUCTURED: '/api/gen-ai/structured'
  },

  // File operations
  FILES: {
    BASE: '/api/files',
    BY_ID: (id: string) => `/api/files/${id}`,
    CONTENT: (id: string) => `/api/files/content/${id}`,
    UPLOAD: '/api/files/upload',
    SEARCH: '/api/files/search'
  },

  // Flow operations (Manual routes)
  FLOW: {
    ENQUEUE_TICKET: (ticketId: number) => `/api/flow/tickets/${ticketId}/enqueue`,
    DEQUEUE_TICKET: (ticketId: number) => `/api/flow/tickets/${ticketId}/dequeue`,
    ENQUEUE_TASK: (taskId: number) => `/api/flow/tasks/${taskId}/enqueue`,
    DEQUEUE_TASK: (taskId: number) => `/api/flow/tasks/${taskId}/dequeue`,
    PROCESS_FAIL: '/api/flow/process/fail'
  },

  // Git operations
  GIT: {
    STATUS: (projectId: number) => `/api/projects/${projectId}/git/status`,
    BRANCHES: (projectId: number) => `/api/projects/${projectId}/git/branches`,
    COMMIT: (projectId: number) => `/api/projects/${projectId}/git/commit`,
    STASH: (projectId: number) => `/api/projects/${projectId}/git/stash`
  },

  // MCP operations
  MCP: {
    SESSION: '/api/mcp/sessions',
    EXECUTE: '/api/mcp/execute',
    TEST: '/api/mcp/test',
    CONFIG: '/api/mcp/config'
  }
} as const

/**
 * Common HTTP status codes used in API responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500
} as const

/**
 * Standard API response patterns for validation
 */
export const API_PATTERNS = {
  SUCCESS_RESPONSE: {
    success: true,
    data: {} // Will contain response data
  },
  ERROR_RESPONSE: {
    success: false,
    error: '' // Will contain error message
  },
  OPERATION_SUCCESS: {
    success: true
  }
} as const

/**
 * Helper to validate API response patterns
 */
export function validateAPIResponse(response: any, pattern: keyof typeof API_PATTERNS): boolean {
  const expectedPattern = API_PATTERNS[pattern]

  if (pattern === 'SUCCESS_RESPONSE') {
    return response.success === true && typeof response.data === 'object'
  }

  if (pattern === 'ERROR_RESPONSE') {
    return response.success === false && typeof response.error === 'string'
  }

  if (pattern === 'OPERATION_SUCCESS') {
    return response.success === true
  }

  return false
}

/**
 * Mapping of test endpoints to actual server endpoints
 * Helps identify and fix endpoint assumption mismatches
 */
export const ENDPOINT_CORRECTIONS = {
  // AI endpoint corrections
  '/api/chat/completions': API_ENDPOINTS.AI.CHAT,
  '/api/chat/completion': API_ENDPOINTS.AI.CHAT,

  // Queue endpoint corrections
  '/api/queue/process': API_ENDPOINTS.FLOW.PROCESS_FAIL,
  '/api/queues/*/process': (queueId: number) => API_ENDPOINTS.QUEUES.PROCESS(queueId)
} as const

/**
 * Get the correct API endpoint for a given test assumption
 */
export function getCorrectedEndpoint(assumedEndpoint: string): string {
  const correction = ENDPOINT_CORRECTIONS[assumedEndpoint as keyof typeof ENDPOINT_CORRECTIONS]
  if (typeof correction === 'function') {
    // This needs to be handled case-by-case in tests
    console.warn(`Endpoint ${assumedEndpoint} requires parameters. Use API_ENDPOINTS directly.`)
    return assumedEndpoint
  }
  return correction || assumedEndpoint
}

/**
 * Validate that an endpoint follows the expected server pattern
 */
export function isValidEndpoint(endpoint: string): boolean {
  // Generated routes follow /api/{entity} pattern
  const generatedRoutePattern = /^\/api\/(projects|tickets|prompts|queues|chats|files)(\/.+)?$/

  // Manual routes have specific known patterns
  const manualRoutePatterns = [
    /^\/api\/ai\/.+$/,
    /^\/api\/gen-ai\/.+$/,
    /^\/api\/flow\/.+$/,
    /^\/api\/mcp\/.+$/,
    /^\/api\/git\/.+$/
  ]

  return generatedRoutePattern.test(endpoint) || manualRoutePatterns.some((pattern) => pattern.test(endpoint))
}
