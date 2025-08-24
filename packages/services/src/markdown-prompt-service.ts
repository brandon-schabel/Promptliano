/**
 * Markdown Prompt Service - File-based operations with Functional Factory Pattern
 * Handles markdown import/export operations while maintaining file-based nature
 * 
 * Key improvements:
 * - Functional factory pattern for consistency
 * - ErrorFactory for standardized error handling
 * - Dependency injection support
 * - withErrorContext for better error tracking
 * - Maintains file-based operations (appropriate for this domain)
 */

import { withErrorContext, createServiceLogger, type ServiceLogger } from './core/base-service'
import { addTimestamps, convertNullsToUndefined, jsonToStringArray, nullToUndefined } from './utils/file-utils'
import { ErrorFactory } from '@promptliano/shared'
import {
  type ParsedMarkdownPrompt,
  type MarkdownFrontmatter,
  type BulkImportResult,
  type MarkdownExportResult,
  type MarkdownContentValidation,
  type PromptImportResult,
  type MarkdownImportResult,
  type ExportedFile,
  type MarkdownExportRequest,
  ParsedMarkdownPromptSchema,
  MarkdownFrontmatterSchema,
  BulkImportResultSchema,
  MarkdownExportResultSchema,
  MarkdownContentValidationSchema
} from '@promptliano/schemas'
import { type Prompt, PromptSchema } from '@promptliano/database'
import { ZodError } from 'zod'
import matter from 'gray-matter'
import yaml from 'js-yaml'
import DOMPurify from 'isomorphic-dompurify'
import { createPromptService, type PromptService } from './prompt-service'

// Service dependencies interface for dependency injection
export interface MarkdownPromptServiceDeps {
  promptService?: PromptService
  logger?: ServiceLogger
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean
  validation: MarkdownContentValidation
}

// Export options interface
export interface ExportOptions {
  format?: 'single-file' | 'multi-file'
  includeFrontmatter?: boolean
  includeCreatedDate?: boolean
  includeUpdatedDate?: boolean
  includeTags?: boolean
  sanitizeContent?: boolean
  sortBy?: 'name' | 'created' | 'updated'
  sortOrder?: 'asc' | 'desc'
}

// File interface for imports
export interface File {
  name: string
  content: string
  size: number
}

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_CONTENT_LENGTH = 1024 * 1024 // 1MB per prompt content

/**
 * Create Markdown Prompt Service with functional factory pattern
 */
export function createMarkdownPromptService(deps: MarkdownPromptServiceDeps = {}) {
  const {
    promptService = createPromptService(),
    logger = createServiceLogger('MarkdownPromptService')
  } = deps

  return {
    /**
     * Parses markdown content with frontmatter to structured prompt data
     */
    parseMarkdownToPrompt: async (content: string): Promise<ParsedMarkdownPrompt> => {
      return withErrorContext(
        async () => {
          return parseMarkdownContent(content)
        },
        { entity: 'MarkdownPrompt', action: 'parse' }
      )
    },

    /**
     * Converts a prompt to markdown format with frontmatter
     */
    promptToMarkdown: async (prompt: Prompt): Promise<string> => {
      return withErrorContext(
        async () => {
          return convertPromptToMarkdown(prompt)
        },
        { entity: 'MarkdownPrompt', action: 'convert', id: prompt.id }
      )
    },

    /**
     * Validates markdown content and structure
     */
    validateMarkdownContent: async (content: string): Promise<ValidationResult> => {
      return withErrorContext(
        async () => {
          return validateMarkdown(content)
        },
        { entity: 'MarkdownPrompt', action: 'validate' }
      )
    },

    /**
     * Extracts metadata from markdown frontmatter
     */
    extractPromptMetadata: async (content: string): Promise<MarkdownFrontmatter> => {
      return withErrorContext(
        async () => {
          return extractMetadata(content)
        },
        { entity: 'MarkdownPrompt', action: 'extractMetadata' }
      )
    },

    /**
     * Handles bulk import of multiple markdown files
     */
    bulkImportMarkdownPrompts: async (files: File[], projectId?: number): Promise<BulkImportResult> => {
      return withErrorContext(
        async () => {
          return performBulkImport(files, projectId, promptService, logger)
        },
        { entity: 'MarkdownPrompt', action: 'bulkImport' }
      )
    },

    /**
     * Exports multiple prompts to markdown format
     */
    exportPromptsToMarkdown: async (prompts: Prompt[], options: ExportOptions = {}): Promise<MarkdownExportResult> => {
      return withErrorContext(
        async () => {
          return performExportToMarkdown(prompts, options)
        },
        { entity: 'MarkdownPrompt', action: 'export' }
      )
    }
  }
}

