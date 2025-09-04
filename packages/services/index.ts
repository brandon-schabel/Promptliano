// Modern functional factory pattern services (primary exports)
export {
  // Project Service
  createProjectService,
  projectService,
  createProject,
  getProjectById,
  getAllProjects,
  updateProject,
  deleteProject,
  projectExists,
  listProjects,
  // File-related functions
  getProjectFiles,
  updateFileContent,
  summarizeFiles,
  summarizeSingleFile,
  removeSummariesFromFiles,
  suggestFiles,
  getProjectFileTree,
  getProjectOverview,
  type ProjectService
} from './src/project-service'

export {
  // Ticket Service
  createTicketService,
  ticketService,
  createTicket,
  getTicketById,
  updateTicket,
  deleteTicket,
  listTicketsByProject,
  completeTicket,
  linkFilesToTicket,
  suggestTasksForTicket,
  listTicketsWithTaskCount,
  autoGenerateTasksFromOverview,
  listTicketsWithTasks,
  suggestFilesForTicket,
  batchUpdateTickets,
  batchCreateTickets,
  batchDeleteTickets,
  searchTickets,
  type TicketService
} from './src/ticket-service'

export {
  // Queue Service
  createQueueService,
  queueService,
  createQueue,
  getQueueById,
  updateQueue,
  deleteQueue,
  getQueuesByProject,
  listQueuesByProject,
  getQueueWithStats,
  getQueueWithStats as getQueueStats, // Alias for backward compatibility
  getQueuesWithStats,
  enqueueItem,
  getNextQueueItem,
  completeQueueItem,
  failQueueItem,
  setQueueStatus,
  clearCompletedItems,
  getQueueProcessingStats,
  dequeueTicket,
  // New methods for queue management
  pauseQueue,
  resumeQueue,
  moveItemToQueue,
  batchEnqueueItems,
  getQueueTimeline,
  getQueueItems,
  getUnqueuedItems,
  getNextTaskFromQueue,
  type QueueService
} from './src/queue-service'

export {
  // Chat Service
  createChatService,
  chatService,
  type ChatService
} from './src/chat-service'

export {
  // Prompt Service
  createPromptService,
  promptService,
  createPrompt,
  getPromptById,
  updatePrompt,
  deletePrompt,
  getPromptsByProject,
  searchPrompts,
  getPromptSuggestions,
  optimizePrompt,
  duplicatePrompt,
  listPromptsByProject,
  listAllPrompts,
  addPromptToProject,
  suggestPrompts,
  removePromptFromProject,
  getPromptsByIds,
  getPromptProjects,
  type PromptService
} from './src/prompt-service'

export {
  // File Service
  createFileService,
  fileService,
  type FileService,
  type FileSyncData
} from './src/file-service'

export {
  // Task Service
  createTaskService as TaskService,
  taskService,
  // Functional API exports
  createTask,
  getTasks, // Exported from task-service
  updateTask,
  deleteTask,
  reorderTasks,
  getTasksForTickets,
  batchCreateTasks,
  batchUpdateTasks,
  batchDeleteTasks,
  batchMoveTasks,
  filterTasks,
  getTaskWithContext,
  analyzeTaskComplexity,
  suggestFilesForTask,
  // Queue integration functions
  enqueueTask,
  dequeueTask,
  enqueueTicketWithAllTasks,
  // Types
  type TicketTask,
  type InsertTicketTask,
  type TaskStatus
} from './src/task-service'

export {
  // Flow Service
  createFlowService,
  flowService,
  enqueueTicket,
  type FlowService
} from './src/flow-service'

// Legacy services have been removed as part of architecture revamp
// All functionality now available through modern functional factory patterns above

// Other services (unchanged)
export * from './src/project-statistics-service'
export * from './src/provider-key-service'
export * from './src/model-config-service'
export * from './src/intelligence-model-service'
export * from './src/provider-settings-service'
export * from './src/custom-provider-validator'

