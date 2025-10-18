import { z } from 'zod'
import { generateStructuredData } from '../gen-ai-services'
import { modelConfigService } from '../model-config-service'
import { nullToUndefined } from '../utils/file-utils'
import type { ModelOptionsWithProvider } from '@promptliano/config'
import type { PartialFileContent } from './partial-file-fetcher'
import { formatPartialFilesForAI } from './partial-file-fetcher'

/**
 * Schema for file suggestion results
 */
export const FileSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        fileId: z.string(),
        confidence: z.number().min(0).max(1),
        relevance: z.number().min(0).max(1),
        reasons: z.array(z.string()).min(1).max(5).optional() // Optional to save tokens when not needed
      })
    )
    .min(1)
    .max(25)
})

export type FileSuggestion = z.infer<typeof FileSuggestionSchema>

/**
 * Options for file suggestion
 */
export interface FileSuggestionOptions {
  maxResults?: number // Default: 10
  minConfidence?: number // Default: 0.3
  aiModel?: 'high' | 'medium'
  userContext?: string
  strategy?: 'fast' | 'balanced' | 'thorough'
  includeReasons?: boolean // Include detailed reasons (default: false to save tokens)
}

/**
 * Individual file suggestion with metadata
 */
export interface SuggestedFile {
  fileId: string
  path: string
  confidence: number
  relevance: number
  reasons: string[]
  extension: string | null
  lineCount: number
  totalLines: number
}

/**
 * Result of file suggestion with metadata
 */
export interface FileSuggestionResult {
  suggestedFiles: SuggestedFile[]
  metadata: {
    totalCandidates: number
    filesAnalyzed: number
    aiModel: string
    processingTime: number
    strategy: string
    tokensSaved: number
  }
}

/**
 * Builds the AI prompt for file suggestion
 */
function buildFileSuggestionPrompt(
  partialFiles: PartialFileContent[],
  userInput: string,
  userContext: string | undefined,
  maxResults: number,
  lineCount: number,
  includeReasons: boolean
): string {
  const formattedFiles = formatPartialFilesForAI(partialFiles)

  const lines: string[] = [
    'You are analyzing file contents to identify the most relevant files for a specific task.',
    '',
    `User Request: "${userInput}"`,
    ''
  ]

  if (userContext) {
    lines.push(`Additional Context: ${userContext}`, '')
  }

  lines.push(
    `Files (showing first ${lineCount} lines of each):`,
    formattedFiles,
    '',
    `Task: Select and rank the ${maxResults} most relevant files from the provided list.`,
    '',
    'Evaluation Criteria:',
    '1. **File Path & Naming**: Does the path/name suggest relevance to the request?',
    '2. **Actual Code Content**: What do the imports, exports, and function names reveal?',
    '3. **Code Structure**: Is this a service, component, utility, or configuration file?',
    '4. **Direct Relevance**: How directly does the visible code relate to the user request?',
    '5. **Dependency Relationships**: Does this file likely import/export related functionality?',
    '',
    'For each selected file, provide:',
    '- confidence: How confident are you this file is relevant (0.0-1.0)',
    '- relevance: Overall relevance score (0.0-1.0)'
  )

  if (includeReasons) {
    lines.push('- reasons: 2-5 specific reasons why this file is relevant (be specific - reference actual code elements)')
  }

  lines.push(
    '',
    `Return exactly ${maxResults} files ranked by relevance (highest first).`
  )

  return lines.join('\n')
}

const AI_FILE_SUGGESTER_SYSTEM_PROMPT =
  'You are an expert software engineer analyzing code to find relevant files. ' +
  'You carefully examine file paths, imports, exports, function names, and code structure ' +
  'to determine which files are most likely relevant to a given task or request. ' +
  'You provide specific, evidence-based reasoning for your selections.'

/**
 * Resolves AI model options based on tier
 */
async function resolveModelOptions(tier: 'high' | 'medium'): Promise<ModelOptionsWithProvider> {
  const presetConfig = await modelConfigService.getPresetConfig(tier)
  return {
    provider: presetConfig.provider as ModelOptionsWithProvider['provider'],
    model: presetConfig.model,
    frequencyPenalty: nullToUndefined(presetConfig.frequencyPenalty),
    presencePenalty: nullToUndefined(presetConfig.presencePenalty),
    maxTokens: nullToUndefined(presetConfig.maxTokens),
    temperature: nullToUndefined(presetConfig.temperature),
    topP: nullToUndefined(presetConfig.topP),
    topK: nullToUndefined(presetConfig.topK)
  }
}

/**
 * Calculates token savings compared to full file content
 */
