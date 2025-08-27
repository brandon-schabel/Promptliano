import { createErrorResponseSchema, standardErrorResponses } from './error-response-factory'
import { z } from '@hono/zod-openapi'

// Domain-specific errors
export const domainErrorResponses = {
  // Project errors
  PROJECT_NOT_FOUND: createErrorResponseSchema('PROJECT_NOT_FOUND', 'Project not found'),
  PROJECT_PATH_EXISTS: createErrorResponseSchema('PROJECT_PATH_EXISTS', 'Project path already exists'),
  PROJECT_SYNC_FAILED: createErrorResponseSchema('PROJECT_SYNC_FAILED', 'Project sync failed', {
    includeDetails: true
  }),
  PROJECT_INVALID_PATH: createErrorResponseSchema('PROJECT_INVALID_PATH', 'Invalid project path'),
  
  // Git errors
  GIT_NOT_INITIALIZED: createErrorResponseSchema('GIT_NOT_INITIALIZED', 'Git repository not initialized'),
  GIT_MERGE_CONFLICT: createErrorResponseSchema('GIT_MERGE_CONFLICT', 'Merge conflict detected', {
    includeDetails: true
  }),
  GIT_PUSH_REJECTED: createErrorResponseSchema('GIT_PUSH_REJECTED', 'Push rejected by remote'),
  GIT_UNCOMMITTED_CHANGES: createErrorResponseSchema('GIT_UNCOMMITTED_CHANGES', 'Uncommitted changes present'),
  GIT_BRANCH_NOT_FOUND: createErrorResponseSchema('GIT_BRANCH_NOT_FOUND', 'Git branch not found'),
  
  // AI/Provider errors
  PROVIDER_NOT_CONFIGURED: createErrorResponseSchema('PROVIDER_NOT_CONFIGURED', 'Provider not configured'),
  API_KEY_INVALID: createErrorResponseSchema('API_KEY_INVALID', 'Invalid API key'),
  RATE_LIMIT_EXCEEDED: createErrorResponseSchema('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded', {
    includeDetails: true,
    includeTimestamp: true
  }),
  MODEL_NOT_AVAILABLE: createErrorResponseSchema('MODEL_NOT_AVAILABLE', 'Model not available'),
  CONTEXT_LENGTH_EXCEEDED: createErrorResponseSchema('CONTEXT_LENGTH_EXCEEDED', 'Context length exceeded'),
  
  // File operation errors
  FILE_TOO_LARGE: createErrorResponseSchema('FILE_TOO_LARGE', 'File exceeds maximum size'),
  FILE_NOT_FOUND: createErrorResponseSchema('FILE_NOT_FOUND', 'File not found'),
  PERMISSION_DENIED: createErrorResponseSchema('PERMISSION_DENIED', 'File permission denied'),
  UNSUPPORTED_FILE_TYPE: createErrorResponseSchema('UNSUPPORTED_FILE_TYPE', 'Unsupported file type'),
  
  // Queue/Task errors
  QUEUE_FULL: createErrorResponseSchema('QUEUE_FULL', 'Queue is at maximum capacity'),
  TASK_TIMEOUT: createErrorResponseSchema('TASK_TIMEOUT', 'Task execution timeout'),
  TASK_CANCELLED: createErrorResponseSchema('TASK_CANCELLED', 'Task was cancelled'),
  QUEUE_NOT_FOUND: createErrorResponseSchema('QUEUE_NOT_FOUND', 'Queue not found'),
  
  // Database errors
  DATABASE_CONNECTION_FAILED: createErrorResponseSchema('DATABASE_CONNECTION_FAILED', 'Database connection failed'),
  TRANSACTION_FAILED: createErrorResponseSchema('TRANSACTION_FAILED', 'Transaction failed', {
    includeDetails: true
  }),
  CONSTRAINT_VIOLATION: createErrorResponseSchema('CONSTRAINT_VIOLATION', 'Database constraint violation'),
  
  // MCP errors
  MCP_TOOL_NOT_FOUND: createErrorResponseSchema('MCP_TOOL_NOT_FOUND', 'MCP tool not found'),
  MCP_EXECUTION_FAILED: createErrorResponseSchema('MCP_EXECUTION_FAILED', 'MCP execution failed', {
    includeDetails: true
  }),
  MCP_INVALID_ARGUMENTS: createErrorResponseSchema('MCP_INVALID_ARGUMENTS', 'Invalid MCP arguments'),
  
  // Chat/Message errors
  CHAT_NOT_FOUND: createErrorResponseSchema('CHAT_NOT_FOUND', 'Chat not found'),
  MESSAGE_TOO_LONG: createErrorResponseSchema('MESSAGE_TOO_LONG', 'Message exceeds maximum length'),
  
  // Ticket errors
  TICKET_NOT_FOUND: createErrorResponseSchema('TICKET_NOT_FOUND', 'Ticket not found'),
  TICKET_ALREADY_CLOSED: createErrorResponseSchema('TICKET_ALREADY_CLOSED', 'Ticket is already closed'),
  
  // Command errors
  COMMAND_NOT_FOUND: createErrorResponseSchema('COMMAND_NOT_FOUND', 'Command not found'),
  COMMAND_EXECUTION_FAILED: createErrorResponseSchema('COMMAND_EXECUTION_FAILED', 'Command execution failed', {
    includeDetails: true
  }),
  
  // Agent errors
  AGENT_NOT_FOUND: createErrorResponseSchema('AGENT_NOT_FOUND', 'Agent not found'),
  AGENT_BUSY: createErrorResponseSchema('AGENT_BUSY', 'Agent is currently busy'),
  
  // Hook errors
  HOOK_NOT_FOUND: createErrorResponseSchema('HOOK_NOT_FOUND', 'Hook not found'),
  HOOK_EXECUTION_FAILED: createErrorResponseSchema('HOOK_EXECUTION_FAILED', 'Hook execution failed', {
    includeDetails: true
  })
}

