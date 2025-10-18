/**
 * Mermaid Error Parser
 *
 * Parses mermaid rendering errors into user-friendly messages with helpful suggestions.
 */

export interface ParsedMermaidError {
  message: string
  line?: number
  column?: number
  suggestion?: string
  type: 'syntax' | 'validation' | 'rendering' | 'unknown'
}

const ERROR_PATTERNS: Array<{
  pattern: RegExp
  type: ParsedMermaidError['type']
  getMessage: (match: RegExpMatchArray) => string
  getSuggestion: (match: RegExpMatchArray) => string
}> = [
  {
    pattern: /Syntax error.*line (\d+)/i,
    type: 'syntax',
    getMessage: (match) => `Syntax error on line ${match[1]}`,
    getSuggestion: () => 'Check for missing brackets, incorrect arrow notation (use --> instead of ->), or invalid node IDs.'
  },
  {
    pattern: /Parse error.*unexpected.*'([^']+)'/i,
    type: 'syntax',
    getMessage: (match) => `Unexpected token: '${match[1]}'`,
    getSuggestion: () => 'Verify your diagram syntax matches the mermaid specification for this diagram type.'
  },
  {
    pattern: /Unknown.*diagram.*type/i,
    type: 'validation',
    getMessage: () => 'Unknown diagram type',
    getSuggestion: () => 'Supported types: flowchart, graph, sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt, pie, gitGraph'
  },
  {
    pattern: /Invalid.*node.*id/i,
    type: 'validation',
    getMessage: () => 'Invalid node identifier',
    getSuggestion: () => 'Node IDs should be alphanumeric without spaces. Use underscores or camelCase instead.'
  },
  {
    pattern: /Arrow.*syntax.*error/i,
    type: 'syntax',
    getMessage: () => 'Incorrect arrow notation',
    getSuggestion: () => 'Use --> for solid arrows, -.-> for dotted, ==> for thick arrows.'
  }
]

/**
 * Parse a mermaid error into a structured, user-friendly format
 */
export function parseMermaidError(error: Error | string): ParsedMermaidError {
  const errorMessage = typeof error === 'string' ? error : error.message

  // Try to match known error patterns
  for (const pattern of ERROR_PATTERNS) {
    const match = errorMessage.match(pattern.pattern)
    if (match) {
      return {
        type: pattern.type,
        message: pattern.getMessage(match),
        suggestion: pattern.getSuggestion(match),
        line: extractLineNumber(errorMessage)
      }
    }
  }

  // Fallback for unknown errors
  return {
    type: 'unknown',
    message: errorMessage.length > 200
      ? errorMessage.substring(0, 200) + '...'
      : errorMessage,
    suggestion: 'Try using the AI Fix feature to automatically correct this error.'
  }
}

/**
 * Extract line number from error message if present
 */
function extractLineNumber(errorMessage: string): number | undefined {
  const lineMatch = errorMessage.match(/line\s+(\d+)/i)
  if (lineMatch) {
    return parseInt(lineMatch[1], 10)
  }
  return undefined
}

/**
 * Get a helpful error message for common mermaid syntax mistakes
 */
export function getCommonErrorHelp(code: string): string | undefined {
  // Check for common mistakes
  if (code.includes('->') && !code.includes('-->')) {
    return 'Tip: Use --> for arrows, not ->'
  }

  if (code.match(/\[\s*[^\]]*\s+[^\]]*\]/)) {
    return 'Tip: Node labels should not contain unescaped spaces. Use quotes or underscores.'
  }

  if (!code.trim().startsWith('graph') &&
      !code.trim().startsWith('flowchart') &&
      !code.trim().startsWith('sequenceDiagram') &&
      !code.trim().startsWith('classDiagram') &&
      !code.trim().startsWith('stateDiagram') &&
      !code.trim().startsWith('erDiagram') &&
      !code.trim().startsWith('gantt') &&
      !code.trim().startsWith('pie') &&
      !code.trim().startsWith('gitGraph')) {
    return 'Tip: Mermaid diagrams must start with a diagram type (graph, flowchart, sequenceDiagram, etc.)'
  }

  return undefined
}

/**
 * Validate basic mermaid syntax before rendering
 */
export function validateMermaidSyntax(code: string): {
  isValid: boolean
  error?: ParsedMermaidError
} {
  const trimmedCode = code.trim()

  if (!trimmedCode) {
    return {
      isValid: false,
      error: {
        type: 'validation',
        message: 'Code cannot be empty',
        suggestion: 'Enter some mermaid diagram code to get started.'
      }
    }
  }

  const commonHelp = getCommonErrorHelp(trimmedCode)
  if (commonHelp) {
    return {
      isValid: false,
      error: {
        type: 'syntax',
        message: 'Potential syntax issue detected',
        suggestion: commonHelp
      }
    }
  }

  return { isValid: true }
}
