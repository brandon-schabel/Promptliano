import { z } from '@hono/zod-openapi'
import type { MCPToolDefinition, MCPToolResponse } from './tools-registry'
import { MCPError, MCPErrorCode, createMCPError, formatMCPErrorResponse } from './mcp-errors'
import { executeTransaction, createTransactionStep } from './mcp-transaction'
import { trackMCPToolExecution } from '@octoprompt/services'
import {
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectFiles,
  updateFileContent,
  optimizeUserInput,
  suggestFiles,
  getCompactProjectSummary,
  listAllPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  listPromptsByProject,
  addPromptToProject,
  removePromptFromProject,
  suggestPrompts,
  createTicket,
  getTicketById,
  listTicketsByProject,
  updateTicket,
  deleteTicket,
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  reorderTasks,
  suggestTasksForTicket,
  autoGenerateTasksFromOverview,
  suggestFilesForTicket,
  listTicketsWithTaskCount,
  searchTickets,
  filterTasks,
  batchCreateTickets,
  batchUpdateTickets,
  batchDeleteTickets,
  batchCreateTasks,
  batchUpdateTasks,
  batchDeleteTasks,
  batchMoveTasks,
  syncProject,
  // Git operations
  getProjectGitStatus,
  stageFiles,
  unstageFiles,
  stageAll,
  unstageAll,
  commitChanges,
  getBranches,
  getCurrentBranch,
  createBranch,
  switchBranch,
  deleteBranch,
  mergeBranch,
  getCommitLog,
  getCommitDetails,
  getFileDiff,
  getCommitDiff,
  cherryPick,
  getRemotes,
  addRemote,
  removeRemote,
  fetch,
  pull,
  push,
  getTags,
  createTag,
  deleteTag,
  stash,
  stashList,
  stashApply,
  stashPop,
  stashDrop,
  reset,
  revert,
  blame,
  clean,
  getConfig,
  setConfig,
  // Enhanced git operations
  getCommitLogEnhanced,
  getBranchesEnhanced,
  getCommitDetail,
  // Worktree operations
  getWorktrees,
  addWorktree,
  removeWorktree,
  lockWorktree,
  unlockWorktree,
  pruneWorktrees,
  bulkDeleteProjectFiles,
  // Active tab functionality
  getOrCreateDefaultActiveTab,
  getActiveTab,
  setActiveTab,
  clearActiveTab,
  fileSearchService
} from '@octoprompt/services'
import type {
  CreateProjectBody,
  UpdateProjectBody,
  CreatePromptBody,
  UpdatePromptBody,
  CreateTicketBody,
  UpdateTicketBody,
  UpdateTaskBody
} from '@octoprompt/schemas'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

// Re-export error codes for backward compatibility
export { MCPErrorCode } from './mcp-errors'

// Helper function to validate required parameters
function validateRequiredParam<T>(
  value: T | undefined | null,
  paramName: string,
  paramType: string = 'parameter',
  example?: string
): T {
  if (value === undefined || value === null) {
    const exampleText = example ? `\nExample: { "${paramName}": ${example} }` : ''
    throw createMCPError(MCPErrorCode.MISSING_REQUIRED_PARAM, `${paramName} is required${exampleText}`, {
      parameter: paramName,
      value: value,
      validationErrors: { [paramName]: `Required ${paramType} is missing` }
    })
  }
  return value
}

// Helper function to validate required fields in data object
function validateDataField<T>(data: any, fieldName: string, fieldType: string = 'field', example?: string): T {
  const value = data?.[fieldName]
  if (value === undefined || value === null) {
    const exampleText = example ? `\nExample: { "data": { "${fieldName}": ${example} } }` : ''
    throw createMCPError(MCPErrorCode.MISSING_REQUIRED_PARAM, `${fieldName} is required in data${exampleText}`, {
      parameter: `data.${fieldName}`,
      value: value,
      validationErrors: { [fieldName]: `Required ${fieldType} is missing from data object` },
      relatedResources: [`data.${fieldName}`]
    })
  }
  return value as T
}

// Helper function to wrap tool handlers with tracking
function createTrackedHandler(
  toolName: string,
  handler: (args: any) => Promise<MCPToolResponse>
): (args: any) => Promise<MCPToolResponse> {
  return async (args: any) => {
    // Extract projectId if available
    const projectId = args.projectId as number | undefined

    // Use the tracking service to wrap the handler
    return trackMCPToolExecution(toolName, projectId, args, () => handler(args))
  }
}

// Action type enums for each consolidated tool
export enum ProjectManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  GET_SUMMARY = 'get_summary',
  GET_SUMMARY_ADVANCED = 'get_summary_advanced',
  GET_SUMMARY_METRICS = 'get_summary_metrics',
  BROWSE_FILES = 'browse_files',
  GET_FILE_CONTENT = 'get_file_content',
  UPDATE_FILE_CONTENT = 'update_file_content',
  SUGGEST_FILES = 'suggest_files',
  GET_SELECTION_CONTEXT = 'get_selection_context',
  SEARCH = 'search',
  FAST_SEARCH_FILES = 'fast_search_files',
  CREATE_FILE = 'create_file',
  GET_FILE_CONTENT_PARTIAL = 'get_file_content_partial',
  DELETE_FILE = 'delete_file',
  GET_FILE_TREE = 'get_file_tree',
  OVERVIEW = 'overview'
}

export enum PromptManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_BY_PROJECT = 'list_by_project',
  ADD_TO_PROJECT = 'add_to_project',
  REMOVE_FROM_PROJECT = 'remove_from_project',
  SUGGEST_PROMPTS = 'suggest_prompts'
}

export enum TicketManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST_WITH_TASK_COUNT = 'list_with_task_count',
  SUGGEST_TASKS = 'suggest_tasks',
  AUTO_GENERATE_TASKS = 'auto_generate_tasks',
  SUGGEST_FILES = 'suggest_files',
  SEARCH = 'search',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete'
}

export enum TaskManagerAction {
  LIST = 'list',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  REORDER = 'reorder',
  SUGGEST_FILES = 'suggest_files',
  UPDATE_CONTEXT = 'update_context',
  GET_WITH_CONTEXT = 'get_with_context',
  ANALYZE_COMPLEXITY = 'analyze_complexity',
  FILTER = 'filter',
  BATCH_CREATE = 'batch_create',
  BATCH_UPDATE = 'batch_update',
  BATCH_DELETE = 'batch_delete',
  BATCH_MOVE = 'batch_move'
}

export enum AIAssistantAction {
  OPTIMIZE_PROMPT = 'optimize_prompt',
  GET_COMPACT_SUMMARY = 'get_compact_summary',
  GET_COMPACT_SUMMARY_WITH_OPTIONS = 'get_compact_summary_with_options'
}

export enum GitManagerAction {
  STATUS = 'status',
  STAGE_FILES = 'stage_files',
  UNSTAGE_FILES = 'unstage_files',
  STAGE_ALL = 'stage_all',
  UNSTAGE_ALL = 'unstage_all',
  COMMIT = 'commit',
  BRANCHES = 'branches',
  CURRENT_BRANCH = 'current_branch',
  CREATE_BRANCH = 'create_branch',
  SWITCH_BRANCH = 'switch_branch',
  DELETE_BRANCH = 'delete_branch',
  MERGE_BRANCH = 'merge_branch',
  LOG = 'log',
  LOG_ENHANCED = 'log_enhanced',
  COMMIT_DETAILS = 'commit_details',
  COMMIT_DETAIL = 'commit_detail',
  FILE_DIFF = 'file_diff',
  COMMIT_DIFF = 'commit_diff',
  CHERRY_PICK = 'cherry_pick',
  REMOTES = 'remotes',
  ADD_REMOTE = 'add_remote',
  REMOVE_REMOTE = 'remove_remote',
  FETCH = 'fetch',
  PULL = 'pull',
  PUSH = 'push',
  TAGS = 'tags',
  CREATE_TAG = 'create_tag',
  DELETE_TAG = 'delete_tag',
  STASH = 'stash',
  STASH_LIST = 'stash_list',
  STASH_APPLY = 'stash_apply',
  STASH_POP = 'stash_pop',
  STASH_DROP = 'stash_drop',
  RESET = 'reset',
  REVERT = 'revert',
  BLAME = 'blame',
  CLEAN = 'clean',
  CONFIG_GET = 'config_get',
  CONFIG_SET = 'config_set',
  BRANCHES_ENHANCED = 'branches_enhanced',
  WORKTREE_LIST = 'worktree_list',
  WORKTREE_ADD = 'worktree_add',
  WORKTREE_REMOVE = 'worktree_remove',
  WORKTREE_LOCK = 'worktree_lock',
  WORKTREE_UNLOCK = 'worktree_unlock',
  WORKTREE_PRUNE = 'worktree_prune'
}

export enum TabManagerAction {
  GET_ACTIVE = 'get_active',
  SET_ACTIVE = 'set_active',
  CLEAR_ACTIVE = 'clear_active',
  GENERATE_NAME = 'generate_name'
}

export enum JobManagerAction {
  LIST = 'list',
  GET = 'get',
  CREATE = 'create',
  CANCEL = 'cancel',
  RETRY = 'retry',
  CLEANUP = 'cleanup'
}

export enum FileSummarizationManagerAction {
  IDENTIFY_UNSUMMARIZED = 'identify_unsummarized',
  GROUP_FILES = 'group_files',
  SUMMARIZE_BATCH = 'summarize_batch',
  GET_PROGRESS = 'get_progress',
  CANCEL_BATCH = 'cancel_batch',
  GET_SUMMARY_STATS = 'get_summary_stats'
}

// Consolidated tool schemas
const ProjectManagerSchema = z.object({
  action: z.enum([
    ProjectManagerAction.LIST,
    ProjectManagerAction.GET,
    ProjectManagerAction.CREATE,
    ProjectManagerAction.UPDATE,
    ProjectManagerAction.DELETE,
    ProjectManagerAction.GET_SUMMARY,
    ProjectManagerAction.GET_SUMMARY_ADVANCED,
    ProjectManagerAction.GET_SUMMARY_METRICS,
    ProjectManagerAction.BROWSE_FILES,
    ProjectManagerAction.GET_FILE_CONTENT,
    ProjectManagerAction.UPDATE_FILE_CONTENT,
    ProjectManagerAction.SUGGEST_FILES,
    ProjectManagerAction.GET_SELECTION_CONTEXT,
    ProjectManagerAction.SEARCH,
    ProjectManagerAction.FAST_SEARCH_FILES,
    ProjectManagerAction.CREATE_FILE,
    ProjectManagerAction.GET_FILE_CONTENT_PARTIAL,
    ProjectManagerAction.DELETE_FILE,
    ProjectManagerAction.GET_FILE_TREE,
    ProjectManagerAction.OVERVIEW
  ]),
  projectId: z.number().optional(),
  data: z.any().optional()
})

const PromptManagerSchema = z.object({
  action: z.enum([
    PromptManagerAction.LIST,
    PromptManagerAction.GET,
    PromptManagerAction.CREATE,
    PromptManagerAction.UPDATE,
    PromptManagerAction.DELETE,
    PromptManagerAction.LIST_BY_PROJECT,
    PromptManagerAction.ADD_TO_PROJECT,
    PromptManagerAction.REMOVE_FROM_PROJECT,
    PromptManagerAction.SUGGEST_PROMPTS
  ]),
  projectId: z.number().optional(),
  data: z.any().optional()
})

const TicketManagerSchema = z.object({
  action: z.enum([
    TicketManagerAction.LIST,
    TicketManagerAction.GET,
    TicketManagerAction.CREATE,
    TicketManagerAction.UPDATE,
    TicketManagerAction.DELETE,
    TicketManagerAction.LIST_WITH_TASK_COUNT,
    TicketManagerAction.SUGGEST_TASKS,
    TicketManagerAction.AUTO_GENERATE_TASKS,
    TicketManagerAction.SUGGEST_FILES,
    TicketManagerAction.SEARCH,
    TicketManagerAction.BATCH_CREATE,
    TicketManagerAction.BATCH_UPDATE,
    TicketManagerAction.BATCH_DELETE
  ]),
  projectId: z.number().optional(),
  data: z.any().optional()
})

const TaskManagerSchema = z.object({
  action: z.enum([
    TaskManagerAction.LIST,
    TaskManagerAction.CREATE,
    TaskManagerAction.UPDATE,
    TaskManagerAction.DELETE,
    TaskManagerAction.REORDER,
    TaskManagerAction.SUGGEST_FILES,
    TaskManagerAction.UPDATE_CONTEXT,
    TaskManagerAction.GET_WITH_CONTEXT,
    TaskManagerAction.ANALYZE_COMPLEXITY,
    TaskManagerAction.FILTER,
    TaskManagerAction.BATCH_CREATE,
    TaskManagerAction.BATCH_UPDATE,
    TaskManagerAction.BATCH_DELETE,
    TaskManagerAction.BATCH_MOVE
  ]),
  ticketId: z.number().optional(),
  data: z.any().optional()
})

const AIAssistantSchema = z.object({
  action: z.enum([
    AIAssistantAction.OPTIMIZE_PROMPT, 
    AIAssistantAction.GET_COMPACT_SUMMARY,
    AIAssistantAction.GET_COMPACT_SUMMARY_WITH_OPTIONS
  ]),
  projectId: z.number(),
  data: z.any().optional()
})