// Combine all error responses
export const allErrorResponses = {
  ...standardErrorResponses,
  ...domainErrorResponses
}

// Helper to get error response for routes
export function getErrorResponses(...errorCodes: Array<keyof typeof allErrorResponses>) {
  const responses: Record<number, any> = {}
  
  errorCodes.forEach(code => {
    const error = allErrorResponses[code]
    if (error) {
      // Map error codes to HTTP status codes
      const statusCode = getStatusCodeForError(code as string)
      responses[statusCode] = {
        content: {
          'application/json': {
            schema: error
          }
        },
        description: (error._def.openapi as any)?.description || 'Error response'
      }
    }
  })
  
  return responses
}

function getStatusCodeForError(code: string): number {
  const statusMap: Record<string, number> = {
    // 400 Bad Request
    BAD_REQUEST: 400,
    FILE_TOO_LARGE: 400,
    MESSAGE_TOO_LONG: 400,
    UNSUPPORTED_FILE_TYPE: 400,
    MCP_INVALID_ARGUMENTS: 400,
    PROJECT_INVALID_PATH: 400,
    
    // 401 Unauthorized
    UNAUTHORIZED: 401,
    API_KEY_INVALID: 401,
    
    // 403 Forbidden
    FORBIDDEN: 403,
    PERMISSION_DENIED: 403,
    
    // 404 Not Found
    NOT_FOUND: 404,
    PROJECT_NOT_FOUND: 404,
    FILE_NOT_FOUND: 404,
    CHAT_NOT_FOUND: 404,
    TICKET_NOT_FOUND: 404,
    COMMAND_NOT_FOUND: 404,
    AGENT_NOT_FOUND: 404,
    HOOK_NOT_FOUND: 404,
    QUEUE_NOT_FOUND: 404,
    MCP_TOOL_NOT_FOUND: 404,
    GIT_BRANCH_NOT_FOUND: 404,
    
    // 409 Conflict
    CONFLICT: 409,
    PROJECT_PATH_EXISTS: 409,
    GIT_MERGE_CONFLICT: 409,
    GIT_UNCOMMITTED_CHANGES: 409,
    TICKET_ALREADY_CLOSED: 409,
    CONSTRAINT_VIOLATION: 409,
    
    // 422 Unprocessable Entity
    VALIDATION_ERROR: 422,
    
    // 423 Locked
    AGENT_BUSY: 423,
    
    // 429 Too Many Requests
    RATE_LIMITED: 429,
    RATE_LIMIT_EXCEEDED: 429,
    
    // 500 Internal Server Error
    INTERNAL_ERROR: 500,
    PROJECT_SYNC_FAILED: 500,
    DATABASE_CONNECTION_FAILED: 500,
    TRANSACTION_FAILED: 500,
    COMMAND_EXECUTION_FAILED: 500,
    MCP_EXECUTION_FAILED: 500,
    HOOK_EXECUTION_FAILED: 500,
    GIT_NOT_INITIALIZED: 500,
    GIT_PUSH_REJECTED: 500,
    
    // 502 Bad Gateway
    BAD_GATEWAY: 502,
    PROVIDER_NOT_CONFIGURED: 502,
    MODEL_NOT_AVAILABLE: 502,
    
    // 503 Service Unavailable
    SERVICE_UNAVAILABLE: 503,
    QUEUE_FULL: 503,
    
    // 504 Gateway Timeout
    TASK_TIMEOUT: 504,
    
    // 507 Insufficient Storage
    CONTEXT_LENGTH_EXCEEDED: 507,
    
    // Custom codes (default to 500)
    TASK_CANCELLED: 499 // Client closed request
  }
  
  return statusMap[code] || 500
}

/**
 * Creates standard error responses for a route
 */
export function createStandardErrorResponses(
  additionalErrors: Array<keyof typeof domainErrorResponses> = []
) {
  const defaultErrors = [400, 401, 404, 422, 500] as Array<keyof typeof standardErrorResponses>
  return getErrorResponses(...defaultErrors, ...additionalErrors)
}

/**
 * Type-safe error response helper
 */
export type ErrorCode = keyof typeof allErrorResponses

export function createErrorResponse(code: ErrorCode) {
  return allErrorResponses[code]
}

/**
 * Create a custom domain error
 */
export function createCustomDomainError(
  code: string,
  message: string,
  statusCode: number = 500
) {
  const error = createErrorResponseSchema(code, message)
  
  // Store for mapping
  ;(getStatusCodeForError as any).__customMappings = (getStatusCodeForError as any).__customMappings || {}
  ;(getStatusCodeForError as any).__customMappings[code] = statusCode
  
  return error
}