import {
  type ProjectFile,
  type GroupSummary,
  type EnhancedFileSummary,
  type BatchSummaryOptions,
  type BatchSummaryResult,
  type SummaryOptions,
  type SummaryProgress
} from '@promptliano/schemas'
import type { File, FileGroup } from '@promptliano/database'
import { z } from 'zod'
import { ErrorFactory, promptsMap } from '@promptliano/shared'
import { generateStructuredData } from '../gen-ai-services'
import { fileSummarizationTracker } from '../file-summarization-tracker'
import { createFileGroupingService } from './file-grouping-service'
import { logger } from '../utils/logger'
import {
  createFileService,
  createProgressTracker,
  createTokenEstimator,
  type FileServiceConfig
} from './file-service-factory'

export interface BatchProgress {
  batchId: string
  currentGroup: string
  groupIndex: number
  totalGroups: number
  filesProcessed: number
  totalFiles: number
  tokensUsed: number
  errors: string[]
}

export interface GroupContext {
  groupName: string
  relatedFiles: Array<{ id: string; name: string; summary?: string }>
  relationships: Array<{ source: string; target: string; type: string }>
}

export interface EnhancedSummarizationServiceDeps {
  groupingService?: ReturnType<typeof createFileGroupingService>
  config?: FileServiceConfig
}

// Define the schema for file summarization requests
const FileSummarizationRequestSchema = z.object({
  summary: z.string()
})

// Model configurations for different summary depths
const MODEL_CONFIGS = {
  minimal: {
    maxTokens: 200,
    model: 'gemini-1.5-flash',
    temperature: 0.3,
    provider: 'google_gemini'
  },
  standard: {
    maxTokens: 500,
    model: 'gemini-1.5-flash',
    temperature: 0.5,
    provider: 'google_gemini'
  },
  detailed: {
    maxTokens: 1000,
    model: 'gemini-1.5-flash',
    temperature: 0.7,
    provider: 'google_gemini'
  }
}