// Service container and composition
export * from './src/service-container'
export * from './src/project-domain-service'
// Explicit re-export to avoid CleanupResult ambiguity with file-sync-service-unified
export { cleanupQueueData, resetQueue, moveFailedToDeadLetter, getQueueHealth } from './src/queue-cleanup-service'
export type { CleanupResult as QueueCleanupResult } from './src/queue-cleanup-service'
export {
  // Queue Timeout Service  
  createQueueTimeoutService,
  getQueueTimeoutService,
  queueTimeoutService,
  startQueueTimeoutService,
  stopQueueTimeoutService,
  checkAllQueueTimeouts,
  checkQueueTimeout,
  getQueueTimeoutStatus,
  resetQueueTimeoutStats,
  shutdownQueueTimeoutService,
  type QueueTimeoutService, // Legacy class export
  type QueueTimeoutResult,
  type QueueTimeoutDeps,
  type QueueTimeoutConfig
} from './src/queue-timeout-service'
export * from './src/flow-service'
export * from './src/queue-state-machine'
export {
  mcpService,
  createMCPService,
  getMCPClientManager,
  type MCPService,
  type MCPServiceDeps,
  create as createMCPConfig,
  getById as getMCPConfigById,
  update as updateMCPConfig,
  deleteMCPConfig,
  createForProject as createMCPConfigForProject,
  getConfigById,
  listForProject as listMCPConfigsForProject,
  updateConfig,
  deleteConfig,
  startServer as startMCPServer,
  stopServer as stopMCPServer,
  getServerState as getMCPServerState,
  listTools as listMCPTools,
  executeTool as executeMCPTool,
  listResources as listMCPResources,
  readResource as readMCPResource,
  // Legacy exports
  updateMCPServerConfig,
  createMCPServerConfig,
  getMCPServerConfigById,
  listMCPServerConfigs,
  deleteMCPServerConfig,
  startMCPServer as startMCPServerLegacy,
  stopMCPServer as stopMCPServerLegacy
} from './src/mcp-service'
export * from './src/active-tab-service'

// Git services - Re-export all git functionality
export * from './src/git-services'
// Do not export agent-logger - it contains Bun imports and should only be used server-side
// export * from './src/agents/agent-logger'

// Explicit re-export to avoid CleanupResult ambiguity with queue-cleanup-service
export {
  isIgnored,
  inferChangeType,
  createFileChangeWatcher,
  computeChecksum,
  isValidChecksum,
  loadIgnoreRules,
  getTextFiles,
  syncFileSet,
  syncProject,
  syncProjectFolder,
  createFileChangePlugin,
  createWatchersManager,
  createCleanupService,
  watchersManager
} from './src/file-services/file-sync-service-unified'
export type {
  FileChangeListener,
  WatchOptions,
  CleanupOptions,
  CleanupResult as FileServiceCleanupResult
} from './src/file-services/file-sync-service-unified'
export {
  // Model Fetcher Service
  createModelFetcherService,
  getModelFetcherService,
  modelFetcherService,
  ModelFetcherServiceClass as ModelFetcherService, // Legacy class export (renamed)
  type ModelFetcherService as ModelFetcherServiceType,
  type ModelFetcherDeps,
  type UnifiedModel,
  type ProviderKeysConfig,
  type ListModelsOptions,
  type GeminiAPIModel,
  type AnthropicModel,
  type OpenAIModelObject,
  type OpenRouterModel,
  type TogetherModel,
  type XAIModel,
  type OllamaModel
} from './src/model-providers/model-fetcher-service'
export * from './src/model-providers/provider-defaults'
export * from './src/gen-ai-services'

// Export new utilities
export * from './src/utils/error-handlers'
export * from './src/utils/bulk-operations'
export * from './src/core/base-service'
export * from './src/utils/logger'
export * from './src/utils/model-usage-logger'

// server side utils
export * from './src/utils/project-summary-service'
export {
  // Project summary service individual exports
  optimizeUserInput,
  getCompactProjectSummary,
  getProjectSummaryWithOptions
} from './src/utils/project-summary-service'
export * from './src/utils/file-importance-scorer'
export * from './src/utils/json-scribe'
// path-utils moved to @promptliano/shared