// ============================================
// Core Implementation Functions
// ============================================

/**
 * Internal function: Parses markdown content with frontmatter to structured prompt data
 */
async function parseMarkdownContent(content: string): Promise<ParsedMarkdownPrompt> {
  if (!content || content.trim().length === 0) {
    throw ErrorFactory.invalidInput('content', 'non-empty markdown content', 'empty string')
  }

    // Parse frontmatter and content using gray-matter with safe YAML loading
    const parsed = matter(content, {
      // Use yaml.load which is safe by default in js-yaml 4+
      engines: {
        yaml: {
          parse: (str: string) => yaml.load(str) as object,
          stringify: (data: object) => yaml.dump(data)
        }
      }
    })

    // Extract and validate frontmatter
    const frontmatterData = parsed.data || {}

    // Ensure required name field exists
    if (!frontmatterData.name || typeof frontmatterData.name !== 'string' || frontmatterData.name.trim().length === 0) {
      throw ErrorFactory.missingRequired('name', 'markdown frontmatter')
    }

    // Parse and validate dates if provided
    let frontmatter: MarkdownFrontmatter
    try {
      frontmatter = MarkdownFrontmatterSchema.parse({
        name: frontmatterData.name.trim(),
        created: frontmatterData.created
          ? frontmatterData.created instanceof Date
            ? frontmatterData.created.toISOString()
            : frontmatterData.created
          : undefined,
        updated: frontmatterData.updated
          ? frontmatterData.updated instanceof Date
            ? frontmatterData.updated.toISOString()
            : frontmatterData.updated
          : undefined,
        tags: Array.isArray(frontmatterData.tags)
          ? frontmatterData.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
          : []
      })
    } catch (error) {
      if (error instanceof ZodError) {
        throw ErrorFactory.validationFailed(error, { entity: 'MarkdownFrontmatter' })
      }
      throw error
    }

    // Validate content
    const promptContent = parsed.content.trim()
    if (promptContent.length === 0) {
      throw ErrorFactory.invalidInput('content', 'non-empty prompt content')
    }

    if (promptContent.length > MAX_CONTENT_LENGTH) {
      throw ErrorFactory.businessRuleViolation(
        'content size limit',
        `Content length ${promptContent.length} exceeds maximum of ${MAX_CONTENT_LENGTH} characters`
      )
    }

    const result: ParsedMarkdownPrompt = {
      frontmatter,
      content: promptContent,
      rawContent: content
    }

    // Validate the complete result
    try {
      ParsedMarkdownPromptSchema.parse(result)
    } catch (error) {
      if (error instanceof ZodError) {
        throw ErrorFactory.validationFailed(error, { entity: 'ParsedMarkdownPrompt' })
      }
      throw error
    }

    return result
}

/**
 * Internal function: Converts a prompt to markdown format with frontmatter
 */