const GitManagerSchema = z.object({
  action: z.enum([
    GitManagerAction.STATUS,
    GitManagerAction.STAGE_FILES,
    GitManagerAction.UNSTAGE_FILES,
    GitManagerAction.STAGE_ALL,
    GitManagerAction.UNSTAGE_ALL,
    GitManagerAction.COMMIT,
    GitManagerAction.BRANCHES,
    GitManagerAction.CURRENT_BRANCH,
    GitManagerAction.CREATE_BRANCH,
    GitManagerAction.SWITCH_BRANCH,
    GitManagerAction.DELETE_BRANCH,
    GitManagerAction.MERGE_BRANCH,
    GitManagerAction.LOG,
    GitManagerAction.LOG_ENHANCED,
    GitManagerAction.COMMIT_DETAILS,
    GitManagerAction.COMMIT_DETAIL,
    GitManagerAction.FILE_DIFF,
    GitManagerAction.COMMIT_DIFF,
    GitManagerAction.CHERRY_PICK,
    GitManagerAction.REMOTES,
    GitManagerAction.ADD_REMOTE,
    GitManagerAction.REMOVE_REMOTE,
    GitManagerAction.FETCH,
    GitManagerAction.PULL,
    GitManagerAction.PUSH,
    GitManagerAction.TAGS,
    GitManagerAction.CREATE_TAG,
    GitManagerAction.DELETE_TAG,
    GitManagerAction.STASH,
    GitManagerAction.STASH_LIST,
    GitManagerAction.STASH_APPLY,
    GitManagerAction.STASH_POP,
    GitManagerAction.STASH_DROP,
    GitManagerAction.RESET,
    GitManagerAction.REVERT,
    GitManagerAction.BLAME,
    GitManagerAction.CLEAN,
    GitManagerAction.CONFIG_GET,
    GitManagerAction.CONFIG_SET,
    GitManagerAction.BRANCHES_ENHANCED,
    GitManagerAction.WORKTREE_LIST,
    GitManagerAction.WORKTREE_ADD,
    GitManagerAction.WORKTREE_REMOVE,
    GitManagerAction.WORKTREE_LOCK,
    GitManagerAction.WORKTREE_UNLOCK,
    GitManagerAction.WORKTREE_PRUNE
  ]),
  projectId: z.number(),
  data: z.any().optional()
})

const TabManagerSchema = z.object({
  action: z.enum([TabManagerAction.GET_ACTIVE, TabManagerAction.SET_ACTIVE, TabManagerAction.CLEAR_ACTIVE, TabManagerAction.GENERATE_NAME]),
  projectId: z.number(),
  data: z.any().optional()
})

const JobManagerSchema = z.object({
  action: z.enum([
    JobManagerAction.LIST,
    JobManagerAction.GET,
    JobManagerAction.CREATE,
    JobManagerAction.CANCEL,
    JobManagerAction.RETRY,
    JobManagerAction.CLEANUP
  ]),
  jobId: z.number().optional(),
  projectId: z.number().optional(),
  data: z.any().optional()
})

const FileSummarizationManagerSchema = z.object({
  action: z.enum([
    FileSummarizationManagerAction.IDENTIFY_UNSUMMARIZED,
    FileSummarizationManagerAction.GROUP_FILES,
    FileSummarizationManagerAction.SUMMARIZE_BATCH,
    FileSummarizationManagerAction.GET_PROGRESS,
    FileSummarizationManagerAction.CANCEL_BATCH,
    FileSummarizationManagerAction.GET_SUMMARY_STATS
  ]),
  projectId: z.number(),
  data: z.any().optional()
})