export function createEnhancedSummarizationService(deps: EnhancedSummarizationServiceDeps = {}) {
  const service = createFileService('EnhancedSummarizationService', deps.config)
  const groupingService = deps.groupingService || createFileGroupingService()
  const tokenEstimator = createTokenEstimator()
  const activeOperations = new Map<string, AbortController>()

  async function summarizeFileGroup(group: FileGroup, files: File[], options: SummaryOptions): Promise<GroupSummary> {
    return service.withErrorContext(
      async () => {
        const startTime = Date.now()
        const fileMap = new Map(files.map((f) => [f.id, f]))
        const groupFiles = group.fileIds.map((id) => fileMap.get(id)).filter((f): f is File => f !== undefined)

        if (groupFiles.length === 0) {
          throw ErrorFactory.invalidParam('group', 'non-empty file group', 'empty group')
        }

        // Build group context
        const context = buildGroupContext(group, groupFiles, fileMap)

        // Generate enhanced summaries for each file
        const fileSummaries: EnhancedFileSummary[] = []
        let totalTokensUsed = 0

        // Use streaming for large groups
        if (groupFiles.length > 10) {
          const processor = service.createStreamProcessor(async (file: File) =>
            generateEnhancedSummary(file, context, options)
          )

          for await (const result of processor.processStream(groupFiles)) {
            if ('item' in result) {
              fileSummaries.push(result.item)
              totalTokensUsed += tokenEstimator.estimateFileTokens(groupFiles.find((f) => f.id === result.item.fileId)!)
            } else {
              logger.error(`Failed to summarize file in group ${group.id}`, result.error)
            }
          }
        } else {
          // Process sequentially for smaller groups
          for (const file of groupFiles) {
            try {
              const summary = await generateEnhancedSummary(file, context, options)
              fileSummaries.push(summary)
              totalTokensUsed += tokenEstimator.estimateFileTokens(file)
            } catch (error) {
              logger.error(`Failed to summarize file ${file.path} in group ${group.id}`, error)
            }
          }
        }

        // Generate group overview
        const overviewSummary = await generateGroupOverview(group, fileSummaries, context, options)

        return {
          groupId: group.id,
          groupName: group.name,
          overviewSummary,
          fileSummaries,
          relationships: group.relationships || [],
          keyInsights: extractKeyInsights(fileSummaries),
          tokensUsed: totalTokensUsed,
          generatedAt: Date.now()
        }
      },
      { action: 'summarize-group', id: group.id }
    )
  }

  async function* batchSummarizeWithProgress(
    projectId: number,
    options: BatchSummaryOptions
  ): AsyncIterator<BatchProgress> {
    const batchId = `batch-${projectId}-${Date.now()}`
    const abortController = new AbortController()
    activeOperations.set(batchId, abortController)

    try {
      // Get files needing summarization
      const unsummarizedFiles = await fileSummarizationTracker.getUnsummarizedFiles(projectId, {
        includeSkipped: options.retryFailedFiles,
        includeEmpty: false
      })

      const staleFiles = options.includeStaleFiles
        ? await fileSummarizationTracker.getStaleFiles(projectId, options.staleThresholdDays * 24 * 60 * 60 * 1000)
        : []

      // Combine and deduplicate
      const fileMap = new Map<string, File>()
      const allFiles = [...unsummarizedFiles, ...staleFiles]
      allFiles.forEach((f) => fileMap.set(f.id, f))
      const filesToProcess = Array.from(fileMap.values())

      if (filesToProcess.length === 0) {
        yield {
          batchId,
          currentGroup: 'No files to process',
          groupIndex: 0,
          totalGroups: 0,
          filesProcessed: 0,
          totalFiles: 0,
          tokensUsed: 0,
          errors: []
        }
        return
      }

      // Group files using database File objects
      const groups = await groupingService.groupFilesByStrategy(filesToProcess, options.strategy, projectId, {
        maxGroupSize: options.maxGroupSize,
        priorityThreshold: options.priorityThreshold
      })

      // Optimize groups for token limits
      const optimizedGroups = groupingService.optimizeGroupsForTokenLimit(
        groups,
        filesToProcess,
        options.maxTokensPerGroup
      )

      // Sort groups by priority
      optimizedGroups.sort((a, b) => b.priority - a.priority)

      // Start tracking
      const progress = fileSummarizationTracker.startBatchTracking(
        projectId,
        batchId,
        filesToProcess.length,
        optimizedGroups.length
      )

      // Process groups with progress tracking
      const errors: string[] = []
      let totalTokensUsed = 0
      let filesProcessed = 0

      for (let i = 0; i < optimizedGroups.length; i++) {
        if (abortController.signal.aborted) {
          fileSummarizationTracker.completeBatchTracking(batchId, 'cancelled')
          break
        }

        const group = optimizedGroups[i]
        if (!group) {
          logger.warn(`Group at index ${i} is undefined, skipping`)
          continue
        }

        // Update progress
        fileSummarizationTracker.updateBatchProgress(batchId, {
          status: 'processing',
          currentGroup: group.name,
          processedGroups: i
        })

        yield {
          batchId,
          currentGroup: group.name,
          groupIndex: i + 1,
          totalGroups: optimizedGroups.length,
          filesProcessed,
          totalFiles: filesToProcess.length,
          tokensUsed: totalTokensUsed,
          errors
        }

        try {
          // Process group with concurrency control
          const summary = await processGroupWithConcurrency(group, filesToProcess, options, abortController.signal)

          filesProcessed += group.fileIds.length
          totalTokensUsed += summary.tokensUsed

          // Update file statuses
          fileSummarizationTracker.updateSummarizationStatus(
            projectId,
            group.fileIds.map((id) => ({ fileId: String(id), status: 'completed' }))
          )
        } catch (error) {
          const errorMsg = `Failed to process group ${group.name}: ${error instanceof Error ? error.message : String(error)}`
          errors.push(errorMsg)
          logger.error(errorMsg, error)

          // Mark files as failed
          fileSummarizationTracker.updateSummarizationStatus(
            projectId,
            group.fileIds.map((id) => ({
              fileId: String(id),
              status: 'failed',
              error: errorMsg
            }))
          )
        }
      }

      // Complete tracking
      const finalStatus = abortController.signal.aborted ? 'cancelled' : errors.length > 0 ? 'partial' : 'completed'

      fileSummarizationTracker.completeBatchTracking(batchId, finalStatus === 'partial' ? 'completed' : finalStatus)

      // Final yield
      yield {
        batchId,
        currentGroup: 'Completed',
        groupIndex: optimizedGroups.length,
        totalGroups: optimizedGroups.length,
        filesProcessed,
        totalFiles: filesToProcess.length,
        tokensUsed: totalTokensUsed,
        errors
      }
    } finally {
      activeOperations.delete(batchId)
    }
  }

  async function generateEnhancedSummary(
    file: File,
    context: GroupContext,
    options: SummaryOptions
  ): Promise<EnhancedFileSummary> {
    return service.withErrorContext(
      async () => {
        // Check if file needs summarization
        if (!file.content || file.content.trim().length === 0) {
          return {
            fileId: file.id,
            summary: 'Empty file',
            generatedAt: Date.now()
          }
        }

        const depth = options.depth || 'standard'
        const modelConfig = MODEL_CONFIGS[depth as keyof typeof MODEL_CONFIGS]
        if (!modelConfig) {
          throw ErrorFactory.invalidInput('depth', 'minimal, standard, or detailed', depth)
        }

        // Build context-aware prompt
        const systemPrompt = options.groupAware ? buildGroupAwareSystemPrompt(options) : promptsMap.summarizationSteps

        const userPrompt = buildEnhancedUserPrompt(file, context, options)

        const result = await generateStructuredData({
          prompt: userPrompt,
          schema: FileSummarizationRequestSchema,
          systemMessage: systemPrompt,
          options: modelConfig
        })

        // Extract relationships from the summary
        const relationships = options.includeRelationships
          ? extractRelationships(file, context, result.object.summary)
          : undefined

        return {
          fileId: file.id,
          summary: result.object.summary,
          relationships,
          groupContext: options.groupAware ? context.groupName : undefined,
          generatedAt: Date.now()
        }
      },
      { action: 'generate-summary', id: file.id }
    )
  }

  // Helper functions
  function buildGroupContext(group: FileGroup, groupFiles: File[], allFilesMap: Map<string, File>): GroupContext {
    const relatedFiles = groupFiles.map((f) => ({
      id: f.id,
      name: f.name,
      summary: f.summary ?? undefined
    }))

    const relationships = (group.relationships || []).map((rel) => {
      const sourceFile = allFilesMap.get(rel.sourceFileId)
      const targetFile = allFilesMap.get(rel.targetFileId)

      return {
        source: sourceFile?.name || `File ${rel.sourceFileId}`,
        target: targetFile?.name || `File ${rel.targetFileId}`,
        type: rel.type
      }
    })

    return {
      groupName: group.name,
      relatedFiles,
      relationships
    }
  }

  async function generateGroupOverview(
    group: FileGroup,
    fileSummaries: EnhancedFileSummary[],
    context: GroupContext,
    options: SummaryOptions
  ): Promise<string> {
    if (fileSummaries.length === 0) {
      return 'No files were successfully summarized in this group.'
    }

    const prompt = `
Generate a high-level overview summary for this group of related files:

Group: ${group.name}
Strategy: ${group.strategy}
Number of files: ${fileSummaries.length}

File summaries:
${fileSummaries.map((s) => `- ${s.summary}`).join('\n')}

${
  context.relationships.length > 0
    ? `
Relationships:
${context.relationships.map((r) => `- ${r.source} ${r.type} ${r.target}`).join('\n')}
`
    : ''
}

Provide a concise overview that captures:
1. The overall purpose and functionality of this file group
2. How the files work together
3. Key patterns or architectural decisions
4. Important dependencies or interactions
`

    try {
      const depth = options.depth || 'standard'
      const modelConfig = MODEL_CONFIGS[depth as keyof typeof MODEL_CONFIGS]

      const result = await generateStructuredData({
        prompt,
        schema: FileSummarizationRequestSchema,
        systemMessage: 'You are an expert code analyst. Provide clear, concise summaries.',
        options: modelConfig
      })

      return result.object.summary
    } catch (error) {
      logger.error('Failed to generate group overview', error)
      return 'Failed to generate group overview.'
    }
  }

  function extractKeyInsights(summaries: EnhancedFileSummary[]): string[] {
    const insights: string[] = []

    // Look for patterns in summaries
    const commonTerms = new Map<string, number>()
    const techStack = new Set<string>()

    for (const summary of summaries) {
      // Extract technology mentions
      const techPatterns = [
        /\b(React|Vue|Angular|Svelte)\b/gi,
        /\b(TypeScript|JavaScript|Python|Go|Rust)\b/gi,
        /\b(REST|GraphQL|gRPC|WebSocket)\b/gi,
        /\b(PostgreSQL|MySQL|MongoDB|Redis|SQLite)\b/gi
      ]

      for (const pattern of techPatterns) {
        const matches = summary.summary.match(pattern)
        if (matches) {
          matches.forEach((match) => techStack.add(match))
        }
      }

      // Extract common architectural terms
      const archTerms = summary.summary.match(/\b(service|component|hook|utility|helper|controller|model|schema)\b/gi)
      if (archTerms) {
        archTerms.forEach((term) => {
          const lower = term.toLowerCase()
          commonTerms.set(lower, (commonTerms.get(lower) || 0) + 1)
        })
      }
    }

    // Generate insights
    if (techStack.size > 0) {
      insights.push(`Technologies used: ${Array.from(techStack).join(', ')}`)
    }

    const topTerms = Array.from(commonTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([term]) => term)

    if (topTerms.length > 0) {
      insights.push(`Common patterns: ${topTerms.join(', ')}`)
    }

    return insights
  }

  async function processGroupWithConcurrency(
    group: FileGroup,
    allFiles: File[],
    options: BatchSummaryOptions,
    signal: AbortSignal
  ): Promise<GroupSummary> {
    const summaryOptions: SummaryOptions = {
      depth: 'standard',
      format: 'xml',
      strategy: 'balanced',
      includeImports: true,
      includeExports: true,
      progressive: false,
      includeMetrics: false,
      contextWindow: 3,
      groupAware: true,
      includeRelationships: true
    }

    // Use semaphore pattern for concurrency control
    const maxConcurrent = options.maxConcurrentGroups || 3
    let running = 0

    const waitForSlot = async () => {
      while (running >= maxConcurrent) {
        if (signal.aborted) {
          throw ErrorFactory.operationFailed('batch-summarization', 'Operation cancelled by user')
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    await waitForSlot()
    running++

    try {
      return await summarizeFileGroup(group, allFiles, summaryOptions)
    } finally {
      running--
    }
  }

  function buildGroupAwareSystemPrompt(options: SummaryOptions): string {
    return `You are an expert code analyst with deep understanding of software architecture and design patterns.

When summarizing code files, consider:
1. The file's role within its group/module
2. Key dependencies and relationships with other files
3. Important patterns, abstractions, or architectural decisions
4. The file's public API (exports) and dependencies (imports)

Provide summaries that are:
- ${
      options.depth === 'minimal'
        ? 'Very concise (1-2 sentences)'
        : options.depth === 'detailed'
          ? 'Comprehensive with implementation details'
          : 'Clear and informative (3-5 sentences)'
    }
- Focused on purpose and functionality over implementation details
- Aware of the broader context when group information is provided
- Technical but accessible to developers unfamiliar with the codebase`
  }

  function buildEnhancedUserPrompt(file: File, context: GroupContext, options: SummaryOptions): string {
    const extension = file.path.split('.').pop() || 'code'
    let prompt = `Summarize this ${extension} file:\n\n`
    prompt += `File: ${file.path}\n`

    if (options.groupAware && context.relatedFiles.length > 1) {
      prompt += `\nThis file is part of a group: ${context.groupName}\n`
      prompt += `Related files in group:\n`
      context.relatedFiles
        .filter((f) => f.id !== file.id)
        .slice(0, options.contextWindow || 3)
        .forEach((f) => {
          prompt += `- ${f.name}${f.summary ? `: ${f.summary.slice(0, 100)}...` : ''}\n`
        })
    }

    if (options.includeImports && file.imports && file.imports.length > 0) {
      prompt += `\nImports:\n`
      file.imports.slice(0, 10).forEach((imp) => {
        prompt += `- ${imp.source}: ${imp.specifiers.join(', ')}\n`
      })
    }

    if (options.includeExports && file.exports && file.exports.length > 0) {
      prompt += `\nExports:\n`
      file.exports.slice(0, 10).forEach((exp) => {
        if (exp.type === 'named' && exp.specifiers && exp.specifiers.length > 0) {
          exp.specifiers.forEach((spec) => {
            const name = spec.exported || spec.local || 'unknown'
            prompt += `- ${name} (named)\n`
          })
        } else {
          prompt += `- ${exp.type} export\n`
        }
      })
    }

    // Use simple content preview
    const contentPreview = file.content ? file.content.slice(0, 5000) : ''
    prompt += `\nCode content:\n${contentPreview}\n`

    prompt += `\nProvide a ${options.depth || 'standard'} summary focusing on purpose and functionality.`

    return prompt
  }

  function extractRelationships(
    file: File,
    context: GroupContext,
    summary: string
  ): Array<{ relatedFileId: string; relationshipType: any; context?: string }> {
    const relationships: Array<{ relatedFileId: string; relationshipType: any; context?: string }> = []

    // Add import relationships
    if (file.imports) {
      context.relatedFiles.forEach((related) => {
        if (related.id === file.id) return

        const hasImport = file.imports!.some(
          (imp) => related.name.includes(imp.source) || imp.source.includes(related.name.replace(/\.[^.]+$/, ''))
        )

        if (hasImport) {
          relationships.push({
            relatedFileId: related.id,
            relationshipType: 'imports',
            context: 'Direct import dependency'
          })
        }
      })
    }

    // Add semantic relationships based on summary
    const summaryLower = summary.toLowerCase()
    context.relatedFiles.forEach((related) => {
      if (related.id === file.id) return

      if (summaryLower.includes(related.name.toLowerCase())) {
        relationships.push({
          relatedFileId: related.id,
          relationshipType: 'semantic',
          context: 'Mentioned in summary'
        })
      }
    })

    return relationships
  }

  function cancelBatch(batchId: string): boolean {
    const controller = activeOperations.get(batchId)
    if (controller) {
      controller.abort()
      return true
    }
    return false
  }

  function getActiveBatches(): string[] {
    return Array.from(activeOperations.keys())
  }

  return {
    // Core functionality
    summarizeFileGroup,
    batchSummarizeWithProgress,
    generateEnhancedSummary,
    cancelBatch,
    getActiveBatches,

    // Service metadata
    serviceName: service.serviceName,
    config: service.config,

    // Cleanup
    destroy: () => {
      // Cancel all active operations
      activeOperations.forEach((controller) => controller.abort())
      activeOperations.clear()
      service.destroy()
    }
  }
}

// Export types
export type EnhancedSummarizationService = ReturnType<typeof createEnhancedSummarizationService>

// Export singleton for backward compatibility
export const enhancedSummarizationService = createEnhancedSummarizationService()

// Export individual functions for tree-shaking
export const {
  summarizeFileGroup,
  batchSummarizeWithProgress,
  generateEnhancedSummary,
  cancelBatch,
  getActiveBatches
} = enhancedSummarizationService