async function convertPromptToMarkdown(prompt: Prompt): Promise<string> {
  // Validate input prompt
  try {
    PromptSchema.parse(prompt)
  } catch (error) {
    if (error instanceof ZodError) {
      throw ErrorFactory.validationFailed(error, { entity: 'Prompt' })
    }
    throw error
  }

    // Build frontmatter object
    const frontmatter: Record<string, any> = {
      name: prompt.title
    }

    // Add created date if available
    if (prompt.createdAt) {
      frontmatter.created = new Date(prompt.createdAt).toISOString()
    }

    // Add updated date if available
    if (prompt.updatedAt) {
      frontmatter.updated = new Date(prompt.updatedAt).toISOString()
    }

    // Add empty tags array for future extensibility
    frontmatter.tags = []

    // Generate markdown with frontmatter
    const markdownContent = matter.stringify(prompt.content, frontmatter)

    return markdownContent
}

/**
 * Internal function: Validates markdown content and structure
 */
async function validateMarkdown(content: string): Promise<ValidationResult> {
  const validation: MarkdownContentValidation = {
    hasValidFrontmatter: false,
    hasRequiredFields: false,
    contentLength: 0,
    estimatedPrompts: 0,
    warnings: [],
    errors: []
  }

  try {
    if (!content || content.trim().length === 0) {
      validation.errors.push('Content is empty')
      return { isValid: false, validation }
    }

    if (content.length > MAX_FILE_SIZE) {
      validation.errors.push(`File size exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
      return { isValid: false, validation }
    }

    // Try to parse with gray-matter
    let parsed: matter.GrayMatterFile<string>
    try {
      parsed = matter(content)
      validation.hasValidFrontmatter = true
    } catch (error) {
      validation.errors.push(`Invalid frontmatter YAML: ${error instanceof Error ? error.message : String(error)}`)
      validation.hasValidFrontmatter = false
      return { isValid: false, validation }
    }

    // Check required fields
    const frontmatterData = parsed.data || {}
    if (frontmatterData.name && typeof frontmatterData.name === 'string' && frontmatterData.name.trim().length > 0) {
      validation.hasRequiredFields = true
    } else {
      validation.errors.push('Missing required field: name')
      validation.hasRequiredFields = false
    }

    // Validate frontmatter structure
    try {
      MarkdownFrontmatterSchema.parse({
        name: frontmatterData.name || '',
        created: frontmatterData.created || undefined,
        updated: frontmatterData.updated || undefined,
        tags: frontmatterData.tags || []
      })
    } catch (error) {
      if (error instanceof ZodError) {
        for (const issue of error.errors) {
          validation.warnings.push(`Frontmatter validation: ${issue.path.join('.')}: ${issue.message}`)
        }
      }
    }

    // Check content length
    const promptContent = parsed.content.trim()
    validation.contentLength = promptContent.length

    if (promptContent.length === 0) {
      validation.warnings.push('No content found after frontmatter - add your prompt text below the --- marker')
    } else if (promptContent.length > MAX_CONTENT_LENGTH) {
      const sizeKB = Math.round(promptContent.length / 1024)
      const maxKB = Math.round(MAX_CONTENT_LENGTH / 1024)
      validation.errors.push(
        `Content size (${sizeKB}KB) exceeds maximum of ${maxKB}KB. Consider splitting into multiple prompts.`
      )
    }

    // Estimate number of prompts (for now, assume 1 prompt per file)
    validation.estimatedPrompts = validation.hasRequiredFields && validation.contentLength > 0 ? 1 : 0

    // Check for potential issues
    if (frontmatterData.created && isNaN(Date.parse(frontmatterData.created))) {
      validation.warnings.push('Invalid created date format, expected ISO 8601')
    }

    if (frontmatterData.updated && isNaN(Date.parse(frontmatterData.updated))) {
      validation.warnings.push('Invalid updated date format, expected ISO 8601')
    }

    if (frontmatterData.tags && !Array.isArray(frontmatterData.tags)) {
      validation.warnings.push('Tags should be an array of strings')
    }

    const isValid = validation.errors.length === 0 && validation.hasRequiredFields && validation.contentLength > 0

    // Validate the complete validation object
    try {
      MarkdownContentValidationSchema.parse(validation)
    } catch (error) {
      // If validation schema itself is invalid, create a minimal valid response
      return {
        isValid: false,
        validation: {
          hasValidFrontmatter: false,
          hasRequiredFields: false,
          contentLength: 0,
          estimatedPrompts: 0,
          warnings: ['Internal validation error'],
          errors: ['Failed to validate content structure']
        }
      }
    }

    return { isValid, validation }
  } catch (error) {
    validation.errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    return { isValid: false, validation }
  }
}

/**
 * Internal function: Extracts metadata from markdown frontmatter
 */
async function extractMetadata(content: string): Promise<MarkdownFrontmatter> {
  try {
    const parsed = matter(content)
    const frontmatterData = parsed.data || {}

    // Validate and return structured frontmatter
    const frontmatter = MarkdownFrontmatterSchema.parse({
      name: frontmatterData.name || '',
      created: frontmatterData.created
        ? frontmatterData.created instanceof Date
          ? frontmatterData.created.toISOString()
          : frontmatterData.created
        : undefined,
      updated: frontmatterData.updated
        ? frontmatterData.updated instanceof Date
          ? frontmatterData.updated.toISOString()
          : frontmatterData.updated
        : undefined,
      tags: Array.isArray(frontmatterData.tags)
        ? frontmatterData.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
        : []
    })

    return frontmatter
  } catch (error) {
    if (error instanceof ZodError) {
      throw ErrorFactory.validationFailed(error, { 
        entity: 'MarkdownFrontmatter',
        action: 'extract',
        context: 'Expected format: name (string), created/updated (ISO dates), tags (array)'
      })
    }

    throw ErrorFactory.operationFailed(
      'extract metadata from markdown',
      `Check that your file has valid YAML frontmatter between --- markers: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Internal function: Handles bulk import of multiple markdown files
 */
async function performBulkImport(
  files: File[], 
  projectId: number | undefined, 
  promptService: PromptService,
  logger: ServiceLogger
): Promise<BulkImportResult> {
  const fileResults: MarkdownImportResult[] = []
  let totalPrompts = 0
  let promptsImported = 0
  const summary = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  }

  // Process each file
  for (const file of files) {
      const fileResult: MarkdownImportResult = {
        success: false,
        fileName: file.name,
        promptsProcessed: 0,
        promptsImported: 0,
        results: [],
        errors: [],
        warnings: []
      }

    try {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        fileResult.errors.push(
          `File size (${Math.round((file.size / (1024 * 1024)) * 100) / 100}MB) exceeds maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
        )
        fileResults.push(fileResult)
        continue
      }

      // Validate content
      const validationResult = await validateMarkdown(file.content)
      if (!validationResult.isValid) {
        fileResult.errors.push(...validationResult.validation.errors)
        fileResult.warnings.push(...validationResult.validation.warnings)
        fileResults.push(fileResult)
        continue
      }

      // Parse the markdown
      const parsedPrompt = await parseMarkdownContent(file.content)
        fileResult.promptsProcessed = 1
        totalPrompts += 1

        // Import the prompt
        const importResult: PromptImportResult = {
          success: false,
          promptName: parsedPrompt.frontmatter.name,
          action: 'skipped'
        }

      try {
        // Check if a prompt with this name already exists in the project
        let existingPromptsRaw: any[]
        if (projectId) {
          existingPromptsRaw = await promptService.getByProject(projectId)
        } else {
          existingPromptsRaw = await promptService.getAll()
        }
        
        // Convert database results to proper Prompt type
        const existingPrompts: Prompt[] = existingPromptsRaw.map(prompt => ({
          ...prompt,
          description: nullToUndefined(prompt.description),
          tags: jsonToStringArray(prompt.tags)
        }))

          const existingPrompt = existingPrompts.find((p) => p.title === parsedPrompt.frontmatter.name)

        if (existingPrompt) {
          // Update existing prompt
          const updatedPrompt = await promptService.update(existingPrompt.id, {
            content: parsedPrompt.content
          })

            importResult.success = true
            importResult.promptId = updatedPrompt.id
            importResult.action = 'updated'
            summary.updated++
            promptsImported++
            fileResult.promptsImported++
        } else {
          // Create new prompt - projectId is required
          if (!projectId) {
            throw ErrorFactory.missingRequired('projectId', 'prompt creation')
          }
          
          const newPrompt = await promptService.create(addTimestamps({
            title: parsedPrompt.frontmatter.name,
            content: parsedPrompt.content,
            projectId
          }))

          importResult.success = true
          importResult.promptId = newPrompt.id
          importResult.action = 'created'
          summary.created++
          promptsImported++
          fileResult.promptsImported++
        }
      } catch (error) {
        importResult.error = error instanceof Error ? error.message : String(error)
        summary.failed++
      }

      fileResult.results.push(importResult)
      fileResult.success = importResult.success
    } catch (error) {
      fileResult.errors.push(error instanceof Error ? error.message : String(error))
      summary.failed++
    }

    fileResults.push(fileResult)
  }

  const result: BulkImportResult = {
    success: promptsImported > 0,
    totalFiles: files.length,
    filesProcessed: fileResults.filter((f) => f.promptsProcessed > 0).length,
    totalPrompts,
    promptsImported,
    fileResults,
    summary
  }

  // Validate the complete result
  try {
    BulkImportResultSchema.parse(result)
  } catch (error) {
    if (error instanceof ZodError) {
      throw ErrorFactory.validationFailed(error, { entity: 'BulkImportResult' })
    }
    throw error
  }

  return result
}

/**
 * Internal function: Exports multiple prompts to markdown format
 */
async function performExportToMarkdown(
  prompts: Prompt[],
  options: ExportOptions = {}
): Promise<MarkdownExportResult> {
  const {
    format = 'single-file',
    includeFrontmatter = true,
    includeCreatedDate = true,
    includeUpdatedDate = true,
    includeTags = true,
    sanitizeContent = true,
    sortBy = 'name',
    sortOrder = 'asc'
  } = options

  // Validate input prompts
  const validatedPrompts = prompts.map((prompt) => {
    try {
      return PromptSchema.parse(prompt)
    } catch (error) {
      if (error instanceof ZodError) {
        throw ErrorFactory.validationFailed(error, {
          entity: 'Prompt',
          action: 'export',
          context: `prompt "${prompt.title || 'unnamed'}"`
        })
      }
      throw error
    }
  })

  if (validatedPrompts.length === 0) {
    throw ErrorFactory.invalidInput('prompts', 'at least one valid prompt')
  }

    // Sort prompts
    const sortedPrompts = [...validatedPrompts].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortBy) {
        case 'created':
          aValue = a.createdAt || 0
          bValue = b.createdAt || 0
          break
        case 'updated':
          aValue = a.updatedAt || 0
          bValue = b.updatedAt || 0
          break
        case 'name':
        default:
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      return sortOrder === 'desc' ? -comparison : comparison
    })

    const exportedAt = new Date().toISOString()
    let totalSize = 0

    if (format === 'single-file') {
      // Export all prompts to a single file
      const sections: string[] = []

      for (const prompt of sortedPrompts) {
        const frontmatter: Record<string, any> = includeFrontmatter
          ? {
              name: prompt.title || `prompt-${prompt.id}`
            }
          : {}

        if (includeFrontmatter) {
          if (includeCreatedDate && prompt.createdAt) {
            frontmatter.created = new Date(prompt.createdAt).toISOString()
          }
          if (includeUpdatedDate && prompt.updatedAt) {
            frontmatter.updated = new Date(prompt.updatedAt).toISOString()
          }
          if (includeTags) {
            frontmatter.tags = []
          }
        }

        let content = prompt.content
        if (sanitizeContent) {
          // Sanitize content to prevent XSS and other security issues
          // First sanitize HTML/scripts, then escape markdown conflicts
          content = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [], // Remove all HTML tags
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true // Keep text content
          })
            .replace(/^---/gm, '\\---') // Escape frontmatter delimiters in content
            .trim()
        }

        const promptMarkdown = includeFrontmatter ? matter.stringify(content, frontmatter) : content

        sections.push(promptMarkdown)
      }

      const combinedContent = includeFrontmatter ? sections.join('\n\n---\n\n') : sections.join('\n\n')
      totalSize = Buffer.byteLength(combinedContent, 'utf8')

      const result: MarkdownExportResult = {
        success: true,
        format: 'single-file',
        promptCount: sortedPrompts.length,
        fileName: 'exported-prompts.md',
        content: combinedContent,
        metadata: {
          exportedAt,
          totalSize,
          settings: {
            format,
            includeFrontmatter,
            includeCreatedDate,
            includeUpdatedDate,
            includeTags,
            sanitizeContent,
            sortBy,
            sortOrder
          }
        }
      }

      // Validate the result
      try {
        MarkdownExportResultSchema.parse(result)
      } catch (error) {
        if (error instanceof ZodError) {
          throw ErrorFactory.validationFailed(error, { entity: 'MarkdownExportResult' })
        }
        throw error
      }
      return result
    } else {
      // Export each prompt to a separate file
      const files: ExportedFile[] = []

      for (const prompt of sortedPrompts) {
        const frontmatter: Record<string, any> = includeFrontmatter
          ? {
              name: prompt.title || `prompt-${prompt.id}`
            }
          : {}

        if (includeFrontmatter) {
          if (includeCreatedDate && prompt.createdAt) {
            frontmatter.created = new Date(prompt.createdAt).toISOString()
          }
          if (includeUpdatedDate && prompt.updatedAt) {
            frontmatter.updated = new Date(prompt.updatedAt).toISOString()
          }
          if (includeTags) {
            frontmatter.tags = []
          }
        }

        let content = prompt.content
        if (sanitizeContent) {
          // Sanitize content to prevent XSS and other security issues
          content = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [], // Remove all HTML tags
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true // Keep text content
          })
            .replace(/^---/gm, '\\---')
            .trim()
        }

        const promptMarkdown = includeFrontmatter ? matter.stringify(content, frontmatter) : content

        // Generate safe filename
        const safeFileName =
          (prompt.title || `prompt-${prompt.id}`)
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .slice(0, 50) + '.md'

        files.push({
          fileName: safeFileName,
          content: promptMarkdown,
          promptId: prompt.id,
          promptName: prompt.title
        })

        totalSize += Buffer.byteLength(promptMarkdown, 'utf8')
      }

      const result: MarkdownExportResult = {
        success: true,
        format: 'multi-file',
        promptCount: sortedPrompts.length,
        files,
        metadata: {
          exportedAt,
          totalSize,
          settings: {
            format,
            includeFrontmatter,
            includeCreatedDate,
            includeUpdatedDate,
            includeTags,
            sanitizeContent,
            sortBy,
            sortOrder
          }
        }
      }

      // Validate the result
      try {
        MarkdownExportResultSchema.parse(result)
      } catch (error) {
        if (error instanceof ZodError) {
          throw ErrorFactory.validationFailed(error, { entity: 'MarkdownExportResult' })
        }
        throw error
      }
      return result
    }
}

// Export type for consumers
export type MarkdownPromptService = ReturnType<typeof createMarkdownPromptService>

// Export singleton for backward compatibility
export const markdownPromptService = createMarkdownPromptService()

// Export individual functions for tree-shaking
export const {
  parseMarkdownToPrompt,
  promptToMarkdown,
  validateMarkdownContent,
  extractPromptMetadata,
  bulkImportMarkdownPrompts,
  exportPromptsToMarkdown
} = markdownPromptService