function calculateTokenSavings(partialFiles: PartialFileContent[]): number {
  let partialTokens = 0
  let fullTokensEstimate = 0

  for (const file of partialFiles) {
    // Actual tokens from partial content
    partialTokens += Math.ceil(file.partialContent.length / 4)

    // Estimate full file tokens based on ratio
    if (file.lineCount > 0 && file.totalLines > 0) {
      const ratio = file.totalLines / file.lineCount
      fullTokensEstimate += Math.ceil((file.partialContent.length / 4) * ratio)
    }
  }

  return Math.max(0, fullTokensEstimate - partialTokens)
}

/**
 * Suggests files using AI analysis of partial content
 *
 * @param partialFiles - Array of partial file contents
 * @param userInput - User's request/prompt
 * @param options - Suggestion options
 * @returns File suggestions with metadata
 */
export async function suggestFilesFromPartialContent(
  partialFiles: PartialFileContent[],
  userInput: string,
  options: FileSuggestionOptions = {}
): Promise<FileSuggestionResult> {
  const startTime = Date.now()
  const {
    maxResults = 10,
    minConfidence = 0.3,
    aiModel = 'medium',
    userContext,
    strategy = 'balanced',
    includeReasons = false
  } = options

  // If no files provided, return empty result
  if (partialFiles.length === 0) {
    return {
      suggestedFiles: [],
      metadata: {
        totalCandidates: 0,
        filesAnalyzed: 0,
        aiModel: 'none',
        processingTime: Date.now() - startTime,
        strategy,
        tokensSaved: 0
      }
    }
  }

  // Calculate token savings
  const tokensSaved = calculateTokenSavings(partialFiles)

  // Determine line count from first file
  const lineCount = partialFiles[0]?.lineCount || 50

  // Build AI prompt
  const prompt = buildFileSuggestionPrompt(partialFiles, userInput, userContext, maxResults, lineCount, includeReasons)

  // Resolve model options
  const modelOptions = await resolveModelOptions(aiModel)

  // Create file lookup map
  const fileMap = new Map(partialFiles.map((f) => [f.fileId, f]))

  try {
    // Call AI to suggest files
    const result = await generateStructuredData({
      prompt,
      systemMessage: AI_FILE_SUGGESTER_SYSTEM_PROMPT,
      schema: FileSuggestionSchema,
      options: modelOptions
    })

    // Filter by minimum confidence and map to full file info
    // Skip suggestions where file ID doesn't exist (AI hallucination or stale data)
    const suggestedFiles: SuggestedFile[] = result.object.suggestions
      .filter((suggestion) => suggestion.confidence >= minConfidence)
      .flatMap((suggestion) => {
        const file = fileMap.get(suggestion.fileId)
        if (!file) {
          console.warn(
            `[FileSuggester] Skipping suggestion for file ID "${suggestion.fileId}" - not found in partial files (AI may have hallucinated or file was removed)`
          )
          return [] // Skip this suggestion instead of failing
        }

        return [
          {
            fileId: suggestion.fileId,
            path: file.path,
            confidence: suggestion.confidence,
            relevance: suggestion.relevance,
            reasons: suggestion.reasons || [], // Default to empty array if not provided
            extension: file.extension,
            lineCount: file.lineCount,
            totalLines: file.totalLines
          }
        ]
      })
      .slice(0, maxResults) // Ensure we don't exceed max results

    return {
      suggestedFiles,
      metadata: {
        totalCandidates: partialFiles.length,
        filesAnalyzed: partialFiles.length,
        aiModel: modelOptions.model,
        processingTime: Date.now() - startTime,
        strategy: `ai-file-suggestion-${strategy}`,
        tokensSaved
      }
    }
  } catch (error) {
    console.error('[FileSuggester] AI file suggestion failed:', error)

    // Fallback: return first N files sorted by path
    // Filter by minConfidence (fallback uses 0.5, so if minConfidence > 0.5, return empty)
    const fallbackConfidence = 0.5
    const fallbackFiles =
      fallbackConfidence >= minConfidence
        ? partialFiles.slice(0, maxResults).map((file) => ({
            fileId: file.fileId,
            path: file.path,
            confidence: fallbackConfidence,
            relevance: fallbackConfidence,
            reasons: ['Fallback: AI suggestion failed'],
            extension: file.extension,
            lineCount: file.lineCount,
            totalLines: file.totalLines
          }))
        : []

    return {
      suggestedFiles: fallbackFiles,
      metadata: {
        totalCandidates: partialFiles.length,
        filesAnalyzed: partialFiles.length,
        aiModel: 'fallback',
        processingTime: Date.now() - startTime,
        strategy: 'fallback',
        tokensSaved
      }
    }
  }
}
