import { z } from 'zod'

/**
 * Build a sample JSON object that mirrors the expected schema shape.
 * Used to guide LLMs when falling back to text generation.
 */
export function buildExampleJsonStructure(schema: z.ZodTypeAny): Record<string, unknown> {
  const example: Record<string, unknown> = {}

  try {
    const testResult = schema.safeParse({})
    if (!testResult.success && testResult.error) {
      for (const issue of testResult.error.issues) {
        if (!issue.path || issue.path.length === 0) continue
        const fieldName = String(issue.path[0])
        if (!fieldName) continue

        if (issue.code === 'invalid_type') {
          switch (issue.expected) {
            case 'string':
              example[fieldName] = 'string value here'
              break
            case 'number':
              example[fieldName] = 0
              break
            case 'boolean':
              example[fieldName] = false
              break
            case 'array':
              example[fieldName] = []
              break
            case 'object':
              example[fieldName] = {}
              break
            default:
              example[fieldName] = null
          }
        }
      }
    }
  } catch {
    // Ignore schema introspection failures and fall back to empty object
  }

  return example
}

/**
 * Extract a JSON string embedded in an arbitrary LLM response.
 * Handles code fences, leading/trailing commentary, and multiple candidates.
 */
export function extractJsonStringFromResponse(rawText: string): string {
  let jsonCandidate = rawText.trim()

  if (jsonCandidate.startsWith('```json')) {
    jsonCandidate = jsonCandidate.slice('```json'.length)
  }
  if (jsonCandidate.startsWith('```')) {
    jsonCandidate = jsonCandidate.slice(3)
  }
  if (jsonCandidate.endsWith('```')) {
    jsonCandidate = jsonCandidate.slice(0, -3)
  }

  jsonCandidate = jsonCandidate.trim()

  const jsonPatterns = [/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s, /\[[\s\S]*\]/s]

  for (const pattern of jsonPatterns) {
    const matches = jsonCandidate.match(pattern)
    if (!matches) continue

    for (const match of matches) {
      try {
        JSON.parse(match)
        return match
      } catch {
        // Continue searching other matches
      }
    }
  }

  return jsonCandidate
}

/**
 * Build a strict instruction prompt for JSON-only responses.
 */
export function createJsonOnlyPrompt(prompt: string, schema: z.ZodTypeAny, systemMessage?: string): string {
  const exampleStructure = JSON.stringify(buildExampleJsonStructure(schema), null, 2)

  const instructions = `IMPORTANT: Return ONLY valid JSON matching this exact structure, nothing else:\n${exampleStructure}\n\nYour entire response must be a single JSON object. Do not explain, do not add any text before or after.\nStart your response with { and end with }`

  return [systemMessage, prompt, instructions].filter(Boolean).join('\n\n')
}
