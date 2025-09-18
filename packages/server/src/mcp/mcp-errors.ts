import { ApiError } from '@promptliano/shared'
import type { MCPToolResponse } from './tools-registry'

export enum MCPErrorCode {
  MISSING_REQUIRED_PARAM = 'MISSING_REQUIRED_PARAM',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  SERVICE_ERROR = 'SERVICE_ERROR',
  OPERATION_FAILED = 'OPERATION_FAILED',
  UNKNOWN_ACTION = 'UNKNOWN_ACTION',
  INVALID_PARAMS = 'INVALID_PARAMS',
  PATH_TRAVERSAL_DENIED = 'PATH_TRAVERSAL_DENIED'
}

export type MCPErrorContext = Record<string, unknown>

const DEFAULT_SUGGESTIONS: Partial<Record<MCPErrorCode, string>> = {
  [MCPErrorCode.MISSING_REQUIRED_PARAM]: 'Provide the required parameters and try again.',
  [MCPErrorCode.VALIDATION_FAILED]: 'Review the input payload and fix the validation errors.',
  [MCPErrorCode.FILE_NOT_FOUND]: 'Verify the path or identifier and retry with an existing resource.',
  [MCPErrorCode.UNKNOWN_ACTION]: 'Use one of the documented actions for this tool.',
  [MCPErrorCode.INVALID_PARAMS]: 'Double-check parameter names and value types before retrying.',
  [MCPErrorCode.PATH_TRAVERSAL_DENIED]: 'Use a project-relative path without `..` segments or absolute roots.'
}

function mergeContext(base?: MCPErrorContext, extra?: MCPErrorContext): MCPErrorContext | undefined {
  if (!base && !extra) return undefined
  return { ...(base || {}), ...(extra || {}) }
}

function inferCodeFromApiError(error: ApiError): MCPErrorCode {
  if (error.code && error.code.includes('VALIDATION')) {
    return MCPErrorCode.VALIDATION_FAILED
  }

  if (error.code && error.code.includes('NOT_FOUND')) {
    return MCPErrorCode.FILE_NOT_FOUND
  }

  if (error.status === 404) {
    return MCPErrorCode.FILE_NOT_FOUND
  }

  if (error.status === 400) {
    return MCPErrorCode.VALIDATION_FAILED
  }

  return MCPErrorCode.SERVICE_ERROR
}

export class MCPError extends Error {
  readonly code: MCPErrorCode
  readonly suggestion?: string
  readonly context?: MCPErrorContext

  constructor(code: MCPErrorCode, message: string, options: { suggestion?: string; context?: MCPErrorContext } = {}) {
    super(message)
    this.name = 'MCPError'
    this.code = code
    this.suggestion = options.suggestion
    this.context = options.context && Object.keys(options.context).length > 0 ? options.context : undefined
  }

  static fromError(error: unknown, context?: MCPErrorContext): MCPError {
    if (error instanceof MCPError) {
      const merged = mergeContext(error.context, context)
      return merged === error.context
        ? error
        : new MCPError(error.code, error.message, {
            suggestion: error.suggestion,
            context: merged
          })
    }

    if (error instanceof ApiError) {
      const code = inferCodeFromApiError(error)
      return new MCPError(code, error.message, {
        context: mergeContext(
          {
            status: error.status,
            code: error.code
          },
          context
        )
      })
    }

    if (error instanceof Error) {
      return new MCPError(MCPErrorCode.SERVICE_ERROR, error.message, {
        context
      })
    }

    return new MCPError(MCPErrorCode.SERVICE_ERROR, 'Unknown error', {
      context: mergeContext({ value: String(error) }, context)
    })
  }
}

export function createMCPError(code: MCPErrorCode, message: string, context?: MCPErrorContext): MCPError {
  return new MCPError(code, message, { context })
}

export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError
}

export async function formatMCPErrorResponse(error: MCPError | unknown): Promise<MCPToolResponse> {
  const normalized = error instanceof MCPError ? error : MCPError.fromError(error)
  const suggestion = normalized.suggestion || DEFAULT_SUGGESTIONS[normalized.code]
  const contextText =
    normalized.context && Object.keys(normalized.context).length > 0
      ? `\n\nDetails: ${JSON.stringify(normalized.context, null, 2)}`
      : ''
  const suggestionText = suggestion ? `\n\nSuggestion: ${suggestion}` : ''
  const text = `Error (${normalized.code}): ${normalized.message}${suggestionText}${contextText}`

  return {
    content: [{ type: 'text', text }],
    isError: true
  }
}
