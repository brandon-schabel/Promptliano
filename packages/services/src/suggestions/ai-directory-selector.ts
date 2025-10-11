import { z } from 'zod'
import { generateStructuredData } from '../gen-ai-services'
import { modelConfigService } from '../model-config-service'
import { nullToUndefined } from '../utils/file-utils'
import type { ModelOptionsWithProvider } from '@promptliano/config'

/**
 * Schema for directory selection results
 */
export const DirectorySelectionSchema = z.object({
  directories: z
    .array(
      z.object({
        path: z.string().min(1),
        confidence: z.number().min(0).max(1),
        reason: z.string()
      })
    )
    .min(1)
    .max(10)
})

export type DirectorySelection = z.infer<typeof DirectorySelectionSchema>

/**
 * File tree node structure (matches project-service output)
 */
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  depth?: number
  children?: FileTreeNode[]
  truncated?: boolean
}

/**
 * Options for directory selection
 */
export interface DirectorySelectionOptions {
  maxDirectories?: number
  minConfidence?: number
  aiModel?: 'high' | 'medium'
  userContext?: string
}

/**
 * Result of directory selection with metadata
 */
export interface DirectorySelectionResult {
  selectedDirectories: string[]
  allSelections: Array<{
    path: string
    confidence: number
    reason: string
  }>
  metadata: {
    totalDirectories: number
    aiModel: string
    processingTime: number
    strategy: string
  }
}

/**
 * Normalizes a directory path to be relative (removes leading slash)
 * "/src/auth" -> "src/auth"
 * "src/auth" -> "src/auth"
 */
function normalizeDirectoryPath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path
}

/**
 * Formats file tree for AI consumption
 * Converts hierarchical tree to compact list format
 */
function formatFileTreeForAI(tree: FileTreeNode, maxDepth: number = 10): string {
  const directories: string[] = []

  function traverse(node: FileTreeNode, currentDepth: number = 0) {
    if (currentDepth > maxDepth) return

    if (node.type === 'directory') {
      directories.push(node.path || node.name)

      if (node.children) {
        for (const child of node.children) {
          traverse(child, currentDepth + 1)
        }
      }
    }
  }

  traverse(tree)

  return directories.map((dir, idx) => `${idx + 1}. ${dir}`).join('\n')
}

/**
 * Counts total directories in tree
 */
function countDirectories(tree: FileTreeNode): number {
  let count = 0

  function traverse(node: FileTreeNode) {
    if (node.type === 'directory') {
      count++
      if (node.children) {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }
  }

  traverse(tree)
  return count
}

/**
 * Builds the AI prompt for directory selection
 */
function buildDirectorySelectionPrompt(
  fileTree: FileTreeNode,
  userInput: string,
  userContext: string | undefined,
  maxDirectories: number
): string {
  const formattedTree = formatFileTreeForAI(fileTree)

  const lines: string[] = [
    'You are analyzing a project\'s file structure to identify the most relevant directories.',
    '',
    `User Request: "${userInput}"`,
    ''
  ]

  if (userContext) {
    lines.push(`Additional Context: ${userContext}`, '')
  }

  lines.push(
    'Project Directory Structure:',
    formattedTree,
    '',
    `Task: Select the ${maxDirectories} most relevant directories that likely contain files related to the user's request.`,
    '',
    'Consider:',
    '1. Directory names and their semantic meaning (e.g., "auth", "api", "components")',
    '2. Common project patterns (src/, lib/, services/, components/, etc.)',
    '3. Depth and organization of directories',
    '4. Relevance to the specific user request',
    '',
    `Return exactly ${maxDirectories} directories with confidence scores (0.0-1.0) and brief reasons.`,
    'Order by confidence (highest first).'
  )

  return lines.join('\n')
}

const AI_DIRECTORY_SELECTOR_SYSTEM_PROMPT =
  'You are an expert software engineer analyzing project structures. ' +
  'Your task is to identify which directories are most likely to contain files relevant to a given request. ' +
  'Base your selections on directory naming conventions, common project patterns, and semantic relevance.'

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
 * Selects relevant directories from project file tree using AI
 *
 * @param fileTree - The project's file tree structure
 * @param userInput - User's request/prompt
 * @param options - Selection options
 * @returns Directory selection result with metadata
 */
export async function selectRelevantDirectories(
  fileTree: FileTreeNode,
  userInput: string,
  options: DirectorySelectionOptions = {}
): Promise<DirectorySelectionResult> {
  const startTime = Date.now()
  const { maxDirectories = 5, minConfidence = 0.3, aiModel = 'medium', userContext } = options

  // Count total directories for metadata
  const totalDirectories = countDirectories(fileTree)

  // Build AI prompt
  const prompt = buildDirectorySelectionPrompt(fileTree, userInput, userContext, maxDirectories)

  // Resolve model options
  const modelOptions = await resolveModelOptions(aiModel)

  try {
    // Call AI to select directories
    const result = await generateStructuredData({
      prompt,
      systemMessage: AI_DIRECTORY_SELECTOR_SYSTEM_PROMPT,
      schema: DirectorySelectionSchema,
      options: modelOptions
    })

    // Filter by minimum confidence
    const filteredSelections = result.object.directories.filter((dir) => dir.confidence >= minConfidence)

    return {
      selectedDirectories: filteredSelections.map((dir) => normalizeDirectoryPath(dir.path)),
      allSelections: result.object.directories.map((dir) => ({
        ...dir,
        path: normalizeDirectoryPath(dir.path)
      })),
      metadata: {
        totalDirectories,
        aiModel: modelOptions.model,
        processingTime: Date.now() - startTime,
        strategy: `directory-selection-${aiModel}`
      }
    }
  } catch (error) {
    console.error('[DirectorySelector] AI directory selection failed:', error)

    // Fallback: return root-level directories
    // Filter by minConfidence (fallback uses 0.5, so if minConfidence > 0.5, return empty)
    const fallbackConfidence = 0.5
    const fallbackDirs: string[] = []

    if (fallbackConfidence >= minConfidence && fileTree.children) {
      for (const child of fileTree.children) {
        if (child.type === 'directory') {
          fallbackDirs.push(normalizeDirectoryPath(child.path || child.name))
        }
      }
    }

    const selectedFallbackDirs = fallbackDirs.slice(0, maxDirectories)

    return {
      selectedDirectories: selectedFallbackDirs,
      allSelections: selectedFallbackDirs.map((path) => ({
        path,
        confidence: fallbackConfidence,
        reason: 'Fallback: root-level directory'
      })),
      metadata: {
        totalDirectories,
        aiModel: 'fallback',
        processingTime: Date.now() - startTime,
        strategy: 'fallback-root-dirs'
      }
    }
  }
}