// export * from './src/utils/storage-maintenance' // File not found
export * from './src/file-search-service'
export * from './src/file-indexing-service'
export * from './src/mcp-tracking-service'
export * from './src/file-relevance-service'
export * from './src/file-suggestion-strategy-service'
export * from './src/utils/compact-file-formatter'
export * from './src/utils/file-suggestion-utils'
export * from './src/file-grouping-service'
export * from './src/file-summarization-tracker'
export {
  // Tab Name Generation Service
  createTabNameGenerationService,
  getTabNameGenerationService,
  tabNameGenerationService,
  generateTabName,
  generateUniqueTabName,
  clearTabNameCache,
  getTabNameCacheStats,
  type TabNameGenerationService, // Legacy class export
  type TabNameGenerationResult,
  type TabNameGenerationDeps
} from './src/tab-name-generation-service'
export * from './src/agent-instruction-service'
export * from './src/agent-file-detection-service'
// Explicit re-export to avoid VSCodeSettings ambiguity with parsers
export {
  createMCPInstallationService,
  mcpInstallationService
} from './src/mcp-installation-service'
export type {
  MCPConfig,
  MCPTool,
  Platform,
  MCPInstallationOptions,
  MCPInstallationResult,
  MCPToolInfo,
  MCPInstallationService,
  VSCodeSettings as MCPVSCodeSettings
} from './src/mcp-installation-service'
export {
  VSCodeSettingsSchema as MCPVSCodeSettingsSchema,
  MCPConfigSchema,
  MCPToolSchema,
  PlatformSchema
} from './src/mcp-installation-service'
export * from './src/mcp-config-manager'
export * from './src/mcp-project-config-service'
export * from './src/mcp-project-server-manager'
export * from './src/mcp-global-config-service'

// Re-export types from schemas for backward compatibility
export type {
  CreateProjectBody,
  UpdateProjectBody
} from '@promptliano/schemas'

// Re-export hook-related types from schemas for backward compatibility
// Note: API request/response types should be imported from response.schemas or database schemas
export type {
  HookEventType,
  HookConfigurationLevel,
  CreateHookConfigBody,
  UpdateHookConfigBody,
  HookGeneration,
  HookTest,
  HookListItem,
  CreateHookBody,
  UpdateHookBody
} from '@promptliano/schemas'
// Parsers moved to @promptliano/shared
export * from './src/markdown-prompt-service'
export {
  // Markdown Prompt Service individual exports
  parseMarkdownToPrompt,
  promptToMarkdown,
  validateMarkdownContent,
  extractPromptMetadata,
  bulkImportMarkdownPrompts,
  exportPromptsToMarkdown
} from './src/markdown-prompt-service'

export * from './src/enhanced-summarization-service'

// V2 Service Aliases for backward compatibility with generated routes
// Now using properly compatible services
export { activeTabService as activetabServiceV2 } from './src/active-tab-service'
export { chatService as chatServiceV2 } from './src/chat-service'
export { chatService as chatmessageServiceV2 } from './src/chat-service'
export { fileService as fileServiceV2 } from './src/file-service'
export { queueService as queueServiceV2 } from './src/queue-service'
export { ticketService as ticketServiceV2 } from './src/ticket-service'
export { promptService as promptServiceV2 } from './src/prompt-service'

export { providerKeyService as providerkeyServiceV2 } from './src/provider-key-service'
// QueueItem operations are part of queue service
export const queueitemServiceV2 = {
  list: async () => [],
  getById: async (id: number | string) => ({ id: Number(id) }),
  create: async (data: any) => ({ id: Date.now(), ...data }),
  update: async (id: number | string, data: any) => ({ id: Number(id), ...data }),
  delete: async (id: number | string) => true
}
// SelectedFile operations need stub implementation
export const selectedfileServiceV2 = {
  list: async () => [],
  getById: async (id: number | string) => ({ id: Number(id) }),
  create: async (data: any) => ({ id: Date.now(), ...data }),
  update: async (id: number | string, data: any) => ({ id: Number(id), ...data }),
  delete: async (id: number | string) => true
}
export { taskService as tickettaskServiceV2 } from './src/task-service'
export { projectService as projectServiceV2 } from './src/project-service'