// Consolidated tool definitions
export const CONSOLIDATED_TOOLS: readonly MCPToolDefinition[] = [
  {
    name: 'project_manager',
    description:
      'Manage projects, files, and project-related operations. Actions: list, get, create, update, delete (⚠️ DELETES ENTIRE PROJECT - requires confirmDelete:true), delete_file (delete single file), get_summary, get_summary_advanced (with options for depth/format/strategy), get_summary_metrics (summary generation metrics), browse_files, get_file_content, update_file_content, suggest_files, get_selection_context (get complete active tab context), search, fast_search_files (fast semantic search without AI), create_file, get_file_content_partial, get_file_tree (returns project file structure with file IDs), overview (get essential project context - recommended first tool)',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(ProjectManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for all actions except "list" and "create"). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For get_file_content: { path: "src/index.ts" }. For browse_files: { path: "src/" }. For create: { name: "My Project", path: "/path/to/project" }. For delete_file: { path: "src/file.ts" }. For fast_search_files: { query: "search term", searchType: "semantic" | "exact" | "fuzzy" | "regex" (default: "semantic"), fileTypes: ["ts", "js"], limit: 20, includeContext: false, scoringMethod: "relevance" | "recency" | "frequency" }. For get_summary_advanced: { depth: "minimal" | "standard" | "detailed", format: "xml" | "json" | "markdown", strategy: "fast" | "balanced" | "thorough", focus: ["api", "frontend"], includeMetrics: true }. For overview: no data required'
        }
      },
      required: ['action']
    },
    handler: createTrackedHandler(
      'project_manager',
      async (args: z.infer<typeof ProjectManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args

          switch (action) {
            case ProjectManagerAction.LIST: {
              const projects = await listProjects()
              const projectList = projects.map((p) => `${p.id}: ${p.name} (${p.path})`).join('\n')
              return {
                content: [{ type: 'text', text: projectList || 'No projects found' }]
              }
            }

            case ProjectManagerAction.GET: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const project = await getProjectById(validProjectId)
              const details = `Project: ${project.name}\nPath: ${project.path}\nDescription: ${project.description}\nCreated: ${new Date(project.created).toLocaleString()}\nUpdated: ${new Date(project.updated).toLocaleString()}`
              return {
                content: [{ type: 'text', text: details }]
              }
            }

            case ProjectManagerAction.CREATE: {
              const createData = data as CreateProjectBody
              const name = validateDataField<string>(createData, 'name', 'string', '"My Project"')
              const path = validateDataField<string>(createData, 'path', 'string', '"/Users/me/projects/myproject"')
              const project = await createProject(createData)
              return {
                content: [{ type: 'text', text: `Project created successfully: ${project.name} (ID: ${project.id})` }]
              }
            }

            case ProjectManagerAction.UPDATE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
              const updateData = data as UpdateProjectBody
              const project = await updateProject(validProjectId, updateData)
              return {
                content: [
                  { type: 'text', text: `Project updated successfully: ${project?.name} (ID: ${validProjectId})` }
                ]
              }
            }

            case ProjectManagerAction.DELETE: {
              // WARNING: This action deletes the ENTIRE PROJECT, not just a file!
              // Use DELETE_FILE to delete individual files
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')

              // Add extra validation to prevent accidental deletion
              if (!data || !data.confirmDelete) {
                throw createMCPError(
                  MCPErrorCode.VALIDATION_FAILED,
                  'Project deletion requires explicit confirmation',
                  {
                    parameter: 'data.confirmDelete',
                    validationErrors: {
                      confirmDelete: 'Must be set to true to confirm project deletion'
                    },
                    relatedResources: [`project:${validProjectId}`]
                  }
                )
              }

              const success = await deleteProject(validProjectId)
              return {
                content: [
                  {
                    type: 'text',
                    text: success
                      ? `⚠️ ENTIRE PROJECT ${validProjectId} has been permanently deleted`
                      : `Failed to delete project ${validProjectId}`
                  }
                ]
              }
            }

            case ProjectManagerAction.GET_SUMMARY: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
              const summary = await getCompactProjectSummary(validProjectId)
              return {
                content: [{ type: 'text', text: summary }]
              }
            }
            
            case ProjectManagerAction.GET_SUMMARY_ADVANCED: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
              const { getProjectSummaryWithOptions } = await import('@octoprompt/services')
              const { SummaryOptionsSchema } = await import('@octoprompt/schemas')
              
              // Parse and validate options
              const options = SummaryOptionsSchema.parse(data || {})
              const result = await getProjectSummaryWithOptions(validProjectId, options)
              
              // Format response based on whether metrics were requested
              if (options.includeMetrics && result.metrics) {
                const metricsText = `
Summary Metrics:
- Generation Time: ${result.metrics.generationTime}ms
- Files Processed: ${result.metrics.filesProcessed}
- Original Size: ${result.metrics.originalSize} chars
- Compressed Size: ${result.metrics.compressedSize} chars
- Compression Ratio: ${(result.metrics.compressionRatio * 100).toFixed(1)}%
- Tokens Saved: ~${result.metrics.tokensSaved}
- Cache Hit: ${result.metrics.cacheHit ? 'Yes' : 'No'}

Summary:
${result.summary}`
                return {
                  content: [{ type: 'text', text: metricsText }]
                }
              }
              
              return {
                content: [{ type: 'text', text: result.summary }]
              }
            }
            
            case ProjectManagerAction.GET_SUMMARY_METRICS: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
              const { getProjectSummaryWithOptions } = await import('@octoprompt/services')
              
              // Get summary with metrics for standard options
              const result = await getProjectSummaryWithOptions(validProjectId, {
                depth: 'standard',
                format: 'xml',
                strategy: 'balanced',
                includeImports: true,
                includeExports: true,
                progressive: false,
                includeMetrics: true
              })
              
              if (!result.metrics) {
                return {
                  content: [{ type: 'text', text: 'No metrics available' }]
                }
              }
              
              const metricsReport = `
Project Summary Metrics:
- Generation Time: ${result.metrics.generationTime}ms
- Files Processed: ${result.metrics.filesProcessed}
- Original Size: ${result.metrics.originalSize.toLocaleString()} characters
- Compressed Size: ${result.metrics.compressedSize.toLocaleString()} characters
- Compression Ratio: ${(result.metrics.compressionRatio * 100).toFixed(1)}%
- Estimated Tokens Saved: ~${result.metrics.tokensSaved.toLocaleString()}
- Cache Status: ${result.metrics.cacheHit ? 'Hit (from cache)' : 'Miss (generated)'}
- Content Truncated: ${result.metrics.truncated ? 'Yes' : 'No'}

Version Info:
- Format Version: ${result.version.version}
- Model Used: ${result.version.model}
- Generated: ${new Date(result.version.generated).toLocaleString()}`
              
              return {
                content: [{ type: 'text', text: metricsReport }]
              }
            }

            case ProjectManagerAction.BROWSE_FILES: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number')
              const project = await getProjectById(validProjectId)
              const files = await getProjectFiles(validProjectId)
              if (!files) {
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                  projectId: validProjectId
                })
              }

              const browsePath = data?.path as string | undefined
              let result = `Project: ${project.name}\n`
              result += `Path: ${project.path}\n`
              result += `Total files: ${files.length}\n\n`

              if (browsePath) {
                const filteredFiles = files
                  .filter((file) => file.path.startsWith(browsePath))
                  .sort((a, b) => a.path.localeCompare(b.path))

                result += `Files under ${browsePath}:\n`
                for (const file of filteredFiles) {
                  const relativePath = file.path.substring(browsePath.length).replace(/^\//, '')
                  result += `  ${relativePath}\n`
                }
              } else {
                const dirs = new Set<string>()
                const rootFiles: string[] = []

                files.forEach((file) => {
                  const parts = file.path.split('/')
                  if (parts.length > 1) {
                    dirs.add(parts[0])
                  } else {
                    rootFiles.push(file.path)
                  }
                })

                result += 'Directories:\n'
                Array.from(dirs)
                  .sort()
                  .forEach((dir) => {
                    result += `  ${dir}/\n`
                  })

                if (rootFiles.length > 0) {
                  result += '\nRoot files:\n'
                  rootFiles.sort().forEach((file) => {
                    result += `  ${file}\n`
                  })
                }
              }

              return {
                content: [{ type: 'text', text: result }]
              }
            }

            case ProjectManagerAction.GET_FILE_CONTENT: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts" or "README.md"')

              const project = await getProjectById(validProjectId)
              const files = await getProjectFiles(validProjectId)
              if (!files) {
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                  projectId: validProjectId
                })
              }

              const file = files.find((f) => f.path === filePath)
              if (!file) {
                // Provide helpful error with available files hint
                const availablePaths = files.slice(0, 5).map((f) => f.path)
                throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
                  requestedPath: filePath,
                  availableFiles: availablePaths,
                  totalFiles: files.length,
                  hint: 'Use browse_files action to explore available files'
                })
              }

              // Check if it's an image file
              const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
              const ext = path.extname(filePath).toLowerCase()

              if (imageExtensions.includes(ext)) {
                const fullPath = path.join(project.path, filePath)
                try {
                  const fileData = await fs.readFile(fullPath)
                  const base64 = fileData.toString('base64')
                  return {
                    content: [
                      {
                        type: 'image',
                        data: base64,
                        mimeType: `image/${ext.substring(1)}`
                      } as any
                    ]
                  }
                } catch (error) {
                  throw new Error(
                    `Failed to read image file: ${error instanceof Error ? error.message : String(error)}`
                  )
                }
              }

              return {
                content: [{ type: 'text', text: file.content || '' }]
              }
            }

            case ProjectManagerAction.UPDATE_FILE_CONTENT: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts"')
              const content = validateDataField<string>(data, 'content', 'string', '"// Updated content"')

              const files = await getProjectFiles(validProjectId)
              if (!files) {
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                  projectId: validProjectId
                })
              }

              const file = files.find((f) => f.path === filePath)
              if (!file) {
                const availablePaths = files.slice(0, 5).map((f) => f.path)
                throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
                  requestedPath: filePath,
                  availableFiles: availablePaths,
                  totalFiles: files.length
                })
              }

              await updateFileContent(validProjectId, file.id, content)
              return {
                content: [{ type: 'text', text: `File ${filePath} updated successfully` }]
              }
            }

            case ProjectManagerAction.SUGGEST_FILES: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const prompt = validateDataField<string>(data, 'prompt', 'string', '"authentication flow"')
              const limit = (data?.limit as number) || 10

              const suggestions = await suggestFiles(validProjectId, prompt, limit)
              const suggestionText = suggestions.map((f) => `${f.path} - ${f.summary || 'No summary'}`).join('\n')
              return {
                content: [{ type: 'text', text: suggestionText || 'No file suggestions found' }]
              }
            }

            case ProjectManagerAction.GET_SELECTION_CONTEXT: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')

              // Get active tab to get selection context
              const activeTab = await getActiveTab(validProjectId)
              if (!activeTab) {
                return {
                  content: [{ type: 'text', text: 'No active tab found' }]
                }
              }

              const tabMetadata = activeTab.data.tabMetadata
              if (!tabMetadata) {
                return {
                  content: [{ type: 'text', text: 'No active tab metadata found' }]
                }
              }

              // Get file details if there are selected files
              let fileList = ''
              if (tabMetadata.selectedFiles && tabMetadata.selectedFiles.length > 0) {
                const files = await getProjectFiles(validProjectId)
                const selectedFileDetails = files?.filter((f) => tabMetadata.selectedFiles.includes(f.id)) || []
                fileList = selectedFileDetails.map((f) => `  - ${f.path} (${f.size} bytes)`).join('\n')
              }

              // Build comprehensive context output
              let contextText = `Active tab context for project ${validProjectId}:\n`
              contextText += `\nTab ID: ${activeTab.data.activeTabId}`
              contextText += `\nTab Name: ${tabMetadata.displayName || 'Unnamed Tab'}`
              contextText += `\n\nSelected files (${tabMetadata.selectedFiles?.length || 0}):\n${fileList || '  None'}`
              contextText += `\n\nPrompt IDs: ${tabMetadata.selectedPrompts?.join(', ') || 'none'}`
              contextText += `\nUser prompt: ${tabMetadata.userPrompt || 'empty'}`
              contextText += `\n\nSearch/Filter Settings:`
              contextText += `\n  File search: ${tabMetadata.fileSearch || 'none'}`
              contextText += `\n  Search by content: ${tabMetadata.searchByContent || false}`
              contextText += `\n  Resolve imports: ${tabMetadata.resolveImports || false}`
              contextText += `\n  Context limit: ${tabMetadata.contextLimit || 'default'}`
              contextText += `\n  Preferred editor: ${tabMetadata.preferredEditor || 'default'}`

              if (tabMetadata.ticketSearch || tabMetadata.ticketSort || tabMetadata.ticketStatusFilter) {
                contextText += `\n\nTicket Settings:`
                contextText += `\n  Search: ${tabMetadata.ticketSearch || 'none'}`
                contextText += `\n  Sort: ${tabMetadata.ticketSort || 'default'}`
                contextText += `\n  Status filter: ${tabMetadata.ticketStatusFilter || 'all'}`
              }

              contextText += `\n\nUI State:`
              contextText += `\n  Prompts panel: ${tabMetadata.promptsPanelCollapsed ? 'collapsed' : 'expanded'}`
              contextText += `\n  Selected files panel: ${tabMetadata.selectedFilesCollapsed ? 'collapsed' : 'expanded'}`

              contextText += `\n\nLast updated: ${new Date(activeTab.data.lastUpdated).toISOString()}`

              return {
                content: [
                  {
                    type: 'text',
                    text: contextText
                  }
                ]
              }
            }

            case ProjectManagerAction.SEARCH: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const query = validateDataField<string>(data, 'query', 'string', '"authentication" or "login"')
              const searchIn = (data?.searchIn as 'path' | 'content' | 'both') || 'both'
              const caseSensitive = (data?.caseSensitive as boolean) || false

              const project = await getProjectById(validProjectId)
              const files = await getProjectFiles(validProjectId)
              if (!files) {
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                  projectId: validProjectId
                })
              }

              const results: { path: string; matches: string[] }[] = []
              const queryLower = caseSensitive ? query : query.toLowerCase()

              for (const file of files) {
                let matches: string[] = []

                // Search in path
                if (searchIn === 'path' || searchIn === 'both') {
                  const filePath = caseSensitive ? file.path : file.path.toLowerCase()
                  if (filePath.includes(queryLower)) {
                    matches.push(`Path match: ${file.path}`)
                  }
                }

                // Search in content
                if (searchIn === 'content' || searchIn === 'both') {
                  if (file.content) {
                    const content = caseSensitive ? file.content : file.content.toLowerCase()
                    if (content.includes(queryLower)) {
                      // Find line numbers with matches
                      const lines = file.content.split('\n')
                      const matchingLines: string[] = []
                      lines.forEach((line, index) => {
                        const lineToSearch = caseSensitive ? line : line.toLowerCase()
                        if (lineToSearch.includes(queryLower)) {
                          matchingLines.push(`  Line ${index + 1}: ${line.trim()}`)
                        }
                      })
                      if (matchingLines.length > 0) {
                        matches.push(
                          `Content matches:\n${matchingLines.slice(0, 5).join('\n')}${matchingLines.length > 5 ? `\n  ... and ${matchingLines.length - 5} more matches` : ''}`
                        )
                      }
                    }
                  }
                }

                if (matches.length > 0) {
                  results.push({ path: file.path, matches })
                }
              }

              let resultText = `Search results for "${query}" in project ${project.name}:\n`
              resultText += `Search mode: ${searchIn}, Case sensitive: ${caseSensitive}\n\n`

              if (results.length === 0) {
                resultText += 'No matches found.'
              } else {
                resultText += `Found ${results.length} files with matches:\n\n`
                for (const result of results.slice(0, 20)) {
                  resultText += `📄 ${result.path}\n${result.matches.join('\n')}\n\n`
                }
                if (results.length > 20) {
                  resultText += `... and ${results.length - 20} more files`
                }
              }

              return {
                content: [{ type: 'text', text: resultText }]
              }
            }

            case ProjectManagerAction.FAST_SEARCH_FILES: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const query = validateDataField<string>(data, 'query', 'string', '"authentication" or "login"')

              // Optional parameters with defaults
              const searchType = (data?.searchType as 'exact' | 'fuzzy' | 'semantic' | 'regex') || 'semantic'
              const fileTypes = data?.fileTypes as string[] | undefined
              const limit = (data?.limit as number) || 20
              const includeContext = (data?.includeContext as boolean) || false
              const scoringMethod = (data?.scoringMethod as 'relevance' | 'recency' | 'frequency') || 'relevance'

              // Perform fast search
              const searchResults = await fileSearchService.search(validProjectId, {
                query,
                searchType,
                fileTypes,
                limit,
                includeContext,
                scoringMethod
              })

              // Format results
              let resultText = `🔍 Fast ${searchType} search for "${query}" in project ${validProjectId}\n`
              resultText += `Found ${searchResults.stats.totalResults} results in ${searchResults.stats.searchTime}ms`
              resultText += searchResults.stats.cached ? ' (cached)\n\n' : '\n\n'

              if (searchResults.results.length === 0) {
                resultText += 'No matches found.'
              } else {
                for (const result of searchResults.results) {
                  resultText += `📄 ${result.file.path} (score: ${result.score.toFixed(2)})\n`

                  if (result.snippet) {
                    resultText += `  Preview: ${result.snippet}\n`
                  }

                  if (result.keywords && result.keywords.length > 0) {
                    resultText += `  Keywords: ${result.keywords.join(', ')}\n`
                  }

                  if (result.matches.length > 0) {
                    resultText += `  Matches:\n`
                    for (const match of result.matches.slice(0, 3)) {
                      resultText += `    Line ${match.line}: ${match.text}\n`
                    }
                    if (result.matches.length > 3) {
                      resultText += `    ... and ${result.matches.length - 3} more matches\n`
                    }
                  }

                  resultText += '\n'
                }

                if (searchResults.stats.totalResults > limit) {
                  resultText += `Showing top ${limit} of ${searchResults.stats.totalResults} total results.\n`
                }

                resultText += `\nIndex coverage: ${searchResults.stats.indexCoverage}%`
              }

              return {
                content: [{ type: 'text', text: resultText }]
              }
            }

            case ProjectManagerAction.CREATE_FILE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const filePath = validateDataField<string>(data, 'path', 'string', '"src/new-file.ts"')
              const content = validateDataField<string>(data, 'content', 'string', '"// New file content"')

              // Validate path doesn't contain dangerous patterns
              if (filePath.includes('..') || path.isAbsolute(filePath)) {
                throw createMCPError(
                  MCPErrorCode.PATH_TRAVERSAL_DENIED,
                  'Invalid file path - must be relative and within project directory',
                  {
                    parameter: 'path',
                    value: filePath,
                    validationErrors: { path: 'Path must be relative and cannot contain ".."' }
                  }
                )
              }

              const project = await getProjectById(validProjectId)
              const fullPath = path.join(project.path, filePath)

              // Create transaction for file creation
              const transaction = await executeTransaction([
                createTransactionStep('validate-project-files', async () => {
                  const files = await getProjectFiles(validProjectId)
                  if (!files) {
                    throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                      relatedResources: [`project:${validProjectId}`]
                    })
                  }

                  // Check if file already exists
                  const existingFile = files.find((f) => f.path === filePath)
                  if (existingFile) {
                    throw createMCPError(MCPErrorCode.RESOURCE_ALREADY_EXISTS, `File already exists: ${filePath}`, {
                      parameter: 'path',
                      value: filePath,
                      relatedResources: [`file:${existingFile.id}`]
                    })
                  }

                  return { files, projectPath: project.path }
                }),
                createTransactionStep(
                  'create-directory',
                  async () => {
                    const dir = path.dirname(fullPath)
                    await fs.mkdir(dir, { recursive: true })
                    return dir
                  },
                  async (createdDir) => {
                    // No rollback needed for directory creation
                    // It's safe to leave empty directories
                  }
                ),
                createTransactionStep(
                  'write-file',
                  async () => {
                    await fs.writeFile(fullPath, content, 'utf-8')
                    return fullPath
                  },
                  async (writtenPath) => {
                    // Rollback: delete the file if it was created
                    try {
                      await fs.unlink(writtenPath)
                      console.log(`Rolled back file creation: ${writtenPath}`)
                    } catch (error) {
                      console.error(`Failed to rollback file creation: ${writtenPath}`, error)
                    }
                  },
                  { retryable: true, maxRetries: 2 }
                ),
                createTransactionStep(
                  'sync-project',
                  async () => {
                    const { created } = await syncProject(project)
                    return { created, filePath, fullPath }
                  },
                  undefined, // No rollback for sync
                  { retryable: true, maxRetries: 3 }
                )
              ])

              if (!transaction.success) {
                const firstError = Array.from(transaction.errors.values())[0]
                throw firstError instanceof MCPError
                  ? firstError
                  : MCPError.fromError(firstError, {
                      tool: 'project_manager',
                      action: ProjectManagerAction.CREATE_FILE,
                      parameter: 'path',
                      value: filePath
                    })
              }

              const syncResult = transaction.results.get('sync-project') as any
              return {
                content: [
                  {
                    type: 'text',
                    text: `File created successfully: ${filePath}\nFull path: ${fullPath}\nSynced ${syncResult?.created || 0} new files to project.`
                  }
                ]
              }
            }

            case ProjectManagerAction.GET_FILE_CONTENT_PARTIAL: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const filePath = validateDataField<string>(data, 'path', 'string', '"src/index.ts"')
              const startLine = validateDataField<number>(data, 'startLine', 'number', '1')
              const endLine = validateDataField<number>(data, 'endLine', 'number', '50')

              if (startLine < 1) {
                throw createMCPError(MCPErrorCode.INVALID_PARAM_VALUE, 'startLine must be >= 1', {
                  startLine,
                  hint: 'Line numbers start at 1'
                })
              }

              if (endLine < startLine) {
                throw createMCPError(MCPErrorCode.INVALID_PARAM_VALUE, 'endLine must be >= startLine', {
                  startLine,
                  endLine
                })
              }

              const project = await getProjectById(validProjectId)
              const files = await getProjectFiles(validProjectId)
              if (!files) {
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                  projectId: validProjectId
                })
              }

              const file = files.find((f) => f.path === filePath)
              if (!file) {
                const availablePaths = files.slice(0, 5).map((f) => f.path)
                throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
                  requestedPath: filePath,
                  availableFiles: availablePaths,
                  totalFiles: files.length,
                  hint: 'Use browse_files action to explore available files'
                })
              }

              if (!file.content) {
                return {
                  content: [{ type: 'text', text: `File ${filePath} has no content.` }]
                }
              }

              const lines = file.content.split('\n')
              const totalLines = lines.length

              // Adjust endLine if it exceeds total lines
              const actualEndLine = Math.min(endLine, totalLines)

              // Extract the requested lines (convert to 0-based index)
              const requestedLines = lines.slice(startLine - 1, actualEndLine)

              let resultText = `File: ${filePath}\n`
              resultText += `Lines ${startLine}-${actualEndLine} of ${totalLines}:\n`
              resultText += '```\n'

              // Add line numbers
              requestedLines.forEach((line, index) => {
                const lineNumber = startLine + index
                resultText += `${lineNumber.toString().padStart(4, ' ')}│ ${line}\n`
              })

              resultText += '```'

              if (actualEndLine < endLine) {
                resultText += `\nNote: File only has ${totalLines} lines (requested up to line ${endLine})`
              }

              return {
                content: [{ type: 'text', text: resultText }]
              }
            }

            case ProjectManagerAction.DELETE_FILE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const filePath = validateDataField<string>(data, 'path', 'string', '"src/file-to-delete.ts"')

              const project = await getProjectById(validProjectId)
              const files = await getProjectFiles(validProjectId)
              if (!files) {
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to retrieve project files', {
                  projectId: validProjectId
                })
              }

              const file = files.find((f) => f.path === filePath)
              if (!file) {
                const availablePaths = files.slice(0, 5).map((f) => f.path)
                throw createMCPError(MCPErrorCode.FILE_NOT_FOUND, `File not found: ${filePath}`, {
                  requestedPath: filePath,
                  availableFiles: availablePaths,
                  totalFiles: files.length,
                  hint: 'Use browse_files action to explore available files'
                })
              }

              // Delete the file from the project database
              const { deletedCount } = await bulkDeleteProjectFiles(validProjectId, [file.id])

              if (deletedCount === 0) {
                throw createMCPError(MCPErrorCode.SERVICE_ERROR, 'Failed to delete file', {
                  filePath,
                  fileId: file.id
                })
              }

              // Clean up file references in tickets
              const { removeDeletedFileIdsFromTickets } = await import('@octoprompt/services')
              await removeDeletedFileIdsFromTickets(validProjectId, [file.id])

              // Clean up file references in selected files
              const { removeDeletedFileIdsFromSelectedFiles } = await import('@octoprompt/services')
              await removeDeletedFileIdsFromSelectedFiles(validProjectId, [file.id])

              // Delete the file from disk
              const fullPath = path.join(project.path, filePath)
              try {
                await fs.unlink(fullPath)
              } catch (error) {
                // Log but don't fail if file doesn't exist on disk
                console.warn(`File not found on disk during deletion: ${fullPath}`)
              }

              return {
                content: [
                  { type: 'text', text: `File ${filePath} deleted successfully from project ${validProjectId}` }
                ]
              }
            }

            case ProjectManagerAction.GET_FILE_TREE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const { getProjectFileTree } = await import('@octoprompt/services')
              const fileTree = await getProjectFileTree(validProjectId)
              return {
                content: [{ type: 'text', text: fileTree }]
              }
            }

            case ProjectManagerAction.OVERVIEW: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const { getProjectOverview } = await import('@octoprompt/services')
              const overview = await getProjectOverview(validProjectId)
              return {
                content: [{ type: 'text', text: overview }]
              }
            }

            default:
              throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
                action,
                validActions: Object.values(ProjectManagerAction)
              })
          }
        } catch (error) {
          // Convert to MCPError if not already
          const mcpError =
            error instanceof MCPError
              ? error
              : MCPError.fromError(error, {
                  tool: 'project_manager',
                  action: args.action
                })

          // Return formatted error response with recovery suggestions
          return formatMCPErrorResponse(mcpError)
        }
      }
    )
  },

  {
    name: 'prompt_manager',
    description:
      'Manage prompts and prompt-project associations. Actions: list, get, create, update, delete, list_by_project, add_to_project, remove_from_project, suggest_prompts',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(PromptManagerAction)
        },
        projectId: {
          type: 'number',
          description:
            'The project ID (required for: list_by_project, add_to_project, remove_from_project, suggest_prompts). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For get/update/delete: { promptId: 123 }. For create: { name: "My Prompt", content: "Prompt text" }. For add_to_project: { promptId: 123 }. For suggest_prompts: { userInput: "help me with authentication", limit: 5 (optional) }'
        }
      },
      required: ['action']
    },
    handler: createTrackedHandler(
      'prompt_manager',
      async (args: z.infer<typeof PromptManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args

          switch (action) {
            case PromptManagerAction.LIST: {
              const prompts = await listAllPrompts()
              const promptList = prompts
                .map((p) => `${p.id}: ${p.name} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`)
                .join('\n')
              return {
                content: [{ type: 'text', text: promptList || 'No prompts found' }]
              }
            }

            case PromptManagerAction.GET: {
              const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
              const prompt = await getPromptById(promptId)
              const details = `Name: ${prompt.name}\nProject ID: ${prompt.projectId || 'None'}\nContent:\n${prompt.content}\n\nCreated: ${new Date(prompt.created).toLocaleString()}\nUpdated: ${new Date(prompt.updated).toLocaleString()}`
              return {
                content: [{ type: 'text', text: details }]
              }
            }

            case PromptManagerAction.CREATE: {
              const createData = data as CreatePromptBody
              const name = validateDataField<string>(createData, 'name', 'string', '"Code Review Prompt"')
              const content = validateDataField<string>(
                createData,
                'content',
                'string',
                '"Review this code for best practices..."'
              )
              const prompt = await createPrompt(createData)

              // Auto-associate with project if projectId is provided
              if (projectId) {
                try {
                  await addPromptToProject(prompt.id, projectId)
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Prompt created and associated with project ${projectId}: ${prompt.name} (ID: ${prompt.id})`
                      }
                    ]
                  }
                } catch (error) {
                  // If association fails, still return success for prompt creation
                  console.warn(`Created prompt but failed to associate with project ${projectId}:`, error)
                  return {
                    content: [
                      {
                        type: 'text',
                        text: `Prompt created successfully: ${prompt.name} (ID: ${prompt.id})\nNote: Failed to associate with project ${projectId}`
                      }
                    ]
                  }
                }
              }

              return {
                content: [{ type: 'text', text: `Prompt created successfully: ${prompt.name} (ID: ${prompt.id})` }]
              }
            }

            case PromptManagerAction.UPDATE: {
              const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
              const updateData: UpdatePromptBody = {}
              if (data.name !== undefined) updateData.name = data.name
              if (data.content !== undefined) updateData.content = data.content
              const prompt = await updatePrompt(promptId, updateData)
              return {
                content: [{ type: 'text', text: `Prompt updated successfully: ${prompt.name} (ID: ${promptId})` }]
              }
            }

            case PromptManagerAction.DELETE: {
              const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
              const success = await deletePrompt(promptId)
              return {
                content: [
                  {
                    type: 'text',
                    text: success ? `Prompt ${promptId} deleted successfully` : `Failed to delete prompt ${promptId}`
                  }
                ]
              }
            }

            case PromptManagerAction.LIST_BY_PROJECT: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const prompts = await listPromptsByProject(validProjectId)
              const promptList = prompts
                .map((p) => `${p.id}: ${p.name} - ${p.content.substring(0, 100)}${p.content.length > 100 ? '...' : ''}`)
                .join('\n')
              return {
                content: [{ type: 'text', text: promptList || `No prompts found for project ${validProjectId}` }]
              }
            }

            case PromptManagerAction.ADD_TO_PROJECT: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
              await addPromptToProject(promptId, validProjectId)
              return {
                content: [
                  { type: 'text', text: `Prompt ${promptId} successfully associated with project ${validProjectId}` }
                ]
              }
            }

            case PromptManagerAction.REMOVE_FROM_PROJECT: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const promptId = validateDataField<number>(data, 'promptId', 'number', '123')
              await removePromptFromProject(promptId, validProjectId)
              return {
                content: [
                  { type: 'text', text: `Prompt ${promptId} successfully removed from project ${validProjectId}` }
                ]
              }
            }

            case PromptManagerAction.SUGGEST_PROMPTS: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')

              // Enhanced validation for userInput
              if (!data || !data.userInput) {
                throw new Error(
                  'userInput is required in data field. Example: { "userInput": "help me with authentication" }'
                )
              }

              const userInput = validateDataField<string>(data, 'userInput', 'string', '"help me with authentication"')

              // Additional check for empty/whitespace input
              if (!userInput || userInput.trim().length === 0) {
                throw new Error('userInput cannot be empty. Please provide a meaningful query.')
              }

              const limit = (data?.limit as number) || 5

              // First try to get project-specific prompts
              const suggestedPrompts = await suggestPrompts(validProjectId, userInput, limit)

              // If no project-specific prompts found, check if there are any prompts at all
              if (suggestedPrompts.length === 0) {
                const projectPrompts = await listPromptsByProject(validProjectId)
                const allPrompts = await listAllPrompts()

                if (projectPrompts.length === 0 && allPrompts.length > 0) {
                  // No prompts associated with this project, but prompts exist
                  return {
                    content: [
                      {
                        type: 'text',
                        text:
                          `No prompts are currently associated with project ${validProjectId}.\n\n` +
                          `There are ${allPrompts.length} prompts available in the system.\n` +
                          `To use them with this project, first add them using the 'add_to_project' action.\n\n` +
                          `Example: { "action": "add_to_project", "projectId": ${validProjectId}, "data": { "promptId": <id> } }`
                      }
                    ]
                  }
                } else if (allPrompts.length === 0) {
                  // No prompts exist at all
                  return {
                    content: [
                      {
                        type: 'text',
                        text:
                          'No prompts exist in the system yet.\n\n' +
                          'Create prompts using the "create" action:\n' +
                          `Example: { "action": "create", "data": { "name": "My Prompt", "content": "Prompt content here" } }`
                      }
                    ]
                  }
                }
              }

              const promptList = suggestedPrompts
                .map(
                  (p) => `${p.id}: ${p.name}\n   ${p.content.substring(0, 150)}${p.content.length > 150 ? '...' : ''}`
                )
                .join('\n\n')

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      suggestedPrompts.length > 0
                        ? `Suggested prompts for "${userInput}":\n\n${promptList}`
                        : `No prompts found matching your input "${userInput}" in project ${validProjectId}`
                  }
                ]
              }
            }

            default:
              throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
                action,
                validActions: Object.values(PromptManagerAction)
              })
          }
        } catch (error) {
          // Convert to MCPError if not already
          const mcpError =
            error instanceof MCPError
              ? error
              : MCPError.fromError(error, {
                  tool: 'prompt_manager',
                  action: args.action
                })

          // Return formatted error response with recovery suggestions
          return formatMCPErrorResponse(mcpError)
        }
      }
    )
  },

  {
    name: 'ticket_manager',
    description:
      'Manage tickets and ticket-related operations. Actions: list, get, create, update, delete, list_with_task_count, suggest_tasks, auto_generate_tasks, suggest_files, search, batch_create, batch_update, batch_delete',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(TicketManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for: list, create, list_with_task_count). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For get/update/delete: { ticketId: 456 }. For create: { title: "Fix bug", overview: "Description", priority: "high", status: "open" }. For search: { query: "login", status: "open", priority: ["high", "normal"], limit: 10 }. For batch_create: { tickets: [{title: "Task 1"}, {title: "Task 2"}] }. For batch_update: { updates: [{ticketId: 456, data: {status: "closed"}}] }. For batch_delete: { ticketIds: [456, 789] }'
        }
      },
      required: ['action']
    },
    handler: createTrackedHandler(
      'ticket_manager',
      async (args: z.infer<typeof TicketManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args

          switch (action) {
            case TicketManagerAction.LIST: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const status = data?.status as string | undefined
              const tickets = await listTicketsByProject(validProjectId, status)
              const ticketList = tickets
                .map(
                  (t) =>
                    `${t.id}: ${t.title} [${t.status}/${t.priority}] - ${t.overview.substring(0, 50)}${t.overview.length > 50 ? '...' : ''}`
                )
                .join('\n')
              return {
                content: [{ type: 'text', text: ticketList || 'No tickets found' }]
              }
            }

            case TicketManagerAction.GET: {
              const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
              const ticket = await getTicketById(ticketId)
              const details = `Ticket: ${ticket.title}
Project ID: ${ticket.projectId}
Status: ${ticket.status}
Priority: ${ticket.priority}
Overview: ${ticket.overview}
Suggested Files: ${ticket.suggestedFileIds.join(', ') || 'None'}
Created: ${new Date(ticket.created).toLocaleString()}
Updated: ${new Date(ticket.updated).toLocaleString()}`
              return {
                content: [{ type: 'text', text: details }]
              }
            }

            case TicketManagerAction.CREATE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')

              // Validate required fields FIRST
              const title = validateDataField<string>(data, 'title', 'string', '"Fix login bug"')

              // Then create the data object with validated values
              const createData: CreateTicketBody = {
                projectId: validProjectId,
                title: title, // Now guaranteed to be non-empty
                overview: data.overview || '',
                status: data.status || 'open',
                priority: data.priority || 'normal',
                suggestedFileIds: data.suggestedFileIds
              }

              const ticket = await createTicket(createData)
              return {
                content: [{ type: 'text', text: `Ticket created successfully: ${ticket.title} (ID: ${ticket.id})` }]
              }
            }

            case TicketManagerAction.UPDATE: {
              const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
              const updateData: UpdateTicketBody = {}
              if (data.title !== undefined) updateData.title = data.title
              if (data.overview !== undefined) updateData.overview = data.overview
              if (data.status !== undefined) updateData.status = data.status
              if (data.priority !== undefined) updateData.priority = data.priority
              if (data.suggestedFileIds !== undefined) updateData.suggestedFileIds = data.suggestedFileIds
              const ticket = await updateTicket(ticketId, updateData)
              return {
                content: [{ type: 'text', text: `Ticket updated successfully: ${ticket.title} (ID: ${ticketId})` }]
              }
            }

            case TicketManagerAction.DELETE: {
              const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
              await deleteTicket(ticketId)
              return {
                content: [{ type: 'text', text: `Ticket ${ticketId} deleted successfully` }]
              }
            }

            case TicketManagerAction.LIST_WITH_TASK_COUNT: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const status = data?.status as string | undefined
              const tickets = await listTicketsWithTaskCount(validProjectId, status)
              const ticketList = tickets
                .map(
                  (t) =>
                    `${t.id}: ${t.title} [${t.status}/${t.priority}] - Tasks: ${t.completedTaskCount}/${t.taskCount}`
                )
                .join('\n')
              return {
                content: [{ type: 'text', text: ticketList || 'No tickets found' }]
              }
            }

            case TicketManagerAction.SUGGEST_TASKS: {
              const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
              const userContext = data?.userContext as string | undefined
              const suggestions = await suggestTasksForTicket(ticketId, userContext)
              const suggestionList = suggestions.map((task, idx) => `${idx + 1}. ${task}`).join('\n')
              return {
                content: [{ type: 'text', text: suggestionList || 'No task suggestions generated' }]
              }
            }

            case TicketManagerAction.AUTO_GENERATE_TASKS: {
              const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
              
              try {
                const tasks = await autoGenerateTasksFromOverview(ticketId)
                const taskList = tasks.map((t) => `${t.id}: ${t.content}`).join('\n')
                return {
                  content: [{ type: 'text', text: `Generated ${tasks.length} tasks:\n${taskList}` }]
                }
              } catch (error) {
                if (error instanceof ApiError) {
                  if (error.status === 404) {
                    throw createMCPError(
                      MCPErrorCode.RESOURCE_NOT_FOUND,
                      error.message || `Ticket ${ticketId} not found or project has no files`,
                      {
                        ticketId,
                        suggestion: 'Ensure the ticket exists and the associated project has files'
                      }
                    )
                  }
                  throw createMCPError(
                    MCPErrorCode.SERVICE_ERROR,
                    error.message || 'Failed to generate tasks',
                    {
                      ticketId,
                      code: error.code,
                      originalError: error
                    }
                  )
                }
                throw createMCPError(
                  MCPErrorCode.SERVICE_ERROR,
                  'Failed to auto-generate tasks for ticket',
                  {
                    ticketId,
                    originalError: error
                  }
                )
              }
            }

            case TicketManagerAction.SUGGEST_FILES: {
              const ticketId = validateDataField<number>(data, 'ticketId', 'number', '456')
              const extraUserInput = data?.extraUserInput as string | undefined
              
              try {
                const result = await suggestFilesForTicket(ticketId, { extraUserInput })
                return {
                  content: [
                    {
                      type: 'text',
                      text: `Suggested files: ${result.recommendedFileIds.join(', ') || 'None'}\n${result.message || ''}`
                    }
                  ]
                }
              } catch (error) {
                if (error instanceof ApiError) {
                  if (error.status === 404) {
                    throw createMCPError(
                      MCPErrorCode.RESOURCE_NOT_FOUND,
                      error.message || `Ticket ${ticketId} not found or project has no files`,
                      {
                        ticketId,
                        suggestion: 'Ensure the ticket exists and the associated project has files'
                      }
                    )
                  }
                  throw createMCPError(
                    MCPErrorCode.SERVICE_ERROR,
                    error.message || 'Failed to suggest files',
                    {
                      ticketId,
                      code: error.code,
                      originalError: error
                    }
                  )
                }
                throw createMCPError(
                  MCPErrorCode.SERVICE_ERROR,
                  'Failed to suggest files for ticket',
                  {
                    ticketId,
                    originalError: error
                  }
                )
              }
            }

            case TicketManagerAction.SEARCH: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const searchOptions = data || {}

              try {
                const result = await searchTickets(validProjectId, searchOptions)

                if (result.tickets.length === 0) {
                  throw createMCPError(
                    MCPErrorCode.NO_SEARCH_RESULTS,
                    'No tickets found matching your search criteria',
                    {
                      searchOptions
                    }
                  )
                }

                const ticketList = result.tickets
                  .map((t) => `${t.id}: [${t.status}/${t.priority}] ${t.title}`)
                  .join('\n')

                return {
                  content: [
                    {
                      type: 'text',
                      text: `Found ${result.total} tickets (showing ${result.tickets.length}):\n${ticketList}`
                    }
                  ]
                }
              } catch (error) {
                if (error instanceof MCPError) throw error
                throw createMCPError(MCPErrorCode.SEARCH_FAILED, 'Search operation failed', {
                  searchOptions,
                  originalError: error
                })
              }
            }

            case TicketManagerAction.BATCH_CREATE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const tickets = validateDataField<any[]>(
                data,
                'tickets',
                'array',
                '[{title: "Task 1"}, {title: "Task 2"}]'
              )

              if (tickets.length > 100) {
                throw createMCPError(
                  MCPErrorCode.BATCH_SIZE_EXCEEDED,
                  `Batch size ${tickets.length} exceeds maximum of 100`
                )
              }

              const result = await batchCreateTickets(validProjectId, tickets)

              if (result.failureCount > 0 && result.successCount === 0) {
                throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                  failures: result.failed
                })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Batch create completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                      (result.failed.length > 0
                        ? `Failures:\n${result.failed.map((f) => `- ${JSON.stringify(f.item)}: ${f.error}`).join('\n')}`
                        : '')
                  }
                ]
              }
            }

            case TicketManagerAction.BATCH_UPDATE: {
              const updates = validateDataField<any[]>(
                data,
                'updates',
                'array',
                '[{ticketId: 456, data: {status: "closed"}}]'
              )

              if (updates.length > 100) {
                throw createMCPError(
                  MCPErrorCode.BATCH_SIZE_EXCEEDED,
                  `Batch size ${updates.length} exceeds maximum of 100`
                )
              }

              const result = await batchUpdateTickets(updates)

              if (result.failureCount > 0 && result.successCount === 0) {
                throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                  failures: result.failed
                })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Batch update completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                      (result.failed.length > 0
                        ? `Failures:\n${result.failed.map((f) => `- Ticket ${f.item.ticketId}: ${f.error}`).join('\n')}`
                        : '')
                  }
                ]
              }
            }

            case TicketManagerAction.BATCH_DELETE: {
              const ticketIds = validateDataField<number[]>(data, 'ticketIds', 'array', '[456, 789]')

              if (ticketIds.length > 100) {
                throw createMCPError(
                  MCPErrorCode.BATCH_SIZE_EXCEEDED,
                  `Batch size ${ticketIds.length} exceeds maximum of 100`
                )
              }

              const result = await batchDeleteTickets(ticketIds)

              if (result.failureCount > 0 && result.successCount === 0) {
                throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                  failures: result.failed
                })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Batch delete completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                      (result.failed.length > 0 ? `Failed IDs: ${result.failed.map((f) => f.item).join(', ')}` : '')
                  }
                ]
              }
            }

            default:
              throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
                action,
                validActions: Object.values(TicketManagerAction)
              })
          }
        } catch (error) {
          // Convert to MCPError if not already
          const mcpError =
            error instanceof MCPError
              ? error
              : MCPError.fromError(error, {
                  tool: 'ticket_manager',
                  action: args.action
                })

          // Return formatted error response with recovery suggestions
          return formatMCPErrorResponse(mcpError)
        }
      }
    )
  },

  {
    name: 'task_manager',
    description:
      'Manage tasks within tickets. Actions: list, create, update, delete, reorder, suggest_files, update_context, get_with_context, analyze_complexity, filter, batch_create, batch_update, batch_delete, batch_move',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(TaskManagerAction)
        },
        ticketId: {
          type: 'number',
          description: 'The ticket ID (required for all actions). Example: 456'
        },
        data: {
          type: 'object',
          description:
            'Action-specific data. For create: { content: "Task description", description: "Detailed steps", suggestedFileIds: ["123"], estimatedHours: 4, tags: ["frontend"] }. For update: { taskId: 789, done: true, content: "Updated text", description: "New description" }. For filter: { projectId: 1750564533014, status: "pending", tags: ["backend"], query: "auth" }. For batch_create: { tasks: [{content: "Task 1"}, {content: "Task 2"}] }. For batch_update: { updates: [{ticketId: 456, taskId: 789, data: {done: true}}] }. For batch_delete: { deletes: [{ticketId: 456, taskId: 789}] }. For batch_move: { moves: [{taskId: 789, fromTicketId: 456, toTicketId: 123}] }'
        }
      },
      required: ['action', 'ticketId']
    },
    handler: createTrackedHandler(
      'task_manager',
      async (args: z.infer<typeof TaskManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, ticketId, data } = args
          const validTicketId = validateRequiredParam(ticketId, 'ticketId', 'number', '456')

          switch (action) {
            case TaskManagerAction.LIST: {
              const tasks = await getTasks(validTicketId)
              const taskList = tasks
                .map((t) => `${t.id}: [${t.done ? 'x' : ' '}] ${t.content} (order: ${t.orderIndex})`)
                .join('\n')
              return {
                content: [{ type: 'text', text: taskList || 'No tasks found for this ticket' }]
              }
            }

            case TaskManagerAction.CREATE: {
              const content = validateDataField<string>(data, 'content', 'string', '"Implement login validation"')
              // Support enhanced task creation
              const taskData = {
                content,
                description: data.description,
                suggestedFileIds: data.suggestedFileIds,
                estimatedHours: data.estimatedHours,
                dependencies: data.dependencies,
                tags: data.tags
              }
              const task = await createTask(validTicketId, taskData)
              return {
                content: [{ type: 'text', text: `Task created successfully: ${task.content} (ID: ${task.id})` }]
              }
            }

            case TaskManagerAction.UPDATE: {
              const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
              const updateData: UpdateTaskBody = {}
              if (data.content !== undefined) updateData.content = data.content
              if (data.description !== undefined) updateData.description = data.description
              if (data.suggestedFileIds !== undefined) updateData.suggestedFileIds = data.suggestedFileIds
              if (data.done !== undefined) updateData.done = data.done
              if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours
              if (data.dependencies !== undefined) updateData.dependencies = data.dependencies
              if (data.tags !== undefined) updateData.tags = data.tags
              const task = await updateTask(validTicketId, taskId, updateData)
              return {
                content: [{ type: 'text', text: `Task updated successfully: ${task.content} (ID: ${taskId})` }]
              }
            }

            case TaskManagerAction.DELETE: {
              const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
              await deleteTask(validTicketId, taskId)
              return {
                content: [{ type: 'text', text: `Task ${taskId} deleted successfully` }]
              }
            }

            case TaskManagerAction.REORDER: {
              const tasks = validateDataField<Array<{ taskId: number; orderIndex: number }>>(
                data,
                'tasks',
                'array',
                '[{"taskId": 789, "orderIndex": 0}]'
              )
              const reorderedTasks = await reorderTasks(validTicketId, tasks)
              const taskList = reorderedTasks.map((t) => `${t.id}: ${t.content} (order: ${t.orderIndex})`).join('\n')
              return {
                content: [{ type: 'text', text: `Tasks reordered successfully:\n${taskList}` }]
              }
            }

            case TaskManagerAction.SUGGEST_FILES: {
              const { suggestFilesForTask } = await import('@octoprompt/services')
              const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
              const context = data.context as string | undefined
              const suggestedFiles = await suggestFilesForTask(taskId, context)
              return {
                content: [
                  {
                    type: 'text',
                    text:
                      suggestedFiles.length > 0
                        ? `Suggested files for task: ${suggestedFiles.join(', ')}`
                        : 'No files suggested for this task'
                  }
                ]
              }
            }

            case TaskManagerAction.UPDATE_CONTEXT: {
              const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
              const updateData: UpdateTaskBody = {
                description: data.description,
                suggestedFileIds: data.suggestedFileIds,
                estimatedHours: data.estimatedHours,
                tags: data.tags
              }
              const task = await updateTask(validTicketId, taskId, updateData)
              return {
                content: [
                  {
                    type: 'text',
                    text: `Task context updated: ${task.content} (Est: ${task.estimatedHours || 'N/A'} hours)`
                  }
                ]
              }
            }

            case TaskManagerAction.GET_WITH_CONTEXT: {
              const { getTaskWithContext } = await import('@octoprompt/services')
              const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
              const taskWithContext = await getTaskWithContext(taskId)
              const contextInfo = {
                task: taskWithContext.content,
                description: taskWithContext.description,
                estimatedHours: taskWithContext.estimatedHours,
                tags: taskWithContext.tags,
                fileCount: taskWithContext.suggestedFileIds?.length || 0,
                files: taskWithContext.files
              }
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(contextInfo, null, 2)
                  }
                ]
              }
            }

            case TaskManagerAction.ANALYZE_COMPLEXITY: {
              const { analyzeTaskComplexity } = await import('@octoprompt/services')
              const taskId = validateDataField<number>(data, 'taskId', 'number', '789')
              const analysis = await analyzeTaskComplexity(taskId)
              return {
                content: [
                  {
                    type: 'text',
                    text: `Task Complexity Analysis:
- Complexity: ${analysis.complexity}
- Estimated Hours: ${analysis.estimatedHours}
- Required Skills: ${analysis.requiredSkills.join(', ')}
- Suggested Approach: ${analysis.suggestedApproach}`
                  }
                ]
              }
            }

            case TaskManagerAction.FILTER: {
              const projectId = validateRequiredParam(data?.projectId, 'projectId', 'number', '1750564533014')
              const filterOptions = data || {}

              const result = await filterTasks(projectId, filterOptions)

              if (result.tasks.length === 0) {
                throw createMCPError(MCPErrorCode.NO_SEARCH_RESULTS, 'No tasks found matching your filter criteria', {
                  filterOptions
                })
              }

              const taskList = result.tasks
                .map(
                  (t) =>
                    `${t.id}: [${t.done ? 'x' : ' '}] ${t.content} (${t.ticketTitle}) ${t.estimatedHours ? `- ${t.estimatedHours}h` : ''}`
                )
                .join('\n')

              return {
                content: [
                  {
                    type: 'text',
                    text: `Found ${result.total} tasks (showing ${result.tasks.length}):\n${taskList}`
                  }
                ]
              }
            }

            case TaskManagerAction.BATCH_CREATE: {
              const validTicketId = validateRequiredParam(ticketId, 'ticketId', 'number', '456')
              const tasks = validateDataField<any[]>(
                data,
                'tasks',
                'array',
                '[{content: "Task 1"}, {content: "Task 2"}]'
              )

              if (tasks.length > 100) {
                throw createMCPError(
                  MCPErrorCode.BATCH_SIZE_EXCEEDED,
                  `Batch size ${tasks.length} exceeds maximum of 100`
                )
              }

              const result = await batchCreateTasks(validTicketId, tasks)

              if (result.failureCount > 0 && result.successCount === 0) {
                throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                  failures: result.failed
                })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Batch create completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                      (result.failed.length > 0
                        ? `Failures:\n${result.failed.map((f) => `- ${f.item.content}: ${f.error}`).join('\n')}`
                        : '')
                  }
                ]
              }
            }

            case TaskManagerAction.BATCH_UPDATE: {
              const updates = validateDataField<any[]>(
                data,
                'updates',
                'array',
                '[{ticketId: 456, taskId: 789, data: {done: true}}]'
              )

              if (updates.length > 100) {
                throw createMCPError(
                  MCPErrorCode.BATCH_SIZE_EXCEEDED,
                  `Batch size ${updates.length} exceeds maximum of 100`
                )
              }

              const result = await batchUpdateTasks(updates)

              if (result.failureCount > 0 && result.successCount === 0) {
                throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                  failures: result.failed
                })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Batch update completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                      (result.failed.length > 0
                        ? `Failures:\n${result.failed.map((f) => `- Task ${f.item.taskId}: ${f.error}`).join('\n')}`
                        : '')
                  }
                ]
              }
            }

            case TaskManagerAction.BATCH_DELETE: {
              const deletes = validateDataField<any[]>(data, 'deletes', 'array', '[{ticketId: 456, taskId: 789}]')

              if (deletes.length > 100) {
                throw createMCPError(
                  MCPErrorCode.BATCH_SIZE_EXCEEDED,
                  `Batch size ${deletes.length} exceeds maximum of 100`
                )
              }

              const result = await batchDeleteTasks(deletes)

              if (result.failureCount > 0 && result.successCount === 0) {
                throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                  failures: result.failed
                })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Batch delete completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                      (result.failed.length > 0
                        ? `Failed task IDs: ${result.failed.map((f) => f.item.taskId).join(', ')}`
                        : '')
                  }
                ]
              }
            }

            case TaskManagerAction.BATCH_MOVE: {
              const moves = validateDataField<any[]>(
                data,
                'moves',
                'array',
                '[{taskId: 789, fromTicketId: 456, toTicketId: 123}]'
              )

              if (moves.length > 100) {
                throw createMCPError(
                  MCPErrorCode.BATCH_SIZE_EXCEEDED,
                  `Batch size ${moves.length} exceeds maximum of 100`
                )
              }

              const result = await batchMoveTasks(moves)

              if (result.failureCount > 0 && result.successCount === 0) {
                throw createMCPError(MCPErrorCode.BATCH_OPERATION_FAILED, 'All items in batch operation failed', {
                  failures: result.failed
                })
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Batch move completed: ${result.successCount} succeeded, ${result.failureCount} failed\n` +
                      (result.failed.length > 0
                        ? `Failures:\n${result.failed.map((f) => `- Task ${f.item.taskId}: ${f.error}`).join('\n')}`
                        : '')
                  }
                ]
              }
            }

            default:
              throw new Error(`Unknown action: ${action}`)
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }
            ],
            isError: true
          }
        }
      }
    )
  },

  {
    name: 'ai_assistant',
    description:
      'AI-powered utilities for prompt optimization and project insights. Actions: optimize_prompt, get_compact_summary, get_compact_summary_with_options (supports depth/format/strategy options)',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(AIAssistantAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for all actions). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description: 'Action-specific data. For optimize_prompt: { prompt: "help me fix the authentication" }. For get_compact_summary_with_options: { depth: "minimal" | "standard" | "detailed", format: "xml" | "json" | "markdown", strategy: "fast" | "balanced" | "thorough", includeMetrics: true }'
        }
      },
      required: ['action', 'projectId']
    },
    handler: createTrackedHandler(
      'ai_assistant',
      async (args: z.infer<typeof AIAssistantSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args

          switch (action) {
            case AIAssistantAction.OPTIMIZE_PROMPT: {
              const prompt = validateDataField<string>(
                data,
                'prompt',
                'string',
                '"help me fix the authentication flow"'
              )
              const optimizedPrompt = await optimizeUserInput(projectId, prompt)
              return {
                content: [{ type: 'text', text: optimizedPrompt }]
              }
            }

            case AIAssistantAction.GET_COMPACT_SUMMARY: {
              const summary = await getCompactProjectSummary(projectId)
              return {
                content: [{ type: 'text', text: summary }]
              }
            }
            
            case AIAssistantAction.GET_COMPACT_SUMMARY_WITH_OPTIONS: {
              const { getProjectSummaryWithOptions } = await import('@octoprompt/services')
              const { SummaryOptionsSchema } = await import('@octoprompt/schemas')
              
              // Parse and validate options, setting defaults for compact summary
              const options = SummaryOptionsSchema.parse({
                ...data,
                strategy: data?.strategy || 'balanced' // Default to balanced for AI summaries
              })
              
              const result = await getProjectSummaryWithOptions(projectId, options)
              
              // Format response based on whether metrics were requested
              if (options.includeMetrics && result.metrics) {
                const metricsText = `
Compact Summary Metrics:
- Generation Time: ${result.metrics.generationTime}ms
- Files Processed: ${result.metrics.filesProcessed}
- Compression Ratio: ${(result.metrics.compressionRatio * 100).toFixed(1)}%
- Tokens Saved: ~${result.metrics.tokensSaved}

Summary:
${result.summary}`
                return {
                  content: [{ type: 'text', text: metricsText }]
                }
              }
              
              return {
                content: [{ type: 'text', text: result.summary }]
              }
            }

            default:
              throw new Error(`Unknown action: ${action}`)
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }
            ],
            isError: true
          }
        }
      }
    )
  },

  {
    name: 'git_manager',
    description: 'Comprehensive Git operations including status, commits, branches, tags, stash, worktrees, and more',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The Git action to perform',
          enum: Object.values(GitManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data. For log_enhanced: { branch?: "main", author?: "john", search?: "fix", page?: 1, perPage?: 20, since?: "2024-01-01", until?: "2024-12-31", includeStats?: true, includeFileDetails?: true }. For commit_detail: { hash: "abc123", includeFileContents?: true }. For worktree_add: { path: "../feature-branch", branch?: "existing-branch", newBranch?: "new-branch", commitish?: "HEAD~3", detach?: true }. For worktree_remove: { path: "../feature-branch", force?: true }. For worktree_lock: { path: "../feature-branch", reason?: "work in progress" }. For worktree_unlock: { path: "../feature-branch" }. For worktree_prune: { dryRun?: true }. For other actions, see git service documentation.'
        }
      },
      required: ['action', 'projectId']
    },
    handler: createTrackedHandler(
      'git_manager',
      async (args: z.infer<typeof GitManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args

          switch (action) {
            case GitManagerAction.STATUS: {
              const result = await getProjectGitStatus(projectId)
              if (!result.success) {
                return {
                  content: [{ type: 'text', text: `Git error: ${result.error?.message}` }],
                  isError: true
                }
              }
              const status = result.data
              let text = `Branch: ${status.current || 'none'}\n`
              if (status.tracking) text += `Tracking: ${status.tracking}\n`
              text += `Ahead: ${status.ahead}, Behind: ${status.behind}\n\n`
              text += `Files (${status.files.length}):\n`
              status.files.forEach((file) => {
                text += `  ${file.staged ? '[staged]' : '[unstaged]'} ${file.status}: ${file.path}\n`
              })
              return { content: [{ type: 'text', text }] }
            }

            case GitManagerAction.STAGE_FILES: {
              const filePaths = validateDataField<string[]>(data, 'filePaths', 'array', '["src/index.ts", "README.md"]')
              await stageFiles(projectId, filePaths)
              return { content: [{ type: 'text', text: `Staged ${filePaths.length} files` }] }
            }

            case GitManagerAction.UNSTAGE_FILES: {
              const filePaths = validateDataField<string[]>(data, 'filePaths', 'array', '["src/index.ts", "README.md"]')
              await unstageFiles(projectId, filePaths)
              return { content: [{ type: 'text', text: `Unstaged ${filePaths.length} files` }] }
            }

            case GitManagerAction.STAGE_ALL: {
              await stageAll(projectId)
              return { content: [{ type: 'text', text: 'Staged all changes' }] }
            }

            case GitManagerAction.UNSTAGE_ALL: {
              await unstageAll(projectId)
              return { content: [{ type: 'text', text: 'Unstaged all changes' }] }
            }

            case GitManagerAction.COMMIT: {
              const message = validateDataField<string>(data, 'message', 'string', '"Fix: resolve authentication bug"')
              await commitChanges(projectId, message)
              return { content: [{ type: 'text', text: `Committed changes: ${message}` }] }
            }

            case GitManagerAction.BRANCHES: {
              const branches = await getBranches(projectId)
              const text = branches
                .map((b) => {
                  const marker = b.current ? '* ' : '  '
                  const info = b.isRemote ? '[remote]' : `[local${b.tracking ? `, tracking ${b.tracking}` : ''}]`
                  return `${marker}${b.name} ${info} (${b.commit.substring(0, 7)})`
                })
                .join('\n')
              return { content: [{ type: 'text', text: text || 'No branches found' }] }
            }

            case GitManagerAction.CURRENT_BRANCH: {
              const branch = await getCurrentBranch(projectId)
              return { content: [{ type: 'text', text: branch || 'No current branch' }] }
            }

            case GitManagerAction.CREATE_BRANCH: {
              const name = validateDataField<string>(data, 'name', 'string', '"feature/new-auth"')
              const startPoint = data?.startPoint as string | undefined
              await createBranch(projectId, name, startPoint)
              return { content: [{ type: 'text', text: `Created branch: ${name}` }] }
            }

            case GitManagerAction.SWITCH_BRANCH: {
              const name = validateDataField<string>(data, 'name', 'string', '"main"')
              await switchBranch(projectId, name)
              return { content: [{ type: 'text', text: `Switched to branch: ${name}` }] }
            }

            case GitManagerAction.DELETE_BRANCH: {
              const name = validateDataField<string>(data, 'name', 'string', '"feature/old-feature"')
              const force = data?.force as boolean | undefined
              await deleteBranch(projectId, name, force)
              return { content: [{ type: 'text', text: `Deleted branch: ${name}` }] }
            }

            case GitManagerAction.MERGE_BRANCH: {
              const branch = validateDataField<string>(data, 'branch', 'string', '"feature/new-feature"')
              const options = data?.options as { noFastForward?: boolean; message?: string } | undefined
              await mergeBranch(projectId, branch, options)
              return { content: [{ type: 'text', text: `Merged branch: ${branch}` }] }
            }

            case GitManagerAction.LOG: {
              const options = data?.options as
                | { limit?: number; skip?: number; branch?: string; file?: string }
                | undefined
              const logs = await getCommitLog(projectId, options)
              const text = logs
                .map((log) => {
                  const date = new Date(log.date).toLocaleDateString()
                  return `${log.abbreviatedHash} - ${log.message} (${log.author.name}, ${date})`
                })
                .join('\n')
              return { content: [{ type: 'text', text: text || 'No commits found' }] }
            }

            case GitManagerAction.COMMIT_DETAILS: {
              const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
              const commit = await getCommitDetails(projectId, hash)
              const text =
                `Commit: ${commit.hash}\n` +
                `Author: ${commit.author.name} <${commit.author.email}>\n` +
                `Date: ${commit.author.date}\n` +
                `Message: ${commit.message}\n` +
                `Files: ${commit.files?.join(', ') || 'none'}`
              return { content: [{ type: 'text', text }] }
            }

            case GitManagerAction.FILE_DIFF: {
              const filePath = validateDataField<string>(data, 'filePath', 'string', '"src/index.ts"')
              const options = data?.options as { commit?: string; staged?: boolean } | undefined
              const diff = await getFileDiff(projectId, filePath, options)
              return { content: [{ type: 'text', text: diff || 'No differences' }] }
            }

            case GitManagerAction.COMMIT_DIFF: {
              const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
              const diff = await getCommitDiff(projectId, hash)
              const text =
                `Files changed: ${diff.files.length}\n` +
                `Additions: +${diff.additions}, Deletions: -${diff.deletions}\n\n` +
                diff.content
              return { content: [{ type: 'text', text }] }
            }

            case GitManagerAction.CHERRY_PICK: {
              const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
              await cherryPick(projectId, hash)
              return { content: [{ type: 'text', text: `Cherry-picked commit: ${hash}` }] }
            }

            case GitManagerAction.REMOTES: {
              const remotes = await getRemotes(projectId)
              const text = remotes.map((r) => `${r.name}: ${r.fetch} (fetch), ${r.push} (push)`).join('\n')
              return { content: [{ type: 'text', text: text || 'No remotes configured' }] }
            }

            case GitManagerAction.ADD_REMOTE: {
              const name = validateDataField<string>(data, 'name', 'string', '"origin"')
              const url = validateDataField<string>(data, 'url', 'string', '"https://github.com/user/repo.git"')
              await addRemote(projectId, name, url)
              return { content: [{ type: 'text', text: `Added remote: ${name} -> ${url}` }] }
            }

            case GitManagerAction.REMOVE_REMOTE: {
              const name = validateDataField<string>(data, 'name', 'string', '"origin"')
              await removeRemote(projectId, name)
              return { content: [{ type: 'text', text: `Removed remote: ${name}` }] }
            }

            case GitManagerAction.FETCH: {
              const remote = data?.remote as string | undefined
              const options = data?.options as { prune?: boolean } | undefined
              await fetch(projectId, remote || 'origin', options)
              return { content: [{ type: 'text', text: `Fetched from ${remote || 'origin'}` }] }
            }

            case GitManagerAction.PULL: {
              const remote = data?.remote as string | undefined
              const branch = data?.branch as string | undefined
              const options = data?.options as { rebase?: boolean } | undefined
              await pull(projectId, remote || 'origin', branch, options)
              return {
                content: [{ type: 'text', text: `Pulled from ${remote || 'origin'}${branch ? `/${branch}` : ''}` }]
              }
            }

            case GitManagerAction.PUSH: {
              const remote = data?.remote as string | undefined
              const branch = data?.branch as string | undefined
              const options = data?.options as { force?: boolean; setUpstream?: boolean } | undefined
              await push(projectId, remote || 'origin', branch, options)
              return {
                content: [{ type: 'text', text: `Pushed to ${remote || 'origin'}${branch ? `/${branch}` : ''}` }]
              }
            }

            case GitManagerAction.TAGS: {
              const tags = await getTags(projectId)
              const text = tags
                .map((t) => {
                  let line = `${t.name} -> ${t.commit.substring(0, 7)}`
                  if (t.annotation) line += ` "${t.annotation}"`
                  return line
                })
                .join('\n')
              return { content: [{ type: 'text', text: text || 'No tags found' }] }
            }

            case GitManagerAction.CREATE_TAG: {
              const name = validateDataField<string>(data, 'name', 'string', '"v1.0.0"')
              const options = data?.options as { message?: string; ref?: string } | undefined
              await createTag(projectId, name, options)
              return { content: [{ type: 'text', text: `Created tag: ${name}` }] }
            }

            case GitManagerAction.DELETE_TAG: {
              const name = validateDataField<string>(data, 'name', 'string', '"v1.0.0"')
              await deleteTag(projectId, name)
              return { content: [{ type: 'text', text: `Deleted tag: ${name}` }] }
            }

            case GitManagerAction.STASH: {
              const message = data?.message as string | undefined
              await stash(projectId, message)
              return { content: [{ type: 'text', text: `Stashed changes${message ? `: ${message}` : ''}` }] }
            }

            case GitManagerAction.STASH_LIST: {
              const stashes = await stashList(projectId)
              const text = stashes.map((s) => `stash@{${s.index}}: ${s.message} (on ${s.branch})`).join('\n')
              return { content: [{ type: 'text', text: text || 'No stashes found' }] }
            }

            case GitManagerAction.STASH_APPLY: {
              const ref = data?.ref as string | undefined
              await stashApply(projectId, ref || 'stash@{0}')
              return { content: [{ type: 'text', text: `Applied stash: ${ref || 'stash@{0}'}` }] }
            }

            case GitManagerAction.STASH_POP: {
              const ref = data?.ref as string | undefined
              await stashPop(projectId, ref || 'stash@{0}')
              return { content: [{ type: 'text', text: `Popped stash: ${ref || 'stash@{0}'}` }] }
            }

            case GitManagerAction.STASH_DROP: {
              const ref = data?.ref as string | undefined
              await stashDrop(projectId, ref || 'stash@{0}')
              return { content: [{ type: 'text', text: `Dropped stash: ${ref || 'stash@{0}'}` }] }
            }

            case GitManagerAction.RESET: {
              const ref = validateDataField<string>(data, 'ref', 'string', '"HEAD~1"')
              const mode = data?.mode as 'soft' | 'mixed' | 'hard' | undefined
              await reset(projectId, ref, mode || 'mixed')
              return { content: [{ type: 'text', text: `Reset to ${ref} (${mode || 'mixed'} mode)` }] }
            }

            case GitManagerAction.REVERT: {
              const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
              const options = data?.options as { noCommit?: boolean } | undefined
              await revert(projectId, hash, options)
              return { content: [{ type: 'text', text: `Reverted commit: ${hash}` }] }
            }

            case GitManagerAction.BLAME: {
              const filePath = validateDataField<string>(data, 'filePath', 'string', '"src/index.ts"')
              const blameResult = await blame(projectId, filePath)
              const text =
                `Blame for ${blameResult.path}:\n` +
                blameResult.lines
                  .slice(0, 20)
                  .map((line: any) => `${line.line}: ${line.commit.substring(0, 7)} ${line.author} - ${line.content}`)
                  .join('\n') +
                (blameResult.lines.length > 20 ? `\n... and ${blameResult.lines.length - 20} more lines` : '')
              return { content: [{ type: 'text', text }] }
            }

            case GitManagerAction.CLEAN: {
              const options = data?.options as { directories?: boolean; force?: boolean; dryRun?: boolean } | undefined
              const cleaned = await clean(projectId, options)
              const text = options?.dryRun ? `Would remove:\n${cleaned.join('\n')}` : `Removed:\n${cleaned.join('\n')}`
              return { content: [{ type: 'text', text: text || 'Nothing to clean' }] }
            }

            case GitManagerAction.CONFIG_GET: {
              const key = data?.key as string | undefined
              const options = data?.options as { global?: boolean } | undefined
              const config = await getConfig(projectId, key, options)
              const text =
                typeof config === 'string'
                  ? `${key}: ${config}`
                  : Object.entries(config)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join('\n')
              return { content: [{ type: 'text', text }] }
            }

            case GitManagerAction.CONFIG_SET: {
              const key = validateDataField<string>(data, 'key', 'string', '"user.name"')
              const value = validateDataField<string>(data, 'value', 'string', '"John Doe"')
              const options = data?.options as { global?: boolean } | undefined
              await setConfig(projectId, key, value, options)
              return { content: [{ type: 'text', text: `Set config: ${key} = ${value}` }] }
            }
            case GitManagerAction.LOG_ENHANCED: {
              const request = {
                branch: data?.branch as string | undefined,
                author: data?.author as string | undefined,
                search: data?.search as string | undefined,
                page: data?.page as number | undefined || 1,
                perPage: data?.perPage as number | undefined || 20,
                since: data?.since as string | undefined,
                until: data?.until as string | undefined,
                includeStats: data?.includeStats as boolean | undefined || false,
                includeFileDetails: data?.includeFileDetails as boolean | undefined || false
              }
              const result = await getCommitLogEnhanced(projectId, request)
              if (!result.success || !result.data) {
                return {
                  content: [{ type: 'text', text: result.message || 'Failed to get enhanced commit log' }],
                  isError: true
                }
              }
              const { commits, pagination, branch } = result.data
              let text = `Branch: ${branch}\n`
              text += `Page ${pagination.page} (${pagination.perPage} per page)${pagination.hasMore ? ' - More available' : ''}\n\n`
              text += commits
                .map((commit) => {
                  let commitText = `${commit.abbreviatedHash} - ${commit.subject}\n`
                  commitText += `  Author: ${commit.author.name} <${commit.author.email}>\n`
                  commitText += `  Date: ${commit.author.relativeTime} (${new Date(commit.author.date).toLocaleString()})\n`
                  if (commit.body) {
                    commitText += `  Body: ${commit.body.split('\n').join('\n  ')}\n`
                  }
                  if (commit.stats) {
                    commitText += `  Stats: +${commit.stats.additions} -${commit.stats.deletions} (${commit.stats.filesChanged} files)\n`
                  }
                  if (commit.fileStats && commit.fileStats.length > 0) {
                    commitText += '  Files:\n'
                    commit.fileStats.forEach((file) => {
                      commitText += `    ${file.status}: ${file.path} (+${file.additions} -${file.deletions})\n`
                    })
                  }
                  return commitText
                })
                .join('\n')
              return { content: [{ type: 'text', text }] }
            }
            case GitManagerAction.BRANCHES_ENHANCED: {
              const result = await getBranchesEnhanced(projectId)
              if (!result.success || !result.data) {
                return {
                  content: [{ type: 'text', text: result.message || 'Failed to get enhanced branches' }],
                  isError: true
                }
              }
              const { branches, currentBranch, totalCount } = result.data
              let text = `Current branch: ${currentBranch || 'none'}\n`
              text += `Total branches: ${totalCount}\n\n`
              text += branches
                .map((branch) => {
                  const marker = branch.current ? '* ' : '  '
                  let branchText = `${marker}${branch.name}`
                  if (branch.isRemote) branchText += ' [remote]'
                  if (branch.isProtected) branchText += ' [protected]'
                  branchText += '\n'
                  branchText += `    Latest: ${branch.latestCommit.abbreviatedHash} - ${branch.latestCommit.subject}\n`
                  branchText += `    Author: ${branch.latestCommit.author} (${branch.latestCommit.relativeTime})\n`
                  if (branch.tracking) {
                    branchText += `    Tracking: ${branch.tracking.remoteName}/${branch.tracking.remoteBranch}\n`
                    if (branch.tracking.ahead > 0 || branch.tracking.behind > 0) {
                      branchText += `    Status: ${branch.tracking.ahead} ahead, ${branch.tracking.behind} behind\n`
                    }
                  }
                  return branchText
                })
                .join('\n')
              return { content: [{ type: 'text', text }] }
            }
            case GitManagerAction.COMMIT_DETAIL: {
              const hash = validateDataField<string>(data, 'hash', 'string', '"abc123"')
              const includeFileContents = data?.includeFileContents as boolean | undefined || false
              const result = await getCommitDetail(projectId, hash, includeFileContents)
              if (!result.success || !result.data) {
                return {
                  content: [{ type: 'text', text: result.message || 'Failed to get commit details' }],
                  isError: true
                }
              }
              const commit = result.data
              let text = `Commit: ${commit.hash}\n`
              text += `Author: ${commit.author.name} <${commit.author.email}>\n`
              text += `Date: ${new Date(commit.author.date).toLocaleString()} (${commit.author.relativeTime})\n`
              if (commit.committer && commit.committer.email !== commit.author.email) {
                text += `Committer: ${commit.committer.name} <${commit.committer.email}>\n`
              }
              text += `\nMessage:\n${commit.subject}\n`
              if (commit.body) {
                text += `\n${commit.body}\n`
              }
              if (commit.stats) {
                text += `\nStats: ${commit.stats.filesChanged} files changed, +${commit.stats.additions} -${commit.stats.deletions}\n`
              }
              if (commit.parents && commit.parents.length > 0) {
                text += `\nParents: ${commit.parents.join(', ')}\n`
              }
              if (commit.refs && commit.refs.length > 0) {
                text += `Refs: ${commit.refs.join(', ')}\n`
              }
              if (commit.files && commit.files.length > 0) {
                text += '\nFiles:\n'
                commit.files.forEach((file) => {
                  text += `  ${file.status}: ${file.path} (+${file.additions} -${file.deletions})`
                  if (file.binary) text += ' [binary]'
                  if (file.oldPath) text += ` (from ${file.oldPath})`
                  text += '\n'
                  if (includeFileContents && file.diff) {
                    text += '    Diff:\n'
                    text += file.diff.split('\n').map(line => '    ' + line).join('\n') + '\n'
                  }
                })
              }
              return { content: [{ type: 'text', text }] }
            }

            case GitManagerAction.WORKTREE_LIST: {
              const worktrees = await getWorktrees(projectId)
              if (worktrees.length === 0) {
                return { content: [{ type: 'text', text: 'No worktrees found' }] }
              }
              const text = worktrees
                .map((wt) => {
                  let line = wt.isMain ? '* ' : '  '
                  line += `${wt.path}`
                  if (wt.branch) line += ` (${wt.branch})`
                  if (wt.commit) line += ` [${wt.commit.substring(0, 7)}]`
                  if (wt.isLocked) line += ` [locked${wt.lockReason ? `: ${wt.lockReason}` : ''}]`
                  if (wt.isPrunable) line += ' [prunable]'
                  return line
                })
                .join('\n')
              return { content: [{ type: 'text', text }] }
            }

            case GitManagerAction.WORKTREE_ADD: {
              const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
              const options = {
                branch: data?.branch as string | undefined,
                newBranch: data?.newBranch as string | undefined,
                commitish: data?.commitish as string | undefined,
                detach: data?.detach as boolean | undefined
              }
              await addWorktree(projectId, { path, ...options })
              return { content: [{ type: 'text', text: `Created worktree at: ${path}` }] }
            }

            case GitManagerAction.WORKTREE_REMOVE: {
              const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
              const force = data?.force as boolean | undefined
              await removeWorktree(projectId, path, force)
              return { content: [{ type: 'text', text: `Removed worktree: ${path}` }] }
            }

            case GitManagerAction.WORKTREE_LOCK: {
              const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
              const reason = data?.reason as string | undefined
              await lockWorktree(projectId, path, reason)
              return { content: [{ type: 'text', text: `Locked worktree: ${path}${reason ? ` (${reason})` : ''}` }] }
            }

            case GitManagerAction.WORKTREE_UNLOCK: {
              const path = validateDataField<string>(data, 'path', 'string', '"../feature-branch"')
              await unlockWorktree(projectId, path)
              return { content: [{ type: 'text', text: `Unlocked worktree: ${path}` }] }
            }

            case GitManagerAction.WORKTREE_PRUNE: {
              const dryRun = data?.dryRun as boolean | undefined
              const pruned = await pruneWorktrees(projectId, dryRun)
              if (pruned.length === 0) {
                return { content: [{ type: 'text', text: dryRun ? 'No worktrees would be pruned' : 'No worktrees pruned' }] }
              }
              const text = dryRun 
                ? `Would prune:\n${pruned.join('\n')}`
                : `Pruned:\n${pruned.join('\n')}`
              return { content: [{ type: 'text', text }] }
            }

            default:
              throw new Error(`Unknown action: ${action}`)
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }
            ],
            isError: true
          }
        }
      }
    )
  },

  {
    name: 'tab_manager',
    description: 'Manage active tabs for projects. Actions: get_active, set_active, clear_active',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(TabManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for all actions). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description: 'Action-specific data. For set_active: { tabId: 0, clientId: "optional-client-id" }'
        }
      },
      required: ['action', 'projectId']
    },
    handler: createTrackedHandler(
      'tab_manager',
      async (args: z.infer<typeof TabManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args

          switch (action) {
            case TabManagerAction.GET_ACTIVE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const clientId = data?.clientId as string | undefined

              const activeTab = await getActiveTab(validProjectId, clientId)

              if (!activeTab) {
                return {
                  content: [{ type: 'text', text: `No active tab set for project ${validProjectId}` }]
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Active tab for project ${validProjectId}:\n` +
                      `Tab ID: ${activeTab.data.activeTabId}\n` +
                      `Last updated: ${new Date(activeTab.data.lastUpdated).toISOString()}\n` +
                      `Client ID: ${activeTab.data.clientId || 'not set'}`
                  }
                ]
              }
            }

            case TabManagerAction.SET_ACTIVE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const tabId = validateDataField<number>(data, 'tabId', 'number', '0')
              const clientId = data?.clientId as string | undefined

              const activeTab = await setActiveTab(validProjectId, tabId, clientId)

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `Successfully set active tab for project ${validProjectId}:\n` +
                      `Tab ID: ${activeTab.data.activeTabId}\n` +
                      `Client ID: ${activeTab.data.clientId || 'not set'}`
                  }
                ]
              }
            }

            case TabManagerAction.CLEAR_ACTIVE: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const clientId = data?.clientId as string | undefined

              const success = await clearActiveTab(validProjectId, clientId)

              return {
                content: [
                  {
                    type: 'text',
                    text: success
                      ? `Active tab cleared for project ${validProjectId}`
                      : `No active tab found to clear for project ${validProjectId}`
                  }
                ]
              }
            }

            case TabManagerAction.GENERATE_NAME: {
              const validProjectId = validateRequiredParam(projectId, 'projectId', 'number', '1750564533014')
              const tabId = validateDataField<number>(data, 'tabId', 'number', '0')
              const tabData = data?.tabData || {}
              const existingNames = data?.existingNames || []
              
              const { createTabNameGenerationService } = await import('@octoprompt/services')
              const tabNameService = createTabNameGenerationService()
              
              const result = await tabNameService.generateUniqueTabName(
                validProjectId,
                tabData,
                existingNames
              )
              
              return {
                content: [
                  {
                    type: 'text',
                    text: `Generated tab name: "${result.name}"\nStatus: ${result.status}\nGenerated at: ${result.generatedAt.toISOString()}`
                  }
                ]
              }
            }

            default:
              throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
                action,
                validActions: Object.values(TabManagerAction)
              })
          }
        } catch (error) {
          // Convert to MCPError if not already
          const mcpError =
            error instanceof MCPError
              ? error
              : MCPError.fromError(error, {
                  tool: 'tab_manager',
                  action: args.action
                })

          // Return formatted error response with recovery suggestions
          return formatMCPErrorResponse(mcpError)
        }
      }
    )
  },

  {
    name: 'tab_manager',
    description: 'Manage active tabs for projects. Actions: get_active, set_active, clear_active',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: ['get_active', 'set_active', 'clear_active']
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for all actions). Example: 1750564533014'
        },
        data: {
          type: 'object',
          description: 'Action-specific data. For set_active: { tabId: 0, clientId: "optional-client-id" }'
        }
      },
      required: ['action', 'projectId']
    },
    handler: createTrackedHandler(
      'tab_manager',
      async (args: { action: string; projectId: number; data?: any }): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args

          // Validate project exists
          await getProjectById(projectId)

          switch (action) {
            case 'get_active': {
              const clientId = data?.clientId as string | undefined
              const activeTab = await getActiveTab(projectId, clientId)

              if (!activeTab) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: 'No active tab set for this project'
                    }
                  ]
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(
                      {
                        activeTabId: activeTab.data.activeTabId,
                        clientId: activeTab.data.clientId,
                        lastUpdated: activeTab.data.lastUpdated,
                        tabMetadata: activeTab.data.tabMetadata
                      },
                      null,
                      2
                    )
                  }
                ]
              }
            }

            case 'set_active': {
              if (!data || typeof data.tabId !== 'number') {
                throw new Error('tabId is required and must be a number')
              }

              const { tabId, clientId } = data
              const result = await setActiveTab(projectId, { tabId, clientId })

              return {
                content: [
                  {
                    type: 'text',
                    text: `Active tab set to ${tabId}${clientId ? ` for client ${clientId}` : ''}`
                  }
                ]
              }
            }

            case 'clear_active': {
              const clientId = data?.clientId as string | undefined
              await clearActiveTab(projectId, clientId)

              return {
                content: [
                  {
                    type: 'text',
                    text: `Active tab cleared${clientId ? ` for client ${clientId}` : ''}`
                  }
                ]
              }
            }

            default:
              throw new Error(`Unknown action: ${action}`)
          }
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }
            ],
            isError: true
          }
        }
      }
    )
  },

  {
    name: 'job_manager',
    description: 'Manage background jobs and long-running operations. Actions: list (get jobs with filters), get (get single job status), create (create new job), cancel (cancel running job), retry (retry failed job), cleanup (remove old completed jobs)',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(JobManagerAction)
        },
        jobId: {
          type: 'number',
          description: 'The job ID (required for get, cancel, retry actions)'
        },
        projectId: {
          type: 'number',
          description: 'The project ID (optional for list, required for create)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data. For list: { status: ["pending", "running"], limit: 10 }. For create: { type: "git.worktree.add", input: {...}, options: { priority: "high" } }. For cleanup: { olderThanDays: 30 }'
        }
      },
      required: ['action']
    },
    handler: createTrackedHandler(
      'job_manager',
      async (args: z.infer<typeof JobManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, jobId, projectId, data } = args
          const { getJobQueue } = await import('@octoprompt/services')
          const jobQueue = getJobQueue()

          switch (action) {
            case JobManagerAction.LIST: {
              const filter = data || {}
              if (projectId) filter.projectId = projectId
              
              const jobs = await jobQueue.getJobs(filter)
              
              return {
                content: [
                  {
                    type: 'text',
                    text: `Found ${jobs.length} jobs:\n${jobs.map(job => 
                      `- Job ${job.id}: ${job.type} (${job.status}) - Created ${new Date(job.created).toISOString()}`
                    ).join('\n')}`
                  }
                ]
              }
            }

            case JobManagerAction.GET: {
              const validJobId = validateRequiredParam(jobId, 'jobId', 'number')
              const job = await jobQueue.getJob(validJobId)
              
              if (!job) {
                return {
                  content: [{ type: 'text', text: `Job ${validJobId} not found` }]
                }
              }

              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(job, null, 2)
                  }
                ]
              }
            }

            case JobManagerAction.CREATE: {
              const validProjectId = projectId ? validateRequiredParam(projectId, 'projectId', 'number') : undefined
              const jobType = validateDataField<string>(data, 'type', 'string', '"git.worktree.add"')
              const jobInput = validateDataField<any>(data, 'input', 'object', '{ path: "/path/to/worktree" }')
              
              const job = await jobQueue.createJob({
                type: jobType,
                input: jobInput,
                projectId: validProjectId,
                options: data.options,
                metadata: data.metadata
              })

              return {
                content: [
                  {
                    type: 'text',
                    text: `Created job ${job.id} of type ${job.type} with status ${job.status}`
                  }
                ]
              }
            }

            case JobManagerAction.CANCEL: {
              const validJobId = validateRequiredParam(jobId, 'jobId', 'number')
              const cancelled = await jobQueue.cancelJob(validJobId)
              
              return {
                content: [
                  {
                    type: 'text',
                    text: cancelled 
                      ? `Job ${validJobId} cancelled successfully`
                      : `Failed to cancel job ${validJobId} (may already be completed)`
                  }
                ]
              }
            }

            case JobManagerAction.RETRY: {
              const validJobId = validateRequiredParam(jobId, 'jobId', 'number')
              const originalJob = await jobQueue.getJob(validJobId)
              
              if (!originalJob) {
                return {
                  content: [{ type: 'text', text: `Job ${validJobId} not found` }]
                }
              }

              if (originalJob.status !== 'failed') {
                return {
                  content: [{ type: 'text', text: `Job ${validJobId} is not in failed state (current: ${originalJob.status})` }]
                }
              }

              const newJob = await jobQueue.createJob({
                type: originalJob.type,
                input: originalJob.input,
                projectId: originalJob.projectId,
                metadata: {
                  ...originalJob.metadata,
                  retriedFromJobId: validJobId
                }
              })

              return {
                content: [
                  {
                    type: 'text',
                    text: `Created retry job ${newJob.id} based on failed job ${validJobId}`
                  }
                ]
              }
            }

            case JobManagerAction.CLEANUP: {
              const olderThanDays = data?.olderThanDays || 30
              const deletedCount = await jobQueue.cleanupOldJobs(olderThanDays)
              
              return {
                content: [
                  {
                    type: 'text',
                    text: `Cleaned up ${deletedCount} jobs older than ${olderThanDays} days`
                  }
                ]
              }
            }

            default:
              throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
                action,
                validActions: Object.values(JobManagerAction)
              })
          }
        } catch (error) {
          const mcpError =
            error instanceof MCPError
              ? error
              : MCPError.fromError(error, {
                  tool: 'job_manager',
                  action: args.action
                })

          return formatMCPErrorResponse(mcpError)
        }
      }
    )
  },

  {
    name: 'file_summarization_manager',
    description: 'Intelligent file summarization with grouping, batch processing, and progress tracking. Actions: identify_unsummarized (find files needing summaries), group_files (group related files by strategy), summarize_batch (batch summarize with token management), get_progress (track batch progress), cancel_batch (cancel ongoing operation), get_summary_stats (get project summarization statistics)',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform',
          enum: Object.values(FileSummarizationManagerAction)
        },
        projectId: {
          type: 'number',
          description: 'The project ID (required for all actions)'
        },
        data: {
          type: 'object',
          description: 'Action-specific data. For identify_unsummarized: { includeStale: true, staleThresholdDays: 30 }. For group_files: { strategy: "imports" | "directory" | "semantic" | "mixed", maxGroupSize: 10, priorityThreshold: 3 }. For summarize_batch: { strategy: "mixed", maxGroupSize: 10, maxTokensPerGroup: 10000, maxConcurrentGroups: 3, includeStaleFiles: true }. For cancel_batch: { batchId: "batch-123-456" }'
        }
      },
      required: ['action', 'projectId']
    },
    handler: createTrackedHandler(
      'file_summarization_manager',
      async (args: z.infer<typeof FileSummarizationManagerSchema>): Promise<MCPToolResponse> => {
        try {
          const { action, projectId, data } = args
          const {
            fileSummarizationTracker,
            fileGroupingService,
            enhancedSummarizationService,
            getProjectFiles
          } = await import('@octoprompt/services')

          switch (action) {
            case FileSummarizationManagerAction.IDENTIFY_UNSUMMARIZED: {
              const options = data || {}
              const unsummarizedFiles = await fileSummarizationTracker.getUnsummarizedFiles(projectId, {
                includeSkipped: options.includeSkipped || false,
                includeEmpty: false
              })
              
              const staleFiles = options.includeStale
                ? await fileSummarizationTracker.getStaleFiles(
                    projectId,
                    (options.staleThresholdDays || 30) * 24 * 60 * 60 * 1000
                  )
                : []
              
              // Combine and deduplicate
              const fileMap = new Map()
              const allFiles = [...unsummarizedFiles, ...staleFiles]
              allFiles.forEach(f => fileMap.set(f.id, f))
              const totalFiles = fileMap.size
              
              return {
                content: [{
                  type: 'text',
                  text: `Found ${totalFiles} files needing summarization:\n` +
                    `- Unsummarized: ${unsummarizedFiles.length}\n` +
                    `- Stale: ${staleFiles.length}\n\n` +
                    `Files:\n${Array.from(fileMap.values()).slice(0, 20).map(f => 
                      `- ${f.path} (${f.size ? `${(f.size / 1024).toFixed(1)}KB` : 'unknown size'})`
                    ).join('\n')}${totalFiles > 20 ? `\n... and ${totalFiles - 20} more` : ''}`
                }]
              }
            }

            case FileSummarizationManagerAction.GROUP_FILES: {
              const options = data || {}
              const files = await getProjectFiles(projectId)
              if (!files || files.length === 0) {
                return {
                  content: [{ type: 'text', text: 'No files found in project' }]
                }
              }
              
              const groups = fileGroupingService.groupFilesByStrategy(
                files,
                options.strategy || 'mixed',
                {
                  maxGroupSize: options.maxGroupSize || 10,
                  priorityThreshold: options.priorityThreshold || 3
                }
              )
              
              return {
                content: [{
                  type: 'text',
                  text: `Created ${groups.length} file groups using ${options.strategy || 'mixed'} strategy:\n\n` +
                    groups.slice(0, 10).map(g => 
                      `Group: ${g.name}\n` +
                      `- Files: ${g.fileIds.length}\n` +
                      `- Priority: ${g.priority.toFixed(2)}\n` +
                      `- Estimated tokens: ${g.estimatedTokens || 'unknown'}\n`
                    ).join('\n') +
                    (groups.length > 10 ? `\n... and ${groups.length - 10} more groups` : '')
                }]
              }
            }

            case FileSummarizationManagerAction.SUMMARIZE_BATCH: {
              const options = data || {}
              const batchOptions = {
                strategy: options.strategy || 'mixed',
                maxGroupSize: options.maxGroupSize || 10,
                maxTokensPerGroup: options.maxTokensPerGroup || 10000,
                maxConcurrentGroups: options.maxConcurrentGroups || 3,
                priorityThreshold: options.priorityThreshold || 3,
                includeStaleFiles: options.includeStaleFiles !== false,
                staleThresholdDays: options.staleThresholdDays || 30,
                retryFailedFiles: options.retryFailedFiles || false,
                maxRetries: options.maxRetries || 2
              }
              
              // Start async batch process
              const iterator = enhancedSummarizationService.batchSummarizeWithProgress(
                projectId,
                batchOptions
              )
              
              // Get first progress update
              const firstProgress = await iterator.next()
              if (firstProgress.done) {
                return {
                  content: [{ type: 'text', text: 'No files to summarize' }]
                }
              }
              
              const progress = firstProgress.value
              return {
                content: [{
                  type: 'text',
                  text: `Batch summarization started:\n` +
                    `- Batch ID: ${progress.batchId}\n` +
                    `- Total files: ${progress.totalFiles}\n` +
                    `- Total groups: ${progress.totalGroups}\n` +
                    `- Status: Processing...\n\n` +
                    `Use get_progress action with batchId to track progress`
                }]
              }
            }

            case FileSummarizationManagerAction.GET_PROGRESS: {
              const activeBatches = fileSummarizationTracker.getActiveBatches()
              const projectProgress = fileSummarizationTracker.getSummarizationProgress(projectId)
              
              if (!projectProgress && activeBatches.length === 0) {
                return {
                  content: [{ type: 'text', text: 'No active or recent batch operations found' }]
                }
              }
              
              let text = ''
              if (projectProgress) {
                const duration = projectProgress.endTime 
                  ? projectProgress.endTime - projectProgress.startTime
                  : Date.now() - projectProgress.startTime
                
                text += `Current batch progress:\n` +
                  `- Batch ID: ${projectProgress.batchId}\n` +
                  `- Status: ${projectProgress.status}\n` +
                  `- Files: ${projectProgress.processedFiles}/${projectProgress.totalFiles} (${Math.round(projectProgress.processedFiles / projectProgress.totalFiles * 100)}%)\n` +
                  `- Groups: ${projectProgress.processedGroups}/${projectProgress.totalGroups}\n` +
                  `- Duration: ${(duration / 1000).toFixed(1)}s\n` +
                  `- Tokens used: ~${projectProgress.estimatedTokensUsed.toLocaleString()}\n`
                
                if (projectProgress.currentGroup) {
                  text += `- Current group: ${projectProgress.currentGroup}\n`
                }
                
                if (projectProgress.errors && projectProgress.errors.length > 0) {
                  text += `\nErrors:\n${projectProgress.errors.slice(0, 5).join('\n')}`
                }
              }
              
              if (activeBatches.length > 0) {
                text += `\n\nActive batches:\n`
                activeBatches.forEach(({ batchId, progress }) => {
                  text += `- ${batchId}: ${progress.status} (${progress.processedFiles}/${progress.totalFiles} files)\n`
                })
              }
              
              return {
                content: [{ type: 'text', text }]
              }
            }

            case FileSummarizationManagerAction.CANCEL_BATCH: {
              const batchId = data?.batchId
              if (!batchId) {
                return {
                  content: [{ type: 'text', text: 'Error: batchId is required in data' }]
                }
              }
              
              const cancelled = enhancedSummarizationService.cancelBatch(batchId)
              if (cancelled) {
                fileSummarizationTracker.cancelBatch(batchId)
                return {
                  content: [{ type: 'text', text: `Batch ${batchId} cancelled successfully` }]
                }
              }
              
              return {
                content: [{ type: 'text', text: `Batch ${batchId} not found or already completed` }]
              }
            }

            case FileSummarizationManagerAction.GET_SUMMARY_STATS: {
              const stats = await fileSummarizationTracker.getSummarizationStats(projectId)
              
              return {
                content: [{
                  type: 'text',
                  text: `File summarization statistics for project ${projectId}:\n\n` +
                    `Total files: ${stats.totalFiles}\n` +
                    `Summarized: ${stats.summarizedFiles} (${Math.round(stats.summarizedFiles / stats.totalFiles * 100)}%)\n` +
                    `Unsummarized: ${stats.unsummarizedFiles}\n` +
                    `Stale: ${stats.staleFiles}\n` +
                    `Failed: ${stats.failedFiles}\n\n` +
                    `Average tokens per file: ${stats.averageTokensPerFile}\n` +
                    `Last batch run: ${stats.lastBatchRun ? new Date(stats.lastBatchRun).toLocaleString() : 'Never'}\n\n` +
                    `Files by status:\n` +
                    Object.entries(stats.filesByStatus)
                      .map(([status, count]) => `- ${status}: ${count}`)
                      .join('\n')
                }]
              }
            }

            default:
              throw createMCPError(MCPErrorCode.UNKNOWN_ACTION, `Unknown action: ${action}`, {
                action,
                validActions: Object.values(FileSummarizationManagerAction)
              })
          }
        } catch (error) {
          const mcpError =
            error instanceof MCPError
              ? error
              : MCPError.fromError(error, {
                  tool: 'file_summarization_manager',
                  action: args.action
                })

          return formatMCPErrorResponse(mcpError)
        }
      }
    )
  }
]

// Helper functions for consolidated tools
export type ConsolidatedToolNames = (typeof CONSOLIDATED_TOOLS)[number]['name']

export function getConsolidatedToolByName(name: string): MCPToolDefinition | undefined {
  return CONSOLIDATED_TOOLS.find((tool) => tool.name === name)
}

export function getAllConsolidatedToolNames(): string[] {
  return CONSOLIDATED_TOOLS.map((tool) => tool.name)
}

export function getAllConsolidatedTools(): readonly MCPToolDefinition[] {
  return CONSOLIDATED_TOOLS
}
