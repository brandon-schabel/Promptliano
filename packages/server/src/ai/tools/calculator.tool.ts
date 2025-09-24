import { tool } from 'ai'
import { z } from 'zod'

const expressionSchema = z.object({
  expression: z
    .string()
    .min(1, 'Provide a mathematical expression to evaluate.')
    .max(200, 'Expression is too long. Try something shorter.')
})

/**
 * A simple calculator tool. Uses a very small parser instead of `eval` so we do
 * not execute arbitrary JavaScript expressions. The parser supports the
 * standard arithmetic operators (+, -, *, /, parentheses).
 */
export const calculatorTool = tool({
  description: 'Evaluate basic arithmetic expressions (supports +, -, *, /, parentheses).',
  inputSchema: expressionSchema,
  execute: async ({ expression }) => {
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '')
    if (sanitized.length === 0) {
      throw new Error('Invalid expression. Only digits and arithmetic symbols are allowed.')
    }

    try {
      const result = evaluateExpression(sanitized)
      return { result }
    } catch (error) {
      throw new Error(`Failed to evaluate expression: ${(error as Error).message}`)
    }
  }
})

// ---------------------------------------------------------------------------
// Lightweight expression evaluator (recursive descent parser)
// ---------------------------------------------------------------------------

function evaluateExpression(input: string): number {
  let index = 0

  const peek = () => input[index]
  const consume = () => input[index++]

  const skipWhitespace = () => {
    while (index < input.length && /\s/.test(input[index]!)) {
      index++
    }
  }

  const parseNumber = (): number => {
    skipWhitespace()
    let start = index
    while (index < input.length && /[0-9.]/.test(input[index]!)) {
      index++
    }
    const segment = input.slice(start, index)
    if (segment.length === 0) {
      throw new Error('Expected number')
    }
    const value = Number(segment)
    if (!Number.isFinite(value)) {
      throw new Error('Invalid number')
    }
    return value
  }

  const parseFactor = (): number => {
    skipWhitespace()
    const char = peek()
    if (char === '(') {
      consume()
      const value = parseExpression()
      skipWhitespace()
      if (consume() !== ')') {
        throw new Error('Expected closing parenthesis')
      }
      return value
    }
    return parseNumber()
  }

  const parseTerm = (): number => {
    let value = parseFactor()
    while (true) {
      skipWhitespace()
      const char = peek()
      if (char === '*' || char === '/') {
        consume()
        const rhs = parseFactor()
        value = char === '*' ? value * rhs : value / rhs
      } else {
        break
      }
    }
    return value
  }

  const parseExpression = (): number => {
    let value = parseTerm()
    while (true) {
      skipWhitespace()
      const char = peek()
      if (char === '+' || char === '-') {
        consume()
        const rhs = parseTerm()
        value = char === '+' ? value + rhs : value - rhs
      } else {
        break
      }
    }
    return value
  }

  const result = parseExpression()
  skipWhitespace()
  if (index < input.length) {
    throw new Error(`Unexpected token '${input[index]}'`)
  }
  return result
}

